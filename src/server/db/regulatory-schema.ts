// Public regulatory and enforcement records (FDA warning letters / import alerts, DOJ and FTC
// actions, recalls, advisories), each with its primary-source URL. vendor_slug is set only on a
// strict match; unmatched records still live here as market-wide intelligence.
// NOTE: the migration runner splits statements on ";", so SQL comments below must contain NO
// semicolons (a semicolon inside a comment would split the CREATE mid-statement).
export const regulatorySchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS regulatory_actions (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  agency TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  vendor_slug TEXT,
  match_confidence TEXT NOT NULL DEFAULT 'none',
  outcome TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  action_date TEXT,
  source_url TEXT NOT NULL,
  is_primary_source BOOLEAN NOT NULL DEFAULT TRUE,
  severity TEXT NOT NULL DEFAULT 'caution',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_url, subject_name)
);
CREATE INDEX IF NOT EXISTS idx_regulatory_vendor ON regulatory_actions(vendor_slug, severity);
CREATE INDEX IF NOT EXISTS idx_regulatory_date ON regulatory_actions(created_at DESC);
`;
