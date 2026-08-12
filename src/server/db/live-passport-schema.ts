// Live batch passports — real batches, projected from the independent certificates VialGrade holds.
//
// The batch_passports table was built for VialGrade-operated testing (orders/samples/custody/reports).
// A LIVE passport reuses the same surface (so it appears on /passports and mints a vialgrade:batch ID)
// but sources its evidence from lab_test_records directly, since external COAs never passed
// through VialGrade's own custody chain. origin distinguishes the two; passport_lab_tests carries the
// real evidence links (parallel to the demo passport_evidence_links → laboratory_reports chain).
export const livePassportSchemaSql = String.raw`
ALTER TABLE batch_passports ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE batch_passports ADD COLUMN IF NOT EXISTS compound_slug TEXT;

CREATE TABLE IF NOT EXISTS passport_lab_tests (
  id TEXT PRIMARY KEY,
  passport_id TEXT NOT NULL REFERENCES batch_passports(id) ON DELETE CASCADE,
  lab_test_id TEXT NOT NULL REFERENCES lab_test_records(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'supports',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(passport_id, lab_test_id)
);
CREATE INDEX IF NOT EXISTS idx_passport_lab_tests_passport ON passport_lab_tests(passport_id);
CREATE INDEX IF NOT EXISTS idx_batch_passports_origin ON batch_passports(origin, status);
`;
