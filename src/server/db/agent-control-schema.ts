export const agentControlSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS agent_prompts (
  id TEXT PRIMARY KEY,
  prompt_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  UNIQUE(prompt_key, version)
);
CREATE TABLE IF NOT EXISTS extraction_benchmark_runs (
  id TEXT PRIMARY KEY,
  extractor_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'n/a',
  dataset_version TEXT NOT NULL,
  precision NUMERIC(6,4) NOT NULL,
  recall NUMERIC(6,4) NOT NULL,
  f1 NUMERIC(6,4) NOT NULL,
  abstention_correct_rate NUMERIC(6,4) NOT NULL,
  total_cost_cents NUMERIC(12,6) NOT NULL DEFAULT 0,
  case_count INTEGER NOT NULL,
  true_positives INTEGER NOT NULL,
  false_positives INTEGER NOT NULL,
  false_negatives INTEGER NOT NULL,
  is_baseline BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS extraction_benchmark_case_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES extraction_benchmark_runs(id) ON DELETE CASCADE,
  case_name TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  true_positives INTEGER NOT NULL,
  false_positives INTEGER NOT NULL,
  false_negatives INTEGER NOT NULL,
  correct_abstention BOOLEAN NOT NULL,
  predicted_json JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE IF NOT EXISTS extraction_shadow_runs (
  id TEXT PRIMARY KEY,
  agent_run_id TEXT,
  model_extractor_version TEXT NOT NULL,
  deterministic_claims_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_claims_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  agreement_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  cost_cents NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS extractor_activations (
  id TEXT PRIMARY KEY,
  extractor_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'n/a',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT NOT NULL DEFAULT '',
  activated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
