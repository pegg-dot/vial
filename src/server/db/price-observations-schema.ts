// Migration 18 — price observations (the real price-history trail).
//
// Every price we observe for a listing is recorded here with the date we saw it and where it
// came from ('live' = a fresh catalog fetch, 'wayback' = an archived catalog snapshot). One row
// per listing per day. This is the append-only source of truth behind every price trend on the
// site — real observations over time, never a fabricated curve.
export const priceObservationsSchemaSql = `
CREATE TABLE IF NOT EXISTS price_observations (
  id TEXT PRIMARY KEY,
  listing_slug TEXT NOT NULL,
  vendor_slug TEXT NOT NULL,
  compound_slug TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'live',   -- live | wayback
  observed_day DATE NOT NULL,            -- the calendar day of observation (one point per day)
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_slug, observed_day)
);
CREATE INDEX IF NOT EXISTS idx_price_obs_listing ON price_observations(listing_slug, observed_day);
CREATE INDEX IF NOT EXISTS idx_price_obs_compound ON price_observations(compound_slug, observed_day);
`;
