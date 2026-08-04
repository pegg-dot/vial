// Backfill real historical prices from the Internet Archive (Wayback Machine).
//
// For a bounded set of live listings, read archived snapshots of the vendor's product page and
// extract the price shown on that date, recording each as a real price observation — a genuine
// historical trail, never a projection. Uses the wayback "available" API (which, unlike the CDX
// endpoint, is not aggressively rate-limited), asking for the closest snapshot to a spread of
// target dates so we get several points across time for well-archived vendors. Newer vendors
// simply have no archive yet — that's honest, they're skipped.
//
// Live network + writes to the dev DB. Gated; run with the dev server STOPPED.
//   VIAL_LIVE_INGEST_APPROVED=true node --import tsx scripts/ingest-wayback-prices.mjs [maxListings]
process.env.VIAL_SEED_FIXTURES ||= "false";
import { getDatabase } from "../src/server/db/client.ts";
import { extractArchivedPrice, snapshotDate } from "../src/server/ingest/wayback-prices.ts";
import { recordPriceObservation, rebuildListingPriceHistory } from "../src/server/ingest/price-history.ts";

if (process.env.VIAL_LIVE_INGEST_APPROVED !== "true") { console.log("Refusing to run: set VIAL_LIVE_INGEST_APPROVED=true."); process.exit(1); }

const MAX = Number(process.argv[2] ?? 60);
const TARGET_DATES = ["20240101", "20240601", "20241101", "20250401", "20250901", "20260201"];
const UA = "Mozilla/5.0 (compatible; VIAL-Wayback/1.0)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, throttle, tries = 3) {
  for (let i = 0; i < tries; i++) {
    await sleep(throttle + i * 3000);
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(25000) });
      if (res.status === 429 || res.status >= 500) { await sleep(15000 * (i + 1)); continue; }
      if (!res.ok) return null;
      return await res.text();
    } catch { await sleep(4000); }
  }
  return null;
}

// Closest archived snapshot to a target date, or null.
async function closestSnapshot(url, ts) {
  const raw = await fetchText(`http://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${ts}`, 1500);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw)?.archived_snapshots?.closest;
    if (s?.available && String(s.status) === "200" && /^\d{14}$/.test(s.timestamp)) return { timestamp: s.timestamp, url: s.url };
  } catch { /* not json */ }
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
let points = 0; const touched = new Set();

for (const l of listings) {
  // Distinct snapshots closest to each target date.
  const snaps = new Map();
  for (const ts of TARGET_DATES) {
    const s = await closestSnapshot(l.external_url, ts);
    if (s) snaps.set(s.timestamp, s);
  }
  if (snaps.size === 0) { console.log(`  · ${l.compound}@${l.vendor}: no archive`); continue; }
  let got = 0;
  for (const s of snaps.values()) {
    const html = await fetchText(`http://web.archive.org/web/${s.timestamp}id_/${l.external_url}`, 2500);
    if (!html) continue;
    const price = extractArchivedPrice(html);
    if (price == null) continue;
    await recordPriceObservation(db, { listingSlug: l.slug, vendorSlug: l.vendor, compoundSlug: l.compound, price, source: "wayback", observedAt: snapshotDate(s.timestamp) });
    got += 1; points += 1;
  }
  if (got > 0) { touched.add(l.slug); console.log(`  ✓ ${l.compound}@${l.vendor}: ${got} historical prices`); }
  else console.log(`  · ${l.compound}@${l.vendor}: ${snaps.size} snapshots, no readable price`);
}

let rebuilt = 0;
for (const slug of touched) { if ((await rebuildListingPriceHistory(db, slug)) > 0) rebuilt += 1; }
console.log(`\nDone. ${points} historical price points across ${touched.size} listings; ${rebuilt} price trails rebuilt.`);
process.exit(0);
