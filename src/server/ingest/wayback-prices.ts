// Wayback price-history backfill — real observed prices from the past.
//
// The Internet Archive has years of snapshots of these vendors' product pages. We read the
// archived HTML (not the live, Cloudflare-gated page) and extract the price the vendor showed
// on that date, giving each listing a real historical price trail — never a projection.
// The CDX endpoint rate-limits aggressively, so the caller must throttle and back off.

const PRICE_MIN = 5;
const PRICE_MAX = 2000;

// Pull the displayed price out of an archived product page. Tries the structured signals every
// platform emits (Open Graph product price, JSON-LD offer price, schema.org itemprop, and the
// common WooCommerce/Shopify price markup), returning the first sane value.
export function extractArchivedPrice(html: string): number | null {
  const candidates: (string | undefined)[] = [];
  const push = (re: RegExp) => { const m = html.match(re); if (m) candidates.push(m[1]); };

  push(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([\d.]+)["']/i);
  push(/<meta[^>]+content=["']([\d.]+)["'][^>]+property=["']product:price:amount["']/i);
  push(/<meta[^>]+itemprop=["']price["'][^>]+content=["']([\d.]+)["']/i);
  push(/"price"\s*:\s*"?([\d.]+)"?/i);          // JSON-LD offers.price
  push(/"priceAmount"\s*:\s*"?([\d.]+)"?/i);
  // WooCommerce/Shopify visible price node — allow intervening tags (e.g. <bdi>) before the symbol
  push(/woocommerce-Price-amount[\s\S]{0,60}?[$£€]\s*([\d,]+\.?\d*)/i);
  push(/class=["'][^"']*(?:product[-_ ]?price|price[-_ ]?item)[^"']*["'][\s\S]{0,60}?[$£€]\s*([\d,]+\.?\d*)/i);

  for (const raw of candidates) {
    if (!raw) continue;
    const v = Number(raw.replace(/,/g, ""));
    if (Number.isFinite(v) && v >= PRICE_MIN && v <= PRICE_MAX) return Math.round(v * 100) / 100;
  }
  return null;
}

// A Wayback snapshot: 14-digit timestamp (YYYYMMDDhhmmss) and the archived original URL.
export interface WaybackSnapshot { timestamp: string; original: string }

export function parseCdx(json: unknown): WaybackSnapshot[] {
  if (!Array.isArray(json) || json.length < 2) return [];
  const rows = json.slice(1) as string[][];   // first row is the column header
  return rows
    .filter((r) => Array.isArray(r) && r.length >= 3)
    .map((r) => ({ timestamp: r[1], original: r[2] }))
    .filter((s) => /^\d{14}$/.test(s.timestamp));
}

// Snapshot timestamp (YYYYMMDDhhmmss) → ISO date.
export function snapshotDate(timestamp: string): Date {
  const y = timestamp.slice(0, 4), mo = timestamp.slice(4, 6), d = timestamp.slice(6, 8);
  return new Date(`${y}-${mo}-${d}T12:00:00Z`);
}
