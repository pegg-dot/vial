// Backfill real vendor product photos for LIVE listings.
//
// For every live listing that has an outbound vendor URL but no stored image yet, fetch the
// vendor's own product page and extract its og:image (the standard product hero image that
// WordPress/WooCommerce, Shopify, and custom stores all emit), then store the URL. The app
// hotlinks it with a graceful fallback to the generated vial when a URL is missing/broken.
//
// Live network + writes to the dev DB. Gated so it is never an accident:
//   VIAL_LIVE_INGEST_APPROVED=true node --import tsx scripts/ingest-product-images.mjs
//   (add --refresh to also re-fetch listings that already have an image)
//
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
import { getDatabase } from "../src/server/db/client.ts";
import { extractProductImage } from "../src/server/ingest/product-image.ts";

if (process.env.VIAL_LIVE_INGEST_APPROVED !== "true") {
  console.log("Refusing to run: set VIAL_LIVE_INGEST_APPROVED=true to fetch live vendor pages.");
  process.exit(1);
}

const refresh = process.argv.includes("--refresh");
const db = await getDatabase();

const { rows } = await db.query(
  `SELECT l.slug, l.external_url, l.image_url, p.name
     FROM listings l JOIN products p ON p.id = l.product_id
    WHERE l.origin = 'live' AND l.external_url IS NOT NULL AND l.external_url <> ''
      ${refresh ? "" : "AND (l.image_url IS NULL OR l.image_url = '')"}
    ORDER BY p.name`,
);

console.log(`${rows.length} live listing(s) to check${refresh ? " (refresh mode)" : ""}.`);
let found = 0, missed = 0, failed = 0;

for (const row of rows) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(row.external_url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; VIAL/1.0; +https://vial.example)" },
    }).finally(() => clearTimeout(timer));
    if (!res.ok) { console.log(`  · ${row.name}: HTTP ${res.status}`); missed++; continue; }
    const html = await res.text();
    const image = extractProductImage(html, res.url || row.external_url);
    if (!image) { console.log(`  · ${row.name}: no og:image`); missed++; continue; }
    await db.query(`UPDATE listings SET image_url = $1 WHERE slug = $2`, [image, row.slug]);
    console.log(`  ✓ ${row.name}: ${image.slice(0, 80)}`);
    found++;
  } catch (err) {
    console.log(`  ✗ ${row.name}: ${err?.message ?? err}`);
    failed++;
  }
  await new Promise((r) => setTimeout(r, 300)); // be polite to vendor sites
}

console.log(`\nDone. ${found} images stored, ${missed} without an image, ${failed} fetch failures.`);
process.exit(0);
