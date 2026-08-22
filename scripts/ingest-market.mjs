process.env.VIALGRADE_SEED_FIXTURES ||= "false"; // never re-seed demo fixtures from a live-data script
// Broad market ingest: real compounds + real vendor catalogs (Shopify /products.json) +
// Janoshik COA references. Live network + writes to the dev DB. Gated.
//   VIALGRADE_LIVE_INGEST_APPROVED=true node --import tsx scripts/ingest-market.mjs
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
import { readFileSync, existsSync } from "node:fs";
import { getDatabase } from "../src/server/db/client.ts";
import { upsertLiveCompound, upsertLiveVendor, recomputeCompoundStats } from "../src/server/ingest/live-sources.ts";
import { importShopifyCatalog } from "../src/server/ingest/shopify-import.ts";
import { importWooCommerceCatalog } from "../src/server/ingest/woocommerce-import.ts";
import { importRscCatalog, productUrlsFromSitemap } from "../src/server/ingest/rsc-storefront-import.ts";
import { parseJanoshikFeed, recordLabTest, classifyTestNote } from "../src/server/ingest/lab-tests.ts";
import { deriveCoaVendors } from "../src/server/ingest/coa-vendors.ts";
import { detectVendorCoaFlags, writeVendorFlags } from "../src/server/verify/coa-integrity.ts";
import { recordPriceObservation, rebuildListingPriceHistory } from "../src/server/ingest/price-history.ts";
import { computeAndStoreLinkages } from "../src/server/verify/vendor-linkage.ts";
import { recordVendorReview } from "../src/server/verify/vendor-reviews.ts";
import { recordCollectorRun } from "../src/server/health/data-health.ts";

if (process.env.VIALGRADE_LIVE_INGEST_APPROVED !== "true") {
  console.log("Refusing to run: set VIALGRADE_LIVE_INGEST_APPROVED=true.");
  process.exit(1);
}

const DATA = new URL("./data/", import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(new URL(name, DATA), "utf8"));

const compounds = readJson("peptide-compounds.json");
const vendors = existsSync(new URL("peptide-vendors.json", DATA)) ? readJson("peptide-vendors.json") : [];
const compoundRefs = compounds.map((c) => ({ slug: c.slug, name: c.name, aliases: c.aliases }));
const vendorRefs = vendors.map((v) => ({ slug: v.slug, name: v.name, domain: v.domain }));

const db = await getDatabase();

console.log(`Upserting ${compounds.length} real compounds…`);
for (const c of compounds) await upsertLiveCompound(db, c);

// Create every reputable (non-red-flag) vendor as a real profile with its community
// reputation. Red-flag/defunct vendors are deliberately NOT listed as options.
const legit = vendors.filter((v) => !v.redFlag);
console.log(`\nCreating ${legit.length} real vendor profiles…`);
for (const v of legit) {
  await upsertLiveVendor(db, {
    slug: v.slug, name: v.name, domains: [v.domain], location: v.location,
    description: v.reputationSummary
      ? `${v.reputationSummary} Aggregated from public sources; VialGrade does not endorse any vendor.`
      : `Research-peptide vendor. Aggregated from public sources; VialGrade does not endorse any vendor.`,
  });
}

// Janoshik COA references FIRST — the lab evidence must land before the storefront catalogs so the
// storefront-COA linker (in importShopifyCatalog) can resolve each listing's published verify link
// against the certificates VialGrade holds. With vision-read purity merged in where available.
const feedFile = new URL("janoshik-feed-snapshot.html", DATA);
const purities = existsSync(new URL("janoshik-purities.json", DATA)) ? readJson("janoshik-purities.json") : {};
if (existsSync(feedFile)) {
  const entries = parseJanoshikFeed(readFileSync(feedFile, "utf8"));

  // Derive real vendors from the COA client/manufacturer fields and create each as a live
  // vendor with a verifiable independent-lab history — turning one listed vendor into many.
  const { vendors: coaVendors, vendorByTestId } = deriveCoaVendors(entries);
  console.log(`\nCreating ${coaVendors.length} vendors identified from public COA records…`);
  for (const v of coaVendors) {
    await upsertLiveVendor(db, {
      slug: v.slug, name: v.name, domains: v.domain ? [v.domain] : [],
      description: `Identified from public third-party lab records (Janoshik). Independent test history aggregated by VialGrade; not an endorsement.`,
    });
  }

  console.log(`\nRecording ${entries.length} Janoshik COA references (${Object.keys(purities).length} with vision-read purity)…`);
  let matched = 0, vendorLinked = 0;
  for (const e of entries) {
    const p = purities[e.testId] ?? {};
    const vendorSlug = vendorByTestId.get(e.testId) ?? null;
    if (vendorSlug) vendorLinked += 1;
    const cls = classifyTestNote(e.note);
    const res = await recordLabTest(db, {
      testId: e.testId, verifyUrl: e.verifyUrl, verifyKey: e.verifyKey, sampleName: e.sampleName, manufacturer: e.manufacturer,
      batchCode: p.batch ?? undefined, purityPct: p.purityPct ?? null, measuredContent: p.measuredContent ?? null, testedAt: p.testedAt ?? null,
      vendorSlug, testType: cls.testType, isBlind: cls.isBlind, testNote: e.note || null,
    }, { compounds: compoundRefs, vendors: vendorRefs });
    if (res.compoundSlug) matched += 1;
  }
  console.log(`  ${matched}/${entries.length} resolved to a known compound · ${vendorLinked} tied to a vendor`);
}

// Vendor-published COAs: certificates a LISTED vendor publishes on its own site, tied to that
// vendor's slug — so the vendor's own listings show a green "independently tested" verdict.
const vendorCoaFile = new URL("vendor-coas.json", DATA);
if (existsSync(vendorCoaFile)) {
  const vcoas = readJson("vendor-coas.json");
  const nameOf = new Map(compoundRefs.map((c) => [c.slug, c.name]));
  console.log(`\nRecording ${vcoas.length} vendor-published COAs (tied to the vendor's own listings)…`);
  let green = 0;
  for (const v of vcoas) {
    const res = await recordLabTest(db, {
      testId: `${v.vendorSlug}-${v.compound}`,
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
    if (res.compoundSlug && res.vendorSlug) green += 1;
  }
  console.log(`  ${green}/${vcoas.length} tied a vendor listing to its own independent COA`);
}

// Import full catalogs (with real prices) from vendors whose Shopify /products.json works. Runs
// AFTER the lab evidence above so importShopifyCatalog can link each listing's published Janoshik
// verify link to a held certificate (stamping the listing's testing claim for the cross-check).
const shopify = legit.filter((v) => v.productsJsonWorks);
console.log(`\nImporting catalogs from ${shopify.length} Shopify vendors…`);
let totalListings = 0;
for (const v of shopify) {
  try {
    const r = await importShopifyCatalog(db, {
      vendorSlug: v.slug, vendorName: v.name, domain: v.domain, location: v.location,
      description: `${v.reputationSummary ?? ""} Aggregated from ${v.name}'s public catalog.`.trim(),
      compounds: compoundRefs,
    });
    totalListings += r.imported.length;
    await recordCollectorRun(db, { collector: "shopify", target: v.domain, items: r.imported.length, ok: true });
    console.log(`  ${v.name.padEnd(24)} ${String(r.imported.length).padStart(3)} listings  (${r.matched}/${r.productsSeen} matched)`);
  } catch (e) {
    await recordCollectorRun(db, { collector: "shopify", target: v.domain, items: 0, ok: false });
    console.log(`  ${v.name.padEnd(24)} FAILED: ${e instanceof Error ? e.message : e}`);
  }
}

// Import full catalogs from vendors running WooCommerce (public Store API).
const woo = legit.filter((v) => v.wooWorks);
console.log(`\nImporting catalogs from ${woo.length} WooCommerce vendors…`);
for (const v of woo) {
  try {
    const r = await importWooCommerceCatalog(db, {
      vendorSlug: v.slug, vendorName: v.name, domain: v.domain, location: v.location,
      description: `${v.reputationSummary ?? ""} Aggregated from ${v.name}'s public catalog.`.trim(),
      compounds: compoundRefs,
    });
    totalListings += r.imported.length;
    await recordCollectorRun(db, { collector: "woocommerce", target: v.domain, items: r.imported.length, ok: true });
    console.log(`  ${v.name.padEnd(24)} ${String(r.imported.length).padStart(3)} listings  (${r.matched}/${r.productsSeen} matched)`);
  } catch (e) {
    await recordCollectorRun(db, { collector: "woocommerce", target: v.domain, items: 0, ok: false });
    console.log(`  ${v.name.padEnd(24)} FAILED: ${e instanceof Error ? e.message : e}`);
  }
}

// Import catalogs from headless storefronts — a Medusa backend behind a Next.js app. There is no
// /products.json and no /wp-json to read, so these vendors were not merely unlisted, they were
// never looked at. The catalogue is in the server-component payload; the importer reassembles it.
// Their own COA metadata rides along, which is what lets the listing carry real lab evidence.
const rsc = legit.filter((v) => v.rscWorks);
console.log(`\nImporting catalogs from ${rsc.length} headless vendors…`);
for (const v of rsc) {
  try {
    const res = await fetch(`https://${v.domain}/sitemap.xml`, { headers: { "user-agent": "VialGrade-Catalog-Import/1.0" }, redirect: "follow" });
    if (!res.ok) throw new Error(`sitemap HTTP ${res.status}`);
    // The sitemap is the vendor's own list of what exists; off-host entries are dropped inside.
    const productUrls = productUrlsFromSitemap(await res.text(), v.rscProductPath ?? "/product/", v.domain);
    if (!productUrls.length) throw new Error("no product urls in sitemap");

    const r = await importRscCatalog(db, {
      vendorSlug: v.slug, vendorName: v.name, domain: v.domain, location: v.location,
      description: `${v.reputationSummary ?? ""} Aggregated from ${v.name}'s public catalog.`.trim(),
      compounds: compoundRefs, productUrls,
    });
    totalListings += r.imported.length;

    // Record each certificate the storefront publishes. rscCoaFromMetadata has already refused
    // anything without a NAMED lab, so everything arriving here is independent by construction.
    let coas = 0;
    for (const c of r.coas) {
      const rec = await recordLabTest(db, {
        testId: `${v.slug}-${c.compoundSlug}-${(c.batchId || c.url).slice(-8)}`,
        verifyUrl: c.url,
        sampleName: compoundRefs.find((x) => x.slug === c.compoundSlug)?.name ?? c.compoundSlug,
        manufacturer: v.name,
        batchCode: c.batchId ?? undefined,
        purityPct: c.purityPct,
        measuredContent: null,
        testedAt: c.testedAt,
        lab: c.lab,
        vendorSlug: v.slug,
        isIndependent: true,
      }, { compounds: compoundRefs, vendors: vendorRefs });
      if (rec.vendorSlug) coas += 1;
    }

    await recordCollectorRun(db, { collector: "rsc-storefront", target: v.domain, items: r.imported.length, ok: true });
    console.log(`  ${v.name.padEnd(24)} ${String(r.imported.length).padStart(3)} listings  (${r.matched}/${r.productsSeen} matched, ${coas} COAs)`);
  } catch (e) {
    await recordCollectorRun(db, { collector: "rsc-storefront", target: v.domain, items: 0, ok: false });
    console.log(`  ${v.name.padEnd(24)} FAILED: ${e instanceof Error ? e.message : e}`);
  }
}

// Vendor integrity flags — derive "salvage title" red flags from vendors whose published
// certificates don't hold up (reused lot, self-issued, mismatched, undated, stale).
const flaggedFile = new URL("vendor-coas-flagged.json", DATA);
if (existsSync(flaggedFile)) {
  const suspect = readJson("vendor-coas-flagged.json");
  const byVendor = new Map();
  for (const c of suspect) {
    let e = byVendor.get(c.vendorSlug);
    if (!e) { e = { name: c.vendorName, coas: [] }; byVendor.set(c.vendorSlug, e); }
    e.coas.push(c);
  }
  const nowYear = new Date().getUTCFullYear();
  let flaggedVendors = 0, totalFlags = 0;
  for (const [slug, { name, coas }] of byVendor) {
    const flags = detectVendorCoaFlags(name, coas, nowYear);
    await writeVendorFlags(db, slug, flags);
    if (flags.length) { flaggedVendors += 1; totalFlags += flags.length; }
  }
  console.log(`\nDerived integrity flags: ${totalFlags} flags across ${flaggedVendors} vendors.`);
}

// Record today's price for every live listing, then project each listing's observations into
// its price-history trail (real points over time, seeded further back by the Wayback backfill).
const liveListings = (await db.query(`SELECT l.slug, o.slug vendor, c.slug compound, l.price FROM listings l JOIN products p ON p.id=l.product_id JOIN compounds c ON c.id=p.compound_id JOIN organizations o ON o.id=p.vendor_id WHERE l.origin='live'`)).rows;
const nowTs = new Date();
for (const l of liveListings) await recordPriceObservation(db, { listingSlug: l.slug, vendorSlug: l.vendor, compoundSlug: l.compound, price: Number(l.price), source: "live", observedAt: nowTs });
let rebuilt = 0;
for (const l of liveListings) { if ((await rebuildListingPriceHistory(db, l.slug)) > 0) rebuilt += 1; }
console.log(`\nRecorded ${liveListings.length} price observations · rebuilt ${rebuilt} listing price trails.`);

// Gathered buyer reviews & reputation (open-web, verification-weighted).
const reviewFile = new URL("vendor-reviews.json", DATA);
if (existsSync(reviewFile)) {
  const reviews = readJson("vendor-reviews.json");
  for (const r of reviews) await recordVendorReview(db, r);
  console.log(`\nRecorded buyer reviews for ${reviews.length} vendors.`);
}

// Rebuild the operator-linkage graph from COA lots + upstream manufacturers (+ any web
// fingerprints collected separately) — which "independent" storefronts are one operator/source.
const { edges } = await computeAndStoreLinkages(db);
console.log(`\nVendor linkage graph: ${edges} link edges.`);

console.log(`\nRecomputing compound stats…`);
await recomputeCompoundStats(db);

// Newly imported listings are invisible to site search until the derived index is rebuilt.
console.log(`Rebuilding search index…`);
const { rebuildSearchIndex, seedSearchSynonyms } = await import("../src/server/search/engine.ts");
await seedSearchSynonyms(db);
const indexed = await rebuildSearchIndex(db);
console.log(`  ${typeof indexed === "number" ? indexed : "?"} documents indexed`);

const live = await db.query(`SELECT (SELECT COUNT(*) FROM compounds WHERE origin='live') c,(SELECT COUNT(*) FROM organizations WHERE origin='live') v,(SELECT COUNT(*) FROM listings WHERE origin='live') l,(SELECT COUNT(*) FROM lab_test_records) t`);
const s = live.rows[0];
console.log(`\nLive catalog now: ${s.c} compounds · ${s.v} vendors · ${s.l} listings · ${s.t} lab tests`);
console.log(`Imported ${totalListings} real listings this run.`);
process.exit(0);
