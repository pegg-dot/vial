// Test-type + blind-test signal on each COA. Janoshik's public feed labels every test with an
// analysis type ("Common GLP-1 peptide blind test", "Sterility Testing", "…blend analysis"). Two
// things there are load-bearing: (1) whether the test was BLIND — a buyer submitted a vial bought
// as a normal customer, so the vendor couldn't cherry-pick — which is the strongest independence
// signal a certificate can carry; and (2) the analysis category, which separates a purity test from
// a distinct safety test (sterility / endotoxin / heavy-metals) that proves something else entirely.
export const janoshikTestTypeSchemaSql = String.raw`
ALTER TABLE lab_test_records ADD COLUMN IF NOT EXISTS test_type TEXT NOT NULL DEFAULT 'purity';
ALTER TABLE lab_test_records ADD COLUMN IF NOT EXISTS is_blind BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE lab_test_records ADD COLUMN IF NOT EXISTS test_note TEXT;
CREATE INDEX IF NOT EXISTS idx_lab_test_blind ON lab_test_records(is_blind) WHERE is_blind = TRUE;
`;
