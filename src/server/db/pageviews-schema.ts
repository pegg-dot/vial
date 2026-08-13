// Inbound traffic — the other half of the attribution story.
//
// Outbound clicks tell you who LEFT for a vendor. Without inbound you cannot answer the questions
// that decide the business: how many people arrived, where from, what they looked at, and what
// share of them actually clicked through to a vendor. That last ratio is the pitch — "we don't just
// have traffic, we have buyers with intent" — and it is also how you tell a Reddit post that worked
// from one that didn't.
//
// Privacy: no cookies, no accounts, no IP stored. `visitor_hash` is the SAME salted daily-rotating
// hash used for outbound clicks, so a visit and a click can be joined within a day (giving a real
// conversion rate) and cannot be joined across days into a profile.
export const pageviewsSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  page_kind TEXT,
  referrer_host TEXT,
  visitor_hash TEXT,
  device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_referrer ON page_views(referrer_host, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_kind ON page_views(page_kind, created_at DESC);
`;
