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
