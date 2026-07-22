// Broad market ingest: real compounds + real vendor catalogs (Shopify /products.json) +
// Janoshik COA references. Live network + writes to the dev DB. Gated.
//   VIAL_LIVE_INGEST_APPROVED=true node --import tsx scripts/ingest-market.mjs
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
import { readFileSync, existsSync } from "node:fs";
import { getDatabase } from "../src/server/db/client.ts";
import { upsertLiveCompound, upsertLiveVendor, recomputeCompoundStats } from "../src/server/ingest/live-sources.ts";
import { importShopifyCatalog } from "../src/server/ingest/shopify-import.ts";
import { importWooCommerceCatalog } from "../src/server/ingest/woocommerce-import.ts";
import { parseJanoshikFeed, recordLabTest } from "../src/server/ingest/lab-tests.ts";
import { deriveCoaVendors } from "../src/server/ingest/coa-vendors.ts";
import { detectVendorCoaFlags, writeVendorFlags } from "../src/server/verify/coa-integrity.ts";
import { recordPriceObservation, rebuildListingPriceHistory } from "../src/server/ingest/price-history.ts";

if (process.env.VIAL_LIVE_INGEST_APPROVED !== "true") {
  console.log("Refusing to run: set VIAL_LIVE_INGEST_APPROVED=true.");
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
      ? `${v.reputationSummary} Aggregated from public sources; VIAL does not endorse any vendor.`
      : `Research-peptide vendor. Aggregated from public sources; VIAL does not endorse any vendor.`,
  });
}

// Import full catalogs (with real prices) from vendors whose Shopify /products.json works.
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
    console.log(`  ${v.name.padEnd(24)} ${String(r.imported.length).padStart(3)} listings  (${r.matched}/${r.productsSeen} matched)`);
  } catch (e) {
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
    console.log(`  ${v.name.padEnd(24)} ${String(r.imported.length).padStart(3)} listings  (${r.matched}/${r.productsSeen} matched)`);
  } catch (e) {
    console.log(`  ${v.name.padEnd(24)} FAILED: ${e instanceof Error ? e.message : e}`);
  }
}

// Janoshik COA references, with vision-read purity merged in where available.
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
      description: `Identified from public third-party lab records (Janoshik). Independent test history aggregated by VIAL; not an endorsement.`,
    });
  }

  console.log(`\nRecording ${entries.length} Janoshik COA references (${Object.keys(purities).length} with vision-read purity)…`);
  let matched = 0, vendorLinked = 0;
  for (const e of entries) {
    const p = purities[e.testId] ?? {};
    const vendorSlug = vendorByTestId.get(e.testId) ?? null;
    if (vendorSlug) vendorLinked += 1;
    const res = await recordLabTest(db, {
      testId: e.testId, verifyUrl: e.verifyUrl, verifyKey: e.verifyKey, sampleName: e.sampleName, manufacturer: e.manufacturer,
      batchCode: p.batch ?? undefined, purityPct: p.purityPct ?? null, measuredContent: p.measuredContent ?? null, testedAt: p.testedAt ?? null,
      vendorSlug,
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

console.log(`\nRecomputing compound stats…`);
await recomputeCompoundStats(db);

const live = await db.query(`SELECT (SELECT COUNT(*) FROM compounds WHERE origin='live') c,(SELECT COUNT(*) FROM organizations WHERE origin='live') v,(SELECT COUNT(*) FROM listings WHERE origin='live') l,(SELECT COUNT(*) FROM lab_test_records) t`);
const s = live.rows[0];
console.log(`\nLive catalog now: ${s.c} compounds · ${s.v} vendors · ${s.l} listings · ${s.t} lab tests`);
console.log(`Imported ${totalListings} real listings this run.`);
process.exit(0);
