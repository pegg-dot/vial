// Backfill REAL historical prices from the Wayback Machine.
//
// Vendors' catalog endpoints (Shopify /products.json, WooCommerce Store API) are archived by
// web.archive.org over months. Each archived snapshot is a full catalog with the prices that
// were live on that date. This pulls several snapshots per catalog vendor, extracts the price
// for each compound, and records it as a dated price observation — turning today's single point
// into a real multi-month trail. Nothing is fabricated; every point is a real archived price.
//
//   VIAL_LIVE_INGEST_APPROVED=true node --import tsx scripts/backfill-prices-wayback.mjs
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
import { readFileSync } from "node:fs";
import { getDatabase } from "../src/server/db/client.ts";
import { matchCompound } from "../src/server/ingest/shopify-import.ts";
import { wooPrice } from "../src/server/ingest/woocommerce-import.ts";
import { recordPriceObservation, rebuildListingPriceHistory } from "../src/server/ingest/price-history.ts";

if (process.env.VIAL_LIVE_INGEST_APPROVED !== "true") { console.log("Refusing to run: set VIAL_LIVE_INGEST_APPROVED=true."); process.exit(1); }

const DATA = new URL("./data/", import.meta.url);
const readJson = (n) => JSON.parse(readFileSync(new URL(n, DATA), "utf8"));
const compounds = readJson("peptide-compounds.json").map((c) => ({ slug: c.slug, name: c.name, aliases: c.aliases }));
const vendors = readJson("peptide-vendors.json").filter((v) => (v.wooWorks || v.productsJsonWorks) && !v.redFlag);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

async function cdxSnapshots(endpoint) {
  // Wildcard suffix catches archived per_page/paginated variants too, and daily collapse keeps
  // far more distinct dates than monthly. Then we spread across time in the caller.
  try {
    const res = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(endpoint)}*&output=json&fl=timestamp,original&filter=statuscode:200&collapse=timestamp:8&limit=60`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) return [];
    const rows = await res.json();
    // Prefer snapshots of larger pages (per_page) when present — more products per fetch.
    return rows.slice(1).map((r) => ({ ts: r[0], url: r[1] })).sort((a, b) => (b.url.includes("per_page") ? 1 : 0) - (a.url.includes("per_page") ? 1 : 0) || a.ts.localeCompare(b.ts));
  } catch { return []; }
}

async function fetchArchived(ts, url) {
  try {
    const res = await fetch(`https://web.archive.org/web/${ts}id_/${url}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    return await res.json(); // undici auto-decompresses gzip
  } catch { return null; }
}

function tsToDate(ts) {
  // YYYYMMDDhhmmss → Date
  return new Date(`${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(8, 10)}:${ts.slice(10, 12)}:00Z`);
}

// Extract [{compound, price}] from an archived Woo or Shopify catalog payload.
function extractPrices(payload, isShopify) {
  const out = new Map(); // compound -> cheapest price
  const items = isShopify ? (payload.products ?? []).map((p) => ({ name: p.title, price: Math.min(...(p.variants ?? []).map((v) => Number(v.price)).filter((n) => n > 0)) }))
    : (Array.isArray(payload) ? payload.map((p) => ({ name: p.name, price: wooPrice(p) })) : []);
  for (const it of items) {
    if (!it.name || !Number.isFinite(it.price) || it.price < 5 || it.price > 2000) continue;
    const compound = matchCompound(it.name, compounds);
    if (!compound) continue;
    if (!out.has(compound) || it.price < out.get(compound)) out.set(compound, it.price);
  }
  return out;
}

const db = await getDatabase();
let totalObs = 0;
const touchedListings = new Set();

for (const v of vendors) {
  const isShopify = Boolean(v.productsJsonWorks);
  const endpoint = isShopify ? `${v.domain}/products.json` : `${v.domain}/wp-json/wc/store/v1/products`;
  const snaps = await cdxSnapshots(endpoint);
  if (snaps.length === 0) { console.log(`  ${v.name.padEnd(24)} no archived snapshots`); continue; }
  // Spread across time: take up to ~10 snapshots evenly.
  const step = Math.max(1, Math.floor(snaps.length / 10));
  const chosen = snaps.filter((_, i) => i % step === 0).slice(0, 10);
  let vObs = 0;
  for (const s of chosen) {
    const payload = await fetchArchived(s.ts, s.url);
    if (!payload) continue;
    const prices = extractPrices(payload, isShopify);
    const day = tsToDate(s.ts);
    for (const [compound, price] of prices) {
      const listingSlug = `${v.slug}-${compound}`;
      await recordPriceObservation(db, { listingSlug, vendorSlug: v.slug, compoundSlug: compound, price, source: "wayback", observedAt: day });
      touchedListings.add(listingSlug);
      vObs += 1; totalObs += 1;
    }
    await new Promise((r) => setTimeout(r, 400)); // be polite to archive.org
  }
  console.log(`  ${v.name.padEnd(24)} ${String(chosen.length).padStart(2)} snapshots → ${vObs} historical price points`);
}

console.log(`\nRebuilding ${touchedListings.size} listing price trails…`);
let rebuilt = 0;
for (const slug of touchedListings) { if ((await rebuildListingPriceHistory(db, slug)) > 0) rebuilt += 1; }
console.log(`Recorded ${totalObs} historical price observations · rebuilt ${rebuilt} trails.`);
process.exit(0);
