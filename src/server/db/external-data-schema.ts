// The broader data seams: third-party aggregator ratings, vendor operational signals, offers,
// news/press, and per-compound scientific literature. Each is sourced and attributed; VIAL reports
// what it found and links out. (Migration runner splits on ";", so NO semicolons in comments.)
export const externalDataSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS aggregator_ratings (
  id TEXT PRIMARY KEY,
  vendor_slug TEXT NOT NULL,
  source TEXT NOT NULL,
  score NUMERIC(6,2),
  max_score NUMERIC(6,2),
  test_count INTEGER,
  avg_purity NUMERIC(6,3),
  would_buy_again_pct INTEGER,
  summary TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_slug, source)
);
CREATE INDEX IF NOT EXISTS idx_aggregator_vendor ON aggregator_ratings(vendor_slug);

CREATE TABLE IF NOT EXISTS vendor_signals (
  vendor_slug TEXT PRIMARY KEY,
  checkout_status TEXT,
  payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  domain_age_note TEXT,
  ships_from TEXT,
  guarantees TEXT,
  research_disclaimer BOOLEAN,
  notable_copy TEXT,
  source_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_offers (
  id TEXT PRIMARY KEY,
  vendor_slug TEXT NOT NULL,
  code TEXT,
  description TEXT NOT NULL,
  discount_pct INTEGER,
  free_shipping_threshold TEXT,
  source_url TEXT NOT NULL,
  seen_on_vendor_site BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_slug, description)
);
CREATE INDEX IF NOT EXISTS idx_offers_vendor ON vendor_offers(vendor_slug);

CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY,
  vendor_slug TEXT,
  title TEXT NOT NULL,
  publisher TEXT,
  news_date TEXT,
  summary TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'news',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_url, title)
);
CREATE INDEX IF NOT EXISTS idx_news_vendor ON news_items(vendor_slug, news_date DESC);

CREATE TABLE IF NOT EXISTS compound_research (
  id TEXT PRIMARY KEY,
  compound_slug TEXT NOT NULL,
  claim TEXT NOT NULL,
  study_type TEXT,
  safety_note TEXT,
  source_url TEXT NOT NULL,
  source_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(compound_slug, source_url, claim)
);
CREATE INDEX IF NOT EXISTS idx_research_compound ON compound_research(compound_slug);

ALTER TABLE compounds ADD COLUMN IF NOT EXISTS regulatory_status TEXT;
ALTER TABLE compounds ADD COLUMN IF NOT EXISTS evidence_summary TEXT;
`;
