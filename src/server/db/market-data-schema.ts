export const marketDataSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS canonical_entities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_entity_type TEXT,
  source_entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_type, canonical_key)
);
CREATE TABLE IF NOT EXISTS entity_aliases (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  alias_type TEXT NOT NULL DEFAULT 'common',
  source TEXT NOT NULL DEFAULT 'curated',
  confidence NUMERIC(5,4) NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_id, normalized_alias)
);
CREATE TABLE IF NOT EXISTS entity_relationships (
  id TEXT PRIMARY KEY,
  from_entity_id TEXT NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  to_entity_id TEXT NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'confirmed',
  source_claim_id TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_entity_id, relation_type, to_entity_id)
);
CREATE TABLE IF NOT EXISTS entity_resolution_cases (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  raw_label TEXT NOT NULL,
  normalized_label TEXT NOT NULL,
  candidate_entity_id TEXT REFERENCES canonical_entities(id),
  match_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  match_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS source_pilots (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE REFERENCES sources(id) ON DELETE CASCADE,
  program_status TEXT NOT NULL DEFAULT 'sandbox',
  legal_scope TEXT NOT NULL DEFAULT 'fictional-fixture-only',
  parser_contract_id TEXT,
  reviewer_owner TEXT,
  freshness_slo_minutes INTEGER NOT NULL DEFAULT 1440,
  reliability_target NUMERIC(5,4) NOT NULL DEFAULT 0.98,
  promotion_gate JSONB NOT NULL DEFAULT '{}'::jsonb,
  promoted_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS parser_contracts (
  id TEXT PRIMARY KEY,
  profile_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  extractor_version TEXT NOT NULL,
  claim_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  UNIQUE(profile_key, version)
);
CREATE TABLE IF NOT EXISTS benchmark_datasets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  profile_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_key, version)
);
CREATE TABLE IF NOT EXISTS benchmark_examples (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES benchmark_datasets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  content_type TEXT NOT NULL,
  input_content TEXT NOT NULL,
  expected_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_entity_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  edge_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES benchmark_datasets(id) ON DELETE CASCADE,
  parser_contract_id TEXT NOT NULL REFERENCES parser_contracts(id),
  status TEXT NOT NULL,
  precision NUMERIC(7,6) NOT NULL DEFAULT 0,
  recall NUMERIC(7,6) NOT NULL DEFAULT 0,
  f1 NUMERIC(7,6) NOT NULL DEFAULT 0,
  field_accuracy NUMERIC(7,6) NOT NULL DEFAULT 0,
  false_positives INTEGER NOT NULL DEFAULT 0,
  false_negatives INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS confidence_models (
  id TEXT PRIMARY KEY,
  model_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  calibration_bins JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_calibration_error NUMERIC(7,6) NOT NULL DEFAULT 0,
  sample_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(model_key, version)
);
CREATE TABLE IF NOT EXISTS correction_feedback (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  claim_id TEXT,
  correction_type TEXT NOT NULL,
  previous_value JSONB,
  corrected_value JSONB,
  reason TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  impact TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'accepted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS source_reliability_snapshots (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  window_label TEXT NOT NULL,
  fetch_success_rate NUMERIC(7,6) NOT NULL DEFAULT 0,
  extraction_precision NUMERIC(7,6) NOT NULL DEFAULT 0,
  correction_rate NUMERIC(7,6) NOT NULL DEFAULT 0,
  median_latency_ms INTEGER NOT NULL DEFAULT 0,
  reliability_score NUMERIC(7,6) NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS freshness_policies (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  predicate TEXT NOT NULL,
  warning_age_minutes INTEGER NOT NULL,
  stale_age_minutes INTEGER NOT NULL,
  critical_age_minutes INTEGER NOT NULL,
  policy_version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(subject_type, predicate, policy_version)
);
CREATE TABLE IF NOT EXISTS data_freshness_status (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  predicate TEXT NOT NULL,
  source_id TEXT REFERENCES sources(id),
  last_verified_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'unknown',
  age_minutes INTEGER NOT NULL DEFAULT 0,
  policy_id TEXT REFERENCES freshness_policies(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subject_type, subject_id, predicate)
);
CREATE TABLE IF NOT EXISTS search_synonyms (
  id TEXT PRIMARY KEY,
  canonical_term TEXT NOT NULL,
  synonym TEXT NOT NULL,
  normalized_synonym TEXT NOT NULL,
  entity_type TEXT,
  weight NUMERIC(5,4) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(normalized_synonym, entity_type)
);
CREATE TABLE IF NOT EXISTS search_documents (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  facets JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_text TEXT NOT NULL,
  popularity_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  quality_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_type, entity_id)
);
CREATE TABLE IF NOT EXISTS search_query_logs (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  actor_key TEXT NOT NULL DEFAULT 'anonymous',
  result_count INTEGER NOT NULL DEFAULT 0,
  clicked_entity_type TEXT,
  clicked_entity_id TEXT,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  zero_result BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS search_evaluations (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  expected_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  actual_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  reciprocal_rank NUMERIC(7,6) NOT NULL DEFAULT 0,
  recall_at_five NUMERIC(7,6) NOT NULL DEFAULT 0,
  pass BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_canonical_entities_type_name ON canonical_entities(entity_type, normalized_name);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_normalized ON entity_aliases(normalized_alias);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_from ON entity_relationships(from_entity_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_to ON entity_relationships(to_entity_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_resolution_status ON entity_resolution_cases(status, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_created ON benchmark_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_created ON correction_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reliability_source ON source_reliability_snapshots(source_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_freshness_status ON data_freshness_status(status, next_due_at);
CREATE INDEX IF NOT EXISTS idx_search_documents_type ON search_documents(entity_type, quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_created ON search_query_logs(created_at DESC);
`;
