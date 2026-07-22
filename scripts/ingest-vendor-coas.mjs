// Ingest vendor-published, independent-lab COAs (the green "independently tested" path) WITHOUT
// re-fetching live catalogs. Records each certificate tied to its vendor's slug so the vendor's
// "Independently tested?" reputation dimension reflects real third-party evidence. Idempotent
// (keyed on the certificate URL). Gated; run with the dev server stopped.
//   VIAL_LIVE_INGEST_APPROVED=true node --import tsx scripts/ingest-vendor-coas.mjs
import { readFileSync, existsSync } from "node:fs";
import { getDatabase } from "../src/server/db/client.ts";
import { upsertLiveVendor, recomputeCompoundStats } from "../src/server/ingest/live-sources.ts";
import { recordLabTest } from "../src/server/ingest/lab-tests.ts";
import { computeAndStoreLinkages } from "../src/server/verify/vendor-linkage.ts";

if (process.env.VIAL_LIVE_INGEST_APPROVED !== "true") { console.log("Refusing to run: set VIAL_LIVE_INGEST_APPROVED=true."); process.exit(1); }

const DATA = new URL("./data/", import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(new URL(name, DATA), "utf8"));
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
  if (!existing) await upsertLiveVendor(db, { slug, name, domains: [], description: `Research-peptide vendor. Aggregated from public sources; VIAL does not endorse any vendor.` });
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
  }, { compounds: compoundRefs, vendors: vendorRefs });
  if (res.vendorSlug) { green += 1; byVendor[v.vendorSlug] = (byVendor[v.vendorSlug] || 0) + 1; }
}
console.log(`Recorded ${green}/${vcoas.length} vendor-tied COAs.`);

await computeAndStoreLinkages(db);
await recomputeCompoundStats(db);

const covered = (await db.query(`SELECT COUNT(DISTINCT vendor_slug) n FROM lab_test_records WHERE vendor_slug IS NOT NULL`)).rows[0].n;
console.log(`Vendors with >=1 independent COA on record: ${covered}`);
console.log(`Per-vendor this run:`, byVendor);
process.exit(0);
