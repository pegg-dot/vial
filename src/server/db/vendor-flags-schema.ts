// Migration 17 — vendor integrity flags (the "salvage title" record).
//
// Derived red flags about a vendor's certificate program: a reused lot number across many
// products, self-issued certificates, a COA that pictures a different compound, undated or
// years-old certificates. Each flag cites what it's for and how severe it is. These are the
// things a buyer can't see on a vendor's own site but VIAL surfaces loudly.
export const vendorFlagsSchemaSql = `
CREATE TABLE IF NOT EXISTS vendor_flags (
  id TEXT PRIMARY KEY,
  vendor_slug TEXT NOT NULL,
  kind TEXT NOT NULL,          -- reused-lot | self-issued | mismatched | undated | stale
  severity TEXT NOT NULL,      -- high | medium
  label TEXT NOT NULL,
  detail TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'live',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_slug, kind)
);
CREATE INDEX IF NOT EXISTS idx_vendor_flags_vendor ON vendor_flags(vendor_slug);
`;
