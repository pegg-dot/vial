// Migration 53 — price observations become the substrate (spec: docs/superpowers/specs/
// 2026-08-29-vial-price-truth-design.md, D4/D5).
//
// Never edit migration 18's SQL: an ALTER added to an already-applied version never runs in
// production (HANDOFF, 2026-08-26). Everything here is additive and idempotent, and the repair
// is a fixed number of round trips — migrations run on the boot path, and a per-row migration
// once timed out the whole site.
import type { SqlConnection } from "./client";
import { recomputeCompoundPriceChanges } from "@/server/ingest/price-history";

export const priceObservationsV2SchemaSql = String.raw`
ALTER TABLE price_observations ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE price_observations ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE price_observations ALTER COLUMN price DROP NOT NULL;
ALTER TABLE price_observations DROP CONSTRAINT IF EXISTS price_obs_price_or_unavailable;
ALTER TABLE price_observations ADD CONSTRAINT price_obs_price_or_unavailable CHECK (price IS NOT NULL OR available = FALSE);
ALTER TABLE price_observations DROP CONSTRAINT IF EXISTS price_obs_price_positive;
ALTER TABLE price_observations ADD CONSTRAINT price_obs_price_positive CHECK (price IS NULL OR price > 0);
CREATE INDEX IF NOT EXISTS idx_price_obs_compound_day_cov ON price_observations (compound_slug, observed_day) INCLUDE (listing_slug, price, available);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_source TEXT NOT NULL DEFAULT 'catalogue';
ALTER TABLE compounds ADD COLUMN IF NOT EXISTS price_change_basis JSONB NOT NULL DEFAULT '{}'::jsonb;
`;

/**
 * The repair (D5): reset, not reconstruct.
 *
 * On 2026-08-29, 151 of the 221 multi-point price_history arrays were promo-banner values and no
 * array carried a date. Nothing in them can be trusted or timestamped, so they are discarded. What
 * IS known for every live listing is its current price and the day it was last observed — that
 * becomes one real observation, on that day (not the deploy day). previous_price came only from
 * the same approvals, so it goes too; compounds.price_change is earned again from observations
 * (D6) and reads 0 with an empty basis until it is. Wayback rows keep their real capture dates.
 */
export async function migratePriceObservationsSubstrate(db: SqlConnection) {
  for (const statement of priceObservationsV2SchemaSql.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.query(statement);
  }
  await db.query(
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
     WHERE l.origin = 'live' AND p.status = 'active'
     ON CONFLICT (listing_slug, observed_day) DO UPDATE
       SET price = EXCLUDED.price, available = EXCLUDED.available, observed_at = EXCLUDED.observed_at,
           source = EXCLUDED.source, currency = EXCLUDED.currency`,
  );
  await db.query(`UPDATE listings SET price_history = '[]'::jsonb, previous_price = NULL WHERE origin = 'live'`);
  await db.query(`UPDATE compounds SET price_change = 0, price_change_basis = '{}'::jsonb`);
  // D7: signals and alerts that came from scraped prices are superseded, not deleted — the
  // receipts stay. Delivered notifications are not recalled; this stops the sweep re-sending them.
  await db.query(`UPDATE opportunity_signals SET status = 'superseded', resolved_at = NOW() WHERE signal_type = 'listing-price-outlier' AND status = 'open'`);
  await db.query(
    `UPDATE alert_events SET data_json = data_json || '{"superseded":"price history was rebuilt from dated observations; this alert came from a page-scrape price"}'::jsonb
     WHERE category = 'price-change' AND NOT (data_json ? 'superseded')`,
  );
  // Every compound gets its basis NOW — {k: 0, n, …} — so the pages say "0 of n qualify so far"
  // from the first request after deploy, not "no checks on record" for the hour until the first
  // collect tick recomputes it. One statement.
  await recomputeCompoundPriceChanges(db);
}
