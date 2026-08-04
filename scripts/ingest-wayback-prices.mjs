// Backfill real historical prices from the Internet Archive (Wayback Machine).
//
// For a bounded set of live listings, read up to a few archived snapshots of the vendor's
// product page and extract the price shown on that date, recording each as a real price
// observation. The result is a genuine historical price trail — never a projection.
//
// Wayback's CDX endpoint rate-limits hard, so this throttles and backs off on 429. Live network
// + writes to the dev DB. Gated; run with the dev server STOPPED (single-writer PGlite).
//   VIAL_LIVE_INGEST_APPROVED=true node --import tsx scripts/ingest-wayback-prices.mjs [maxListings]
process.env.VIAL_SEED_FIXTURES ||= "false";
import { getDatabase } from "../src/server/db/client.ts";
import { extractArchivedPrice, parseCdx, snapshotDate } from "../src/server/ingest/wayback-prices.ts";
import { recordPriceObservation, rebuildListingPriceHistory } from "../src/server/ingest/price-history.ts";

if (process.env.VIAL_LIVE_INGEST_APPROVED !== "true") { console.log("Refusing to run: set VIAL_LIVE_INGEST_APPROVED=true."); process.exit(1); }

const MAX = Number(process.argv[2] ?? 50);
const UA = "Mozilla/5.0 (compatible; VIAL-Wayback/1.0)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One throttled Wayback fetch with exponential backoff on 429/5xx.
async function wb(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    await sleep(5000 + i * 4000);
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(25000) });
      if (res.status === 429 || res.status >= 500) { await sleep(20000 * (i + 1)); continue; }
      if (!res.ok) return null;
      return await res.text();
    } catch { await sleep(8000); }
  }
  return null;
}

const db = await getDatabase();
const listings = (await db.query(
  `SELECT DISTINCT ON (l.external_url) l.slug, l.external_url, o.slug vendor, c.slug compound
   FROM listings l JOIN products p ON p.id=l.product_id JOIN compounds c ON c.id=p.compound_id JOIN organizations o ON o.id=p.vendor_id
   WHERE l.origin='live' AND l.external_url IS NOT NULL AND l.external_url<>'' AND l.external_url NOT LIKE '%web.archive%'
   ORDER BY l.external_url, l.featured DESC LIMIT $1`, [MAX],
)).rows;

console.log(`Backfilling Wayback price history for ${listings.length} listings…`);
let withHistory = 0, points = 0, touched = new Set();

for (const l of listings) {
  const cdxUrl = `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(l.external_url)}&output=json&filter=statuscode:200&collapse=timestamp:6&limit=6`;
  const cdxRaw = await wb(cdxUrl);
  if (!cdxRaw || cdxRaw.trim().startsWith("<")) { console.log(`  · ${l.compound}@${l.vendor}: no archive`); continue; }
  let snaps = [];
  try { snaps = parseCdx(JSON.parse(cdxRaw)); } catch { snaps = []; }
  if (!snaps.length) { console.log(`  · ${l.compound}@${l.vendor}: 0 snapshots`); continue; }

  let got = 0;
  for (const s of snaps) {
    const html = await wb(`http://web.archive.org/web/${s.timestamp}id_/${l.external_url}`);
    if (!html) continue;
    const price = extractArchivedPrice(html);
    if (price == null) continue;
    await recordPriceObservation(db, { listingSlug: l.slug, vendorSlug: l.vendor, compoundSlug: l.compound, price, source: "wayback", observedAt: snapshotDate(s.timestamp) });
    got += 1; points += 1;
  }
  if (got > 0) { touched.add(l.slug); console.log(`  ✓ ${l.compound}@${l.vendor}: ${got} historical prices`); }
  else console.log(`  · ${l.compound}@${l.vendor}: snapshots had no readable price`);
}

for (const slug of touched) { if ((await rebuildListingPriceHistory(db, slug)) > 0) withHistory += 1; }
console.log(`\nDone. ${points} historical price points across ${touched.size} listings; ${withHistory} price trails rebuilt.`);
process.exit(0);
