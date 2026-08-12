// Make ONE compound real, end to end (the roadmap "prove the pipeline on live data" step).
//
// Provisions real BPC-157 vendors/listings, points HTTP refresh policies at their real
// product pages + the Janoshik public COA feed, runs the real fetch through the normal
// snapshot -> extract -> review pipeline, and approves only sane in-range claims.
//
// Live network + writes to the dev DB. Gated so it is never an accident:
//   VIALGRADE_LIVE_INGEST_APPROVED=true node --import tsx scripts/ingest-real-bpc157.mjs
//
// Run with the dev server STOPPED (file-backed PGlite is single-writer), then start
// `npm run dev` to see real BPC-157 listings in the app.
import { getDatabase } from "../src/server/db/client.ts";
import { provisionRealBpc157, runLiveIngestAndApprove, REAL_BPC157_VENDORS } from "../src/server/ingest/bpc157.ts";

if (process.env.VIALGRADE_LIVE_INGEST_APPROVED !== "true") {
  console.log("Refusing to run: set VIALGRADE_LIVE_INGEST_APPROVED=true to register real HTTP sources and fetch live data.");
  process.exit(1);
}

const db = await getDatabase();

console.log(`Provisioning ${REAL_BPC157_VENDORS.length} real BPC-157 vendors + the Janoshik COA source…`);
const provisioned = await provisionRealBpc157(db, { approved: true });
for (const p of provisioned) console.log(`  • ${p.vendor} → ${p.listingSlug}`);

console.log(`\nFetching live pages and running the review pipeline…`);
const report = await runLiveIngestAndApprove(db);

console.log(`\nSweep: enqueued ${report.sweep.enqueued}, processed ${report.sweep.processed}`);
console.log(`Approved ${report.approved.length} claim(s):`);
for (const a of report.approved) console.log(`  ✅ ${a.predicate} = ${JSON.stringify(a.value)}  (${a.listing})`);
if (report.heldForReview.length) {
  console.log(`\nHeld for human review (not auto-approved): ${report.heldForReview.length}`);
  for (const h of report.heldForReview) console.log(`  ⏸  ${h.predicate} = ${JSON.stringify(h.value)} — ${h.reason}`);
}

// Show the resulting real listings as the app will render them.
const listings = await db.query(
  `SELECT l.slug, l.price, l.availability, l.external_url, o.display_name vendor
   FROM listings l JOIN products p ON p.id = l.product_id JOIN organizations o ON o.id = p.vendor_id
   WHERE l.origin = 'live' ORDER BY l.price DESC`,
);
console.log(`\nLive BPC-157 listings now in the catalog:`);
for (const l of listings.rows) {
  console.log(`  ${l.vendor.padEnd(20)} $${Number(l.price).toFixed(2).padStart(7)}  ${l.availability.padEnd(12)} ${l.external_url}`);
}

console.log(`\nDone. Start \`npm run dev\` and open http://localhost:3000/compounds/bpc-157`);
process.exit(0);
