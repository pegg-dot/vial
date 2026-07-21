// Migration 14 — data provenance origin flag.
//
// Until now every catalog/evidence record was demo/fictional, and that fact was
// asserted only in hardcoded UI copy. The moment real ingested data lands beside
// the demo seed, a global "everything here is fictional" banner becomes a lie and
// (worse) real third-party data could masquerade as verified. This column is the
// single source of truth that lets the UI mark each record honestly:
//   'demo' — seeded fictional data (the default; unchanged behavior)
//   'live' — aggregated from a real public third-party source, marked as such
//
// It never implies endorsement or human-use safety — it only states provenance.
export const dataOriginSchemaSql = `
ALTER TABLE organizations   ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE compounds        ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE products         ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE listings         ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE sources          ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'demo';

-- The real vendor's own product-page / storefront URL. sources.canonical_location
-- already holds the observed URL, but a listing needs a stable outbound target for
-- the (still-inert) affiliate hand-off without joining through the source graph.
ALTER TABLE listings         ADD COLUMN IF NOT EXISTS external_url TEXT;

CREATE INDEX IF NOT EXISTS idx_listings_origin ON listings(origin);
CREATE INDEX IF NOT EXISTS idx_organizations_origin ON organizations(origin);
`;
