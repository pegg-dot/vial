export const passportHistorySchemaSql = String.raw`
ALTER TABLE batch_passports ADD COLUMN IF NOT EXISTS confidence_basis JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS passport_versions (
  id TEXT PRIMARY KEY,
  passport_id TEXT NOT NULL REFERENCES batch_passports(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  evidence_confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  sampling_level TEXT NOT NULL DEFAULT '',
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_basis JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL DEFAULT '',
  current_report_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(passport_id, version)
);
CREATE INDEX IF NOT EXISTS idx_passport_versions ON passport_versions(passport_id, version DESC);
`;
