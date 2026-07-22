// Independence flag on every certificate.
//
// A COA is only "independent" evidence if a real third-party lab performed and signed it. Some
// vendors publish self-branded HPLC documents with NO independent lab named — legitimate to show,
// but materially weaker (the vendor tested its own product), and it must NEVER count toward a
// vendor's independent-evidence reputation or back a batch passport. This flag keeps the two kinds
// of evidence cleanly separated so nothing is over-claimed. Existing rows default TRUE — every COA
// ingested so far names a real third-party lab (Janoshik and the vendor-published independent labs).
export const coaIndependenceSchemaSql = String.raw`
ALTER TABLE lab_test_records ADD COLUMN IF NOT EXISTS is_independent BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_lab_test_independent ON lab_test_records(vendor_slug, is_independent);
`;
