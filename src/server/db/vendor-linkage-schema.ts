// Migration 19 — vendor linkage (the operator-network graph).
//
// A scam operator running many "independent" storefronts almost never re-tools ALL of its
// infrastructure per shop. Shared machine-checkable fingerprints — the same Google Analytics /
// GTM / Facebook-pixel ID, the same TLS cert, the same COA lot number, the same upstream
// manufacturer — reveal that two storefronts are actually one operator or one source. A buyer
// can't see this; a data platform can. Fingerprints are the raw evidence; links are the derived
// edges between vendors. Connected components = operators.
export const vendorLinkageSchemaSql = `
CREATE TABLE IF NOT EXISTS vendor_fingerprints (
  id TEXT PRIMARY KEY,
  vendor_slug TEXT NOT NULL,
  kind TEXT NOT NULL,          -- ga | gtm | fb | shopify | cert | ip
  value TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'live',
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_slug, kind, value)
);
CREATE INDEX IF NOT EXISTS idx_vendor_fp_value ON vendor_fingerprints(kind, value);

CREATE TABLE IF NOT EXISTS vendor_links (
  id TEXT PRIMARY KEY,
  vendor_slug TEXT NOT NULL,
  linked_slug TEXT NOT NULL,
  basis TEXT NOT NULL,         -- web-id | shared-lot | shared-source
  strength TEXT NOT NULL,      -- strong | info
  detail TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'live',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_slug, linked_slug, basis)
);
CREATE INDEX IF NOT EXISTS idx_vendor_links_vendor ON vendor_links(vendor_slug);
`;
