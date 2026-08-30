// Price history — turning point-in-time prices into a real trail.
//
// recordPriceObservation() appends one price point per listing per day (from a live fetch or an
// archived catalog snapshot). rebuildListingPriceHistory() projects a listing's observations
// back into its price_history array so the existing trend UI shows REAL points. getCompound
// PriceSeries() rolls observations up into a market-wide median-over-time for a compound.

import type { SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";

export interface PriceObservationInput {
  listingSlug: string;
  vendorSlug: string;
  compoundSlug: string;
  price: number;
  source?: "live" | "wayback";
  observedAt: Date;
}

/** Record one price point (one row per listing per calendar day; last write for a day wins). */
export async function recordPriceObservation(db: SqlConnection, o: PriceObservationInput): Promise<void> {
  if (!Number.isFinite(o.price) || o.price <= 0) return;
  const day = o.observedAt.toISOString().slice(0, 10);
  await db.query(
    `INSERT INTO price_observations (id, listing_slug, vendor_slug, compound_slug, price, source, observed_day, observed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (listing_slug, observed_day) DO UPDATE SET price=EXCLUDED.price, source=EXCLUDED.source, observed_at=EXCLUDED.observed_at`,
    [newId("priceobs"), o.listingSlug, o.vendorSlug, o.compoundSlug, o.price, o.source ?? "live", day, o.observedAt.toISOString()],
  );
}

/** Project a listing's observations into its price_history array (chronological), so the
 *  existing sparkline/trend renders real points. No-op when there are no observations. */
export async function rebuildListingPriceHistory(db: SqlConnection, listingSlug: string): Promise<number> {
  const rows = (await db.query<{ price: string | number }>(
    `SELECT price FROM price_observations WHERE listing_slug=$1 ORDER BY observed_day ASC`,
    [listingSlug],
  )).rows;
  if (rows.length === 0) return 0;
  const series = rows.map((r) => Number(r.price));
  await db.query(`UPDATE listings SET price_history=$2::jsonb WHERE slug=$1`, [listingSlug, JSON.stringify(series)]);
  return series.length;
}

export interface PricePoint { day: string; median: number; low: number; high: number; n: number }

/** Market-wide median (and range) price per day for a compound, across all its listings. */
export async function getCompoundPriceSeries(db: SqlConnection, compoundSlug: string): Promise<PricePoint[]> {
  const rows = (await db.query<{ observed_day: string; prices: number[] }>(
    `SELECT observed_day::text observed_day, array_agg(price ORDER BY price) prices
       FROM price_observations WHERE compound_slug=$1 GROUP BY observed_day ORDER BY observed_day ASC`,
    [compoundSlug],
  )).rows;
  return rows.map((r) => {
    const p = (r.prices ?? []).map(Number).filter((v) => Number.isFinite(v));
    const m = Math.floor(p.length / 2);
    const median = p.length ? (p.length % 2 ? p[m] : (p[m - 1] + p[m]) / 2) : 0;
    return { day: r.observed_day, median, low: p[0] ?? 0, high: p[p.length - 1] ?? 0, n: p.length };
  });
}

/** How many days of price history we hold for a listing, and since when. */
export async function getListingPriceMeta(db: SqlConnection, listingSlug: string): Promise<{ days: number; since: string | null }> {
  const r = (await db.query<{ n: string | number; since: string | null }>(
    `SELECT COUNT(*) n, MIN(observed_day)::text since FROM price_observations WHERE listing_slug=$1`,
    [listingSlug],
  )).rows[0];
  return { days: Number(r?.n ?? 0), since: r?.since ?? null };
}

// ── The substrate (spec D4–D6) ─────────────────────────────────────────────────────────────────

/**
 * One statement at the end of a collect tick: every live listing the tick touched becomes today's
 * observation, carrying the price the feed declared, whether it was available, and which writer
 * set the price (`listings.price_source`). Keyed on (listing, UTC day); the last check of a day
 * wins. Demo listings are never observations. One round trip, never per row.
 */
export async function recordTickPriceObservations(db: SqlConnection, since: Date | string): Promise<number> {
  const result = await db.query<{ listing_slug: string }>(
    `INSERT INTO price_observations (id, listing_slug, vendor_slug, compound_slug, price, source, observed_day, observed_at, currency, available)
     SELECT 'priceobs:' || l.slug || ':' || to_char(l.observed_at AT TIME ZONE 'UTC', 'YYYYMMDD'),
            l.slug, o.slug, c.slug,
            CASE WHEN l.price > 0 THEN l.price END,
            l.price_source,
            (l.observed_at AT TIME ZONE 'UTC')::date,
            l.observed_at,
            'USD',
            (l.availability <> 'Unavailable' AND l.price > 0)
     FROM listings l
     JOIN products p ON p.id = l.product_id
     JOIN compounds c ON c.id = p.compound_id
     JOIN organizations o ON o.id = p.vendor_id
     WHERE l.origin = 'live' AND p.status = 'active' AND l.observed_at >= $1::timestamptz
     ON CONFLICT (listing_slug, observed_day) DO UPDATE
       SET price = EXCLUDED.price, available = EXCLUDED.available, observed_at = EXCLUDED.observed_at, source = EXCLUDED.source
       WHERE EXCLUDED.observed_at >= price_observations.observed_at
     RETURNING listing_slug`,
    [since instanceof Date ? since.toISOString() : since],
  );
  return result.rows.length;
}

export interface ListingPricePoint { day: string; price: number | null; available: boolean; source: string }

/**
 * A listing's series as its change points: the first observation, every day the price or the
 * availability changed, and the latest — so a flat month is two points and a sparkline reads
 * honestly. One query for any number of listings; capped to the most recent `cap` points.
 */
export async function getListingPriceSeries(db: SqlConnection, slugs: string[], cap = 24): Promise<Map<string, ListingPricePoint[]>> {
  const map = new Map<string, ListingPricePoint[]>();
  if (!slugs.length) return map;
  const rows = (await db.query<{ listing_slug: string; day: string; price: string | null; available: boolean; source: string }>(
    `SELECT listing_slug, observed_day::text AS day, price, available, source FROM (
       SELECT listing_slug, observed_day, price, available, source,
              LAG(price) OVER w AS prev_price, LAG(available) OVER w AS prev_available,
              ROW_NUMBER() OVER (PARTITION BY listing_slug ORDER BY observed_day DESC) AS from_latest,
              ROW_NUMBER() OVER w AS from_first
       FROM price_observations WHERE listing_slug = ANY($1::text[])
       WINDOW w AS (PARTITION BY listing_slug ORDER BY observed_day)
     ) x
     WHERE from_latest = 1 OR from_first = 1 OR price IS DISTINCT FROM prev_price OR available IS DISTINCT FROM prev_available
     ORDER BY listing_slug, observed_day`,
    [slugs],
  )).rows;
  for (const r of rows) {
    const list = map.get(r.listing_slug) ?? [];
    list.push({ day: r.day, price: r.price === null ? null : Number(r.price), available: Boolean(r.available), source: r.source });
    map.set(r.listing_slug, list);
  }
  for (const [slug, list] of map) if (list.length > cap) map.set(slug, list.slice(-cap));
  return map;
}

/** What a compound's Δ rests on. `medianPct` is null until `k` listings earned a 30-day change. */
export interface PriceChangeBasis { k: number; n: number; window: number; asOf: string; medianPct: number | null }

export const PRICE_CHANGE_WINDOW_DAYS = 30;
export const PRICE_CHANGE_BASELINE_TOLERANCE_DAYS = 7;
export const PRICE_CHANGE_FRESH_DAYS = 2;
export const PRICE_CHANGE_MIN_SPAN_DAYS = 14;
export const PRICE_CHANGE_MIN_LISTINGS = 3;

/**
 * D6, for every compound in one statement. A listing qualifies when it has an in-stock baseline
 * within 7 days before the 30-day window opened, an in-stock observation within the last 2 days,
 * and at least 14 days between them. The compound's Δ is the median over qualifying listings and
 * is withheld (0, basis records k) until three qualify. Never differences two daily medians —
 * that measures who entered the market, not what prices did.
 */
export async function recomputeCompoundPriceChanges(db: SqlConnection): Promise<{ compounds: number; earned: number }> {
  const result = await db.query<{ slug: string; k: string | number }>(
    `WITH params AS (
       SELECT (NOW() AT TIME ZONE 'UTC')::date AS today, (NOW() AT TIME ZONE 'UTC')::date - ${PRICE_CHANGE_WINDOW_DAYS} AS window_start
     ),
     base AS (
       SELECT DISTINCT ON (o.listing_slug) o.listing_slug, o.compound_slug, o.price AS base_price, o.observed_day AS base_day
       FROM price_observations o, params p
       WHERE o.available AND o.price IS NOT NULL
         AND o.observed_day <= p.window_start AND o.observed_day >= p.window_start - ${PRICE_CHANGE_BASELINE_TOLERANCE_DAYS}
       ORDER BY o.listing_slug, o.observed_day DESC
     ),
     latest AS (
       SELECT DISTINCT ON (o.listing_slug) o.listing_slug, o.price AS latest_price, o.observed_day AS latest_day
       FROM price_observations o, params p
       WHERE o.available AND o.price IS NOT NULL AND o.observed_day >= p.today - ${PRICE_CHANGE_FRESH_DAYS}
       ORDER BY o.listing_slug, o.observed_day DESC
     ),
     per_listing AS (
       SELECT b.compound_slug, b.listing_slug, (l.latest_price - b.base_price) / b.base_price * 100 AS pct
       FROM base b JOIN latest l USING (listing_slug)
       WHERE l.latest_day - b.base_day >= ${PRICE_CHANGE_MIN_SPAN_DAYS}
     ),
     listings_per_compound AS (
       -- "k of n": n is the listings whose prices are on record at all, the honest denominator.
       SELECT compound_slug, COUNT(DISTINCT listing_slug) AS n FROM price_observations GROUP BY compound_slug
     ),
     basis AS (
       SELECT c.slug,
              COALESCE(n.n, 0) AS n,
              COUNT(pl.listing_slug) AS k,
              CASE WHEN COUNT(pl.listing_slug) >= ${PRICE_CHANGE_MIN_LISTINGS}
                   THEN ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY pl.pct))::numeric, 1) END AS median_pct
       FROM compounds c
       LEFT JOIN listings_per_compound n ON n.compound_slug = c.slug
       LEFT JOIN per_listing pl ON pl.compound_slug = c.slug
       GROUP BY c.slug, n.n
     )
     UPDATE compounds c
     SET price_change = COALESCE(b.median_pct, 0),
         price_change_basis = jsonb_build_object('k', b.k, 'n', b.n, 'window', ${PRICE_CHANGE_WINDOW_DAYS}, 'asOf', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'medianPct', b.median_pct),
         updated_at = NOW()
     FROM basis b
     WHERE b.slug = c.slug
     RETURNING c.slug, b.k`,
  );
  return { compounds: result.rows.length, earned: result.rows.filter((r) => Number(r.k) >= PRICE_CHANGE_MIN_LISTINGS).length };
}

export function parsePriceChangeBasis(value: unknown): PriceChangeBasis | null {
  const raw = typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;
  if (!raw || typeof raw !== "object" || !("k" in raw)) return null;
  const b = raw as Record<string, unknown>;
  return { k: Number(b.k ?? 0), n: Number(b.n ?? 0), window: Number(b.window ?? PRICE_CHANGE_WINDOW_DAYS), asOf: String(b.asOf ?? ""), medianPct: b.medianPct === null || b.medianPct === undefined ? null : Number(b.medianPct) };
}

export async function getCompoundPriceBasis(db: SqlConnection, compoundSlug: string): Promise<PriceChangeBasis | null> {
  const row = (await db.query<{ price_change_basis: unknown }>(`SELECT price_change_basis FROM compounds WHERE slug = $1`, [compoundSlug])).rows[0];
  return row ? parsePriceChangeBasis(row.price_change_basis) : null;
}

/** Daily in-stock median across a compound's listings, with how many listings each day rests on. */
export async function getCompoundDailyMedianSeries(db: SqlConnection, compoundSlug: string, days = 90): Promise<PricePoint[]> {
  const rows = (await db.query<{ day: string; median: string | number; low: string | number; high: string | number; n: string | number }>(
    `SELECT observed_day::text AS day,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median,
            MIN(price) AS low, MAX(price) AS high, COUNT(*) AS n
     FROM price_observations
     WHERE compound_slug = $1 AND available AND price IS NOT NULL AND observed_day >= (NOW() AT TIME ZONE 'UTC')::date - $2::int
     GROUP BY observed_day ORDER BY observed_day`,
    [compoundSlug, days],
  )).rows;
  return rows.map((r) => ({ day: r.day, median: Number(r.median), low: Number(r.low), high: Number(r.high), n: Number(r.n) }));
}

/** Every observation for ONE listing, oldest first — what computeListingTrend needs. */
export async function getListingObservations(db: SqlConnection, listingSlug: string): Promise<ListingPricePoint[]> {
  const rows = (await db.query<{ day: string; price: string | null; available: boolean; source: string }>(
    `SELECT observed_day::text AS day, price, available, source FROM price_observations WHERE listing_slug = $1 ORDER BY observed_day`,
    [listingSlug],
  )).rows;
  return rows.map((r) => ({ day: r.day, price: r.price === null ? null : Number(r.price), available: Boolean(r.available), source: r.source }));
}
