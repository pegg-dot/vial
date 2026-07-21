// Migration 15 — real independent lab test records (COA evidence).
//
// Janoshik Analytical publishes a public, QR-verifiable test database: every certificate
// resolves to a vendor-immutable record with the measured purity. The purity lives inside
// a certificate IMAGE (no scraper can read it), but it can be read with vision and recorded
// here as real evidence: compound + manufacturer + batch + measured purity + the verify URL.
//
// This is the honest "audited financials" layer for a Live compound/vendor — it never
// implies every vial matches, only what one independent lab measured for one tested batch.
export const labTestRecordsSchemaSql = `
CREATE TABLE IF NOT EXISTS lab_test_records (
  id TEXT PRIMARY KEY,
  lab TEXT NOT NULL DEFAULT 'Janoshik Analytical',
  test_id TEXT,                       -- lab's task/report number, e.g. "202438"
  verify_url TEXT NOT NULL,           -- public, vendor-immutable certificate URL
  verify_key TEXT,                    -- the unique key printed on the COA
  compound_slug TEXT,                 -- resolved canonical compound (nullable if unmatched)
  sample_name TEXT NOT NULL,          -- compound label as printed on the COA
  manufacturer TEXT NOT NULL,         -- "Made By" on the COA
  vendor_slug TEXT,                   -- resolved canonical vendor (nullable)
  batch_code TEXT,
  purity_pct NUMERIC(6,3),            -- measured HPLC purity %, read from the certificate
  measured_content TEXT,              -- e.g. "11.79 mg"
  tested_at TEXT,                     -- analysis date as printed
  origin TEXT NOT NULL DEFAULT 'live',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(verify_url)
);
CREATE INDEX IF NOT EXISTS idx_lab_test_compound ON lab_test_records(compound_slug);
CREATE INDEX IF NOT EXISTS idx_lab_test_vendor ON lab_test_records(vendor_slug);
CREATE INDEX IF NOT EXISTS idx_lab_test_manufacturer ON lab_test_records(manufacturer);
`;
