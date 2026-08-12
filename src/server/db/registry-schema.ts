export const registrySchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS registry_identifiers (
  registry_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  current_entity_id TEXT,
  display_name TEXT NOT NULL,
  canonical_slug TEXT NOT NULL,
  provenance_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  redirects_to TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_entity_type, source_entity_id)
);
CREATE TABLE IF NOT EXISTS registry_identifier_aliases (
  id TEXT PRIMARY KEY,
  registry_id TEXT NOT NULL REFERENCES registry_identifiers(registry_id) ON DELETE CASCADE ON UPDATE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  alias_type TEXT NOT NULL DEFAULT 'former-slug',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(registry_id, normalized_alias)
);
CREATE INDEX IF NOT EXISTS idx_registry_type ON registry_identifiers(entity_type, status);
CREATE INDEX IF NOT EXISTS idx_registry_slug ON registry_identifiers(canonical_slug);
CREATE INDEX IF NOT EXISTS idx_registry_current_entity ON registry_identifiers(current_entity_id);
CREATE INDEX IF NOT EXISTS idx_registry_alias_norm ON registry_identifier_aliases(normalized_alias);
`;
