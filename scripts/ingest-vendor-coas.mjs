process.env.VIALGRADE_SEED_FIXTURES ||= "false"; // never re-seed demo fixtures from a live-data script
// Ingest vendor-published, independent-lab COAs (the green "independently tested" path) WITHOUT
// re-fetching live catalogs. Records each certificate tied to its vendor's slug so the vendor's
// "Independently tested?" reputation dimension reflects real third-party evidence. Idempotent
// (keyed on the certificate URL). Gated; run with the dev server stopped.
//   VIALGRADE_LIVE_INGEST_APPROVED=true node --import tsx scripts/ingest-vendor-coas.mjs
import { readFileSync, existsSync } from "node:fs";
import { getDatabase } from "../src/server/db/client.ts";
import { upsertLiveVendor, recomputeCompoundStats } from "../src/server/ingest/live-sources.ts";
import { recordLabTest, reconcileLabsFromRegistry } from "../src/server/ingest/lab-tests.ts";
import { computeAndStoreLinkages } from "../src/server/verify/vendor-linkage.ts";
import { projectLiveBatchPassports } from "../src/server/evidence-network/live-passports.ts";
import { projectEvidenceRegistry } from "../src/server/registry/repository.ts";
import { recordVendorReview } from "../src/server/verify/vendor-reviews.ts";
import { reconcileVendorKinds } from "../src/server/catalog/vendor-kind.ts";
import { recordRegulatoryAction } from "../src/server/regulatory/repository.ts";
import { recordCollectorRun } from "../src/server/health/data-health.ts";

if (process.env.VIALGRADE_LIVE_INGEST_APPROVED !== "true") { console.log("Refusing to run: set VIALGRADE_LIVE_INGEST_APPROVED=true."); process.exit(1); }

const DATA = new URL("./data/", import.meta.url);
// regulatory-actions.json moved under src/ so a deployment can read it (see ingest-external-data).
const BUNDLED = new URL("../src/server/data/", import.meta.url);
const resolveData = (name) => existsSync(new URL(name, BUNDLED)) ? new URL(name, BUNDLED) : new URL(name, DATA);
const readJson = (name) => JSON.parse(readFileSync(resolveData(name), "utf8"));
const compoundRefs = readJson("peptide-compounds.json").map((c) => ({ slug: c.slug, name: c.name, aliases: c.aliases }));
const vendorRefs = existsSync(new URL("peptide-vendors.json", DATA)) ? readJson("peptide-vendors.json").map((v) => ({ slug: v.slug, name: v.name, domain: v.domain })) : [];
const vcoas = readJson("vendor-coas.json");

const db = await getDatabase();
const nameOf = new Map(compoundRefs.map((c) => [c.slug, c.name]));

// Make sure every vendor named in the COA file exists as a live org (some are review/COA-only,
// never imported from a catalog). upsertLiveVendor is idempotent and won't clobber a richer row.
const seenVendors = new Map();
for (const v of vcoas) if (!seenVendors.has(v.vendorSlug)) seenVendors.set(v.vendorSlug, v.vendorName);
for (const [slug, name] of seenVendors) {
  const existing = (await db.query(`SELECT 1 FROM organizations WHERE slug=$1`, [slug])).rows.length > 0;
  if (!existing) await upsertLiveVendor(db, { slug, name, domains: [], description: `Research-peptide vendor. Aggregated from public sources; VialGrade does not endorse any vendor.` });
}

let green = 0, byVendor = {};
for (const v of vcoas) {
  const res = await recordLabTest(db, {
    testId: `${v.vendorSlug}-${v.compound}-${(v.batch || v.url).slice(-8)}`,
    verifyUrl: v.url,
    sampleName: nameOf.get(v.compound) ?? v.compound,
    manufacturer: v.vendorName,
    batchCode: v.batch ?? undefined,
    purityPct: v.purityPct ?? null,
    measuredContent: v.measuredContent ?? null,
    testedAt: v.testedAt ?? null,
    lab: v.lab || "Janoshik Analytical",
    vendorSlug: v.vendorSlug,
    isIndependent: v.independent !== false, // a named-but-unverified lab (e.g. affiliated) sets independent:false
  }, { compounds: compoundRefs, vendors: vendorRefs });
  if (res.vendorSlug) { green += 1; byVendor[v.vendorSlug] = (byVendor[v.vendorSlug] || 0) + 1; }
}
console.log(`Recorded ${green}/${vcoas.length} vendor-tied COAs.`);

// Self-published COAs: vendor-branded documents with NO independent lab named. Recorded with a
// distinct "Vendor self-published" lab and is_independent=false so they show transparently but
// never count as independent evidence or back a passport.
const selfFile = new URL("vendor-self-coas.json", DATA);
if (existsSync(selfFile)) {
  const selfCoas = readJson("vendor-self-coas.json");
  let self = 0;
  for (const v of selfCoas) {
    await recordLabTest(db, {
      testId: `self-${v.vendorSlug}-${v.compound}`,
      verifyUrl: v.url,
      sampleName: nameOf.get(v.compound) ?? v.compound,
      manufacturer: v.vendorName,
      batchCode: v.batch ?? undefined,
      purityPct: v.purityPct ?? null,
      testedAt: v.testedAt ?? null,
      lab: `${v.vendorName} — self-published`,
      vendorSlug: v.vendorSlug,
      isIndependent: false,
    }, { compounds: compoundRefs, vendors: vendorRefs });
    self += 1;
  }
  console.log(`Recorded ${self} vendor self-published COAs (marked non-independent).`);
}

const rec = await reconcileLabsFromRegistry(db);
console.log(`Reconciled labs against the registry: ${rec.renamed} name(s) canonicalized, ${rec.independenceChanged} independence flag(s) corrected.`);

// Classify vendors: retail storefronts (curated list + those that publish their own COAs + anything
// with a shoppable catalog) vs upstream manufacturers surfaced only from the lab feed.
const retailSlugs = new Set([
  ...(existsSync(new URL("peptide-vendors.json", DATA)) ? readJson("peptide-vendors.json").map((v) => v.slug) : []),
  ...vcoas.map((v) => v.vendorSlug),
]);
const vk = await reconcileVendorKinds(db, retailSlugs);
console.log(`Vendor kinds: ${vk.storefront} storefronts · ${vk.manufacturer} manufacturers (${vk.changed} updated).`);

// Public regulatory & enforcement records (FDA/DOJ/FTC), resolved strictly to vendors by domain/name.
if (existsSync(resolveData("regulatory-actions.json"))) {
  const actions = readJson("regulatory-actions.json");
  const vendorRows = (await db.query(`SELECT slug, display_name, domains FROM organizations WHERE origin='live' AND organization_type='vendor'`)).rows
    .map((v) => ({ slug: v.slug, name: v.display_name, domains: Array.isArray(v.domains) ? v.domains : JSON.parse(v.domains || "[]") }));
  let matched = 0;
  for (const a of actions) { const r = await recordRegulatoryAction(db, a, vendorRows); if (r.vendorSlug) matched += 1; }
  await recordCollectorRun(db, { collector: "regulatory", target: "fda-doj-ftc", items: actions.length, ok: true });
  console.log(`Recorded ${actions.length} regulatory/enforcement records (${matched} matched to a tracked vendor).`);
}

// Gathered buyer reputation (open-web, verification-weighted; only vendors with substantive
// sourced signal — never algorithmic scanner scores, which are not buyer complaints).
if (existsSync(new URL("vendor-reviews.json", DATA))) {
  const reviews = readJson("vendor-reviews.json");
  for (const r of reviews) await recordVendorReview(db, r);
  console.log(`Recorded/updated ${reviews.length} vendor reputation records.`);
}

await computeAndStoreLinkages(db);
await recomputeCompoundStats(db);

const proj = await projectLiveBatchPassports(db);
await projectEvidenceRegistry(db);
console.log(`Projected ${proj.passports} real batch passports (${proj.links} certificate links) across ${proj.vendors} vendors.`);

const covered = (await db.query(`SELECT COUNT(DISTINCT vendor_slug) n FROM lab_test_records WHERE vendor_slug IS NOT NULL`)).rows[0].n;
console.log(`Vendors with >=1 independent COA on record: ${covered}`);
console.log(`Per-vendor this run:`, byVendor);
process.exit(0);
