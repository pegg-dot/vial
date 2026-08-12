// Outbound click tracking — the demand-data asset behind monetization.
//
// Every "Buy at vendor" handoff routes through /go, which records the click here before
// redirecting. Two reasons: (1) this is the leverage for affiliate deals — you can show a vendor
// exactly how many high-intent, COA-checked buyers VialGrade sent them before asking for a rev-share;
// (2) it lets monetization be swapped in per-vendor later without touching any UI. No PII is
// stored — just which listing/vendor/compound was clicked and when.
export const outboundClicksSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS outbound_clicks (
  id TEXT PRIMARY KEY,
  listing_slug TEXT,
  vendor_slug TEXT,
  compound_slug TEXT,
  destination_host TEXT,
  affiliate_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_vendor ON outbound_clicks(vendor_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_compound ON outbound_clicks(compound_slug, created_at DESC);
`;
