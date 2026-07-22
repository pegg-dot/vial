// Collect vendor web fingerprints and rebuild the operator-linkage graph.
//
// Fetches each vendor's homepage and extracts the machine identifiers an operator rarely changes
// between "independent" storefronts — Google Analytics / GTM / Facebook-pixel IDs, Shopify handle
// — then recomputes vendor links (web IDs + shared COA lots + shared upstream manufacturers).
//
//   VIAL_LIVE_INGEST_APPROVED=true node --import tsx scripts/collect-vendor-fingerprints.mjs
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
import { readFileSync } from "node:fs";
import { getDatabase } from "../src/server/db/client.ts";
import { recordFingerprint, computeAndStoreLinkages } from "../src/server/verify/vendor-linkage.ts";
import { dhash } from "../src/server/verify/photo-hash.ts";

if (process.env.VIAL_LIVE_INGEST_APPROVED !== "true") { console.log("Refusing to run: set VIAL_LIVE_INGEST_APPROVED=true."); process.exit(1); }

const vendors = JSON.parse(readFileSync(new URL("./data/peptide-vendors.json", import.meta.url), "utf8")).filter((v) => !v.redFlag);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const RX = {
  ga: /\bG-[A-Z0-9]{6,12}\b/g,
  ua: /\bUA-\d{4,}-\d{1,3}\b/g,
  gtm: /\bGTM-[A-Z0-9]{4,10}\b/g,
  fb: /fbq\(\s*['"]init['"]\s*,\s*['"](\d{10,17})['"]/g,
  shopify: /([a-z0-9][a-z0-9-]*)\.myshopify\.com/g,
};

async function fingerprintsFor(domain) {
  for (const base of [`https://${domain}`, `https://www.${domain}`]) {
    try {
      const r = await fetch(base, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const h = await r.text();
      const out = [];
      for (const [kind, rx] of Object.entries(RX)) for (const m of new Set([...h.matchAll(rx)].map((x) => x[1] ?? x[0]))) out.push({ kind: kind === "ua" ? "ga" : kind, value: m });
      return out;
    } catch { /* try www */ }
  }
  return [];
}

// Fetch a vendor's catalog and return up to `n` product image URLs (first image per product).
async function productImages(v, n) {
  const bases = v.productsJsonWorks
    ? [`https://${v.domain}/products.json?limit=${n}`]
    : [`https://${v.domain}/wp-json/wc/store/v1/products?per_page=${n}`, `https://www.${v.domain}/wp-json/wc/store/v1/products?per_page=${n}`];
  for (const url of bases) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const d = await r.json();
      const items = v.productsJsonWorks ? (d.products ?? []) : (Array.isArray(d) ? d : []);
      const urls = items.map((p) => (p.images?.[0]?.src) ?? (p.image?.src)).filter(Boolean);
      if (urls.length) return urls.slice(0, n);
    } catch { /* next */ }
  }
  return [];
}

const db = await getDatabase();
console.log(`Collecting web fingerprints for ${vendors.length} vendors…`);
let withFp = 0;
for (const v of vendors) {
  const fps = await fingerprintsFor(v.domain);
  for (const f of fps) await recordFingerprint(db, v.slug, f.kind, f.value);
  if (fps.length) { withFp += 1; console.log(`  ${v.slug.padEnd(24)} ${fps.map((f) => `${f.kind}:${f.value}`).join("  ")}`); }
}

// Perceptual-hash product photos for catalog vendors — reused imagery = one drop-shipper.
// Only DISTINCTIVE images are stored: a hash whose set-bit count is in [20,44] carries real
// structure. Near-uniform blanks (a white vial on white — popcount ~12) all look alike and would
// create false links, so they're dropped at the source.
const popcount = (h) => { let n = 0; for (const c of h) { let x = parseInt(c, 16); while (x) { n += x & 1; x >>= 1; } } return n; };
const catalogVendors = vendors.filter((v) => v.wooWorks || v.productsJsonWorks);
await db.query(`DELETE FROM vendor_fingerprints WHERE kind='photo'`); // rebuild photo hashes fresh
console.log(`\nHashing product photos for ${catalogVendors.length} catalog vendors…`);
let photoCount = 0;
for (const v of catalogVendors) {
  const imgs = await productImages(v, 14);
  let n = 0;
  for (const img of imgs) { const h = await dhash(img); if (h && popcount(h) >= 20 && popcount(h) <= 44) { await recordFingerprint(db, v.slug, "photo", h); n += 1; } }
  if (n) { photoCount += n; console.log(`  ${v.slug.padEnd(24)} ${n} distinctive photos`); }
}
console.log(`\n${withFp}/${vendors.length} vendors fingerprinted · ${photoCount} product photos hashed. Rebuilding linkage graph…`);
const { edges } = await computeAndStoreLinkages(db);
const linked = (await db.query(`SELECT COUNT(DISTINCT vendor_slug) n FROM vendor_links`)).rows[0].n;
console.log(`Built ${edges} link edges across ${linked} vendors.`);
process.exit(0);
