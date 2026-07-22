// Migration 20 — gathered buyer reviews & reputation.
//
// Direct review sites block automated access, so this is gathered by searching the open web for
// what real buyers report (Reddit, forums, Trustpilot complaints, scam reports, DOJ actions),
// weighted the way the community itself weights trust: specific failure reports and independent
// lab results count far more than cheap praise, and shill/affiliate sources are discounted. Each
// row is one vendor's honest reputation summary with its sources — a signal, never a star score.
export const vendorReviewsSchemaSql = `
CREATE TABLE IF NOT EXISTS vendor_reviews (
  id TEXT PRIMARY KEY,
  vendor_slug TEXT NOT NULL UNIQUE,
  sentiment TEXT NOT NULL,            -- positive | mixed | negative | scam | unknown
  summary TEXT NOT NULL,
  positives JSONB NOT NULL DEFAULT '[]'::jsonb,
  red_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_volume TEXT NOT NULL DEFAULT 'none',   -- none | sparse | moderate | heavy
  confidence TEXT NOT NULL DEFAULT 'low',       -- low | medium | high
  origin TEXT NOT NULL DEFAULT 'live',
  gathered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor ON vendor_reviews(vendor_slug);
`;
