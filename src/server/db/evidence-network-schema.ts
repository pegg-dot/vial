export const evidenceNetworkSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS laboratory_profiles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  legal_name TEXT,
  status TEXT NOT NULL DEFAULT 'sandbox',
  onboarding_status TEXT NOT NULL DEFAULT 'in_progress',
  accreditation_status TEXT NOT NULL DEFAULT 'unverified',
  accreditation_body TEXT,
  accreditation_number TEXT,
  accreditation_expires_at DATE,
  accreditation_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_system TEXT NOT NULL DEFAULT 'sandbox-quality-system',
  impartiality_statement TEXT NOT NULL DEFAULT '',
  website_url TEXT,
  contact_email TEXT,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  terms_version TEXT,
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laboratory_team_members (
  id TEXT PRIMARY KEY,
  laboratory_id TEXT NOT NULL REFERENCES laboratory_profiles(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES auth_users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(laboratory_id, email)
);

CREATE TABLE IF NOT EXISTS laboratory_onboarding_sessions (
  id TEXT PRIMARY KEY,
  laboratory_id TEXT NOT NULL REFERENCES laboratory_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  current_step TEXT NOT NULL DEFAULT 'identity',
  completion_percent INTEGER NOT NULL DEFAULT 0 CHECK (completion_percent BETWEEN 0 AND 100),
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);

CREATE TABLE IF NOT EXISTS laboratory_onboarding_steps (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES laboratory_onboarding_sessions(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  UNIQUE(session_id, step_key)
);

CREATE TABLE IF NOT EXISTS laboratory_methods (
  id TEXT PRIMARY KEY,
  laboratory_id TEXT NOT NULL REFERENCES laboratory_profiles(id) ON DELETE CASCADE,
  method_code TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  technique TEXT NOT NULL,
  analytes JSONB NOT NULL DEFAULT '[]'::jsonb,
  matrices JSONB NOT NULL DEFAULT '[]'::jsonb,
  dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_units JSONB NOT NULL DEFAULT '[]'::jsonb,
  limit_of_detection NUMERIC(18,8),
  limit_of_quantitation NUMERIC(18,8),
  uncertainty NUMERIC(18,8),
  validation_status TEXT NOT NULL DEFAULT 'draft',
  accreditation_covered BOOLEAN NOT NULL DEFAULT FALSE,
  standard_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  effective_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(laboratory_id, method_code, version)
);

CREATE TABLE IF NOT EXISTS testing_programs (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sponsor_type TEXT NOT NULL,
  sponsor_id TEXT,
  sampling_model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  subject_type TEXT NOT NULL,
  subject_id TEXT,
  target_sample_count INTEGER NOT NULL DEFAULT 1,
  collected_sample_count INTEGER NOT NULL DEFAULT 0,
  funding_target NUMERIC(12,2) NOT NULL DEFAULT 0,
  funding_collected NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  public_summary TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  root_event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laboratory_test_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  program_id TEXT REFERENCES testing_programs(id) ON DELETE SET NULL,
  laboratory_id TEXT NOT NULL REFERENCES laboratory_profiles(id),
  requester_type TEXT NOT NULL,
  requester_id TEXT,
  subject_type TEXT NOT NULL,
  subject_id TEXT,
  declared_batch_code TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  priority TEXT NOT NULL DEFAULT 'standard',
  requested_dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  method_assignments JSONB NOT NULL DEFAULT '[]'::jsonb,
  quoted_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  due_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  root_event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sample_kits (
  id TEXT PRIMARY KEY,
  test_order_id TEXT NOT NULL REFERENCES laboratory_test_orders(id) ON DELETE CASCADE,
  kit_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'prepared',
  tamper_seal_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions_version TEXT NOT NULL,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laboratory_samples (
  id TEXT PRIMARY KEY,
  test_order_id TEXT NOT NULL REFERENCES laboratory_test_orders(id) ON DELETE CASCADE,
  kit_id TEXT REFERENCES sample_kits(id) ON DELETE SET NULL,
  sample_code TEXT NOT NULL UNIQUE,
  blind_code TEXT UNIQUE,
  parent_sample_id TEXT REFERENCES laboratory_samples(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_entity_id TEXT,
  declared_batch_code TEXT,
  sampling_model TEXT NOT NULL,
  sample_condition TEXT NOT NULL DEFAULT 'unknown',
  seal_status TEXT NOT NULL DEFAULT 'unknown',
  storage_condition TEXT,
  quantity_received NUMERIC(18,6),
  quantity_unit TEXT,
  accession_status TEXT NOT NULL DEFAULT 'expected',
  accessioned_by TEXT,
  received_at TIMESTAMPTZ,
  disposition TEXT NOT NULL DEFAULT 'retain',
  root_event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sample_custody_events (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL REFERENCES laboratory_samples(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  location TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_event_hash TEXT,
  event_hash TEXT NOT NULL UNIQUE,
  root_event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sample_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS analytical_runs (
  id TEXT PRIMARY KEY,
  run_code TEXT NOT NULL UNIQUE,
  test_order_id TEXT NOT NULL REFERENCES laboratory_test_orders(id) ON DELETE CASCADE,
  sample_id TEXT NOT NULL REFERENCES laboratory_samples(id) ON DELETE CASCADE,
  method_id TEXT NOT NULL REFERENCES laboratory_methods(id),
  status TEXT NOT NULL DEFAULT 'planned',
  instrument_name TEXT,
  instrument_identifier TEXT,
  analyst_user_id TEXT REFERENCES auth_users(id) ON DELETE SET NULL,
  reviewer_user_id TEXT REFERENCES auth_users(id) ON DELETE SET NULL,
  raw_data_hash TEXT,
  system_suitability JSONB NOT NULL DEFAULT '{}'::jsonb,
  deviations JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytical_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES analytical_runs(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  analyte TEXT,
  result_type TEXT NOT NULL,
  value_numeric NUMERIC(20,8),
  value_text TEXT,
  unit TEXT,
  qualifier TEXT,
  specification JSONB NOT NULL DEFAULT '{}'::jsonb,
  conclusion TEXT NOT NULL DEFAULT 'unknown',
  uncertainty NUMERIC(20,8),
  limit_of_detection NUMERIC(20,8),
  limit_of_quantitation NUMERIC(20,8),
  review_status TEXT NOT NULL DEFAULT 'draft',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(run_id, dimension, analyte)
);

CREATE TABLE IF NOT EXISTS laboratory_reports (
  id TEXT PRIMARY KEY,
  laboratory_id TEXT NOT NULL REFERENCES laboratory_profiles(id),
  test_order_id TEXT NOT NULL REFERENCES laboratory_test_orders(id),
  sample_id TEXT NOT NULL REFERENCES laboratory_samples(id),
  report_number TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  public_summary TEXT NOT NULL DEFAULT '',
  result_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  method_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  signed_payload_hash TEXT,
  document_hash TEXT,
  issued_by TEXT,
  reviewed_by TEXT,
  issued_at TIMESTAMPTZ,
  supersedes_report_id TEXT REFERENCES laboratory_reports(id) ON DELETE SET NULL,
  correction_reason TEXT,
  revocation_reason TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(laboratory_id, report_number, version)
);

CREATE TABLE IF NOT EXISTS laboratory_report_events (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES laboratory_reports(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  reason TEXT,
  before_json JSONB,
  after_json JSONB,
  root_event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batch_passports (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  vendor_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  seller_batch_id TEXT REFERENCES seller_batches(id) ON DELETE SET NULL,
  declared_batch_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  sampling_level TEXT NOT NULL DEFAULT 'D0',
  evidence_confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  current_report_id TEXT REFERENCES laboratory_reports(id) ON DELETE SET NULL,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_evidence_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS passport_evidence_links (
  id TEXT PRIMARY KEY,
  passport_id TEXT NOT NULL REFERENCES batch_passports(id) ON DELETE CASCADE,
  report_id TEXT NOT NULL REFERENCES laboratory_reports(id) ON DELETE CASCADE,
  result_id TEXT REFERENCES analytical_results(id) ON DELETE SET NULL,
  relationship TEXT NOT NULL DEFAULT 'supports',
  status TEXT NOT NULL DEFAULT 'active',
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(passport_id, report_id, result_id)
);

CREATE TABLE IF NOT EXISTS evidence_conflicts (
  id TEXT PRIMARY KEY,
  passport_id TEXT NOT NULL REFERENCES batch_passports(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  left_result_id TEXT REFERENCES analytical_results(id) ON DELETE SET NULL,
  right_result_id TEXT REFERENCES analytical_results(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'review',
  status TEXT NOT NULL DEFAULT 'open',
  explanation TEXT NOT NULL,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laboratory_work_proposals (
  id TEXT PRIMARY KEY,
  laboratory_id TEXT NOT NULL REFERENCES laboratory_profiles(id) ON DELETE CASCADE,
  proposal_type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laboratory_api_tokens (
  id TEXT PRIMARY KEY,
  laboratory_id TEXT NOT NULL REFERENCES laboratory_profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_team_email ON laboratory_team_members(LOWER(email), status);
CREATE INDEX IF NOT EXISTS idx_lab_methods_scope ON laboratory_methods(laboratory_id, validation_status, accreditation_covered);
CREATE INDEX IF NOT EXISTS idx_test_orders_lab_status ON laboratory_test_orders(laboratory_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_samples_order ON laboratory_samples(test_order_id, accession_status);
CREATE INDEX IF NOT EXISTS idx_custody_sample_seq ON sample_custody_events(sample_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_runs_sample ON analytical_runs(sample_id, status);
CREATE INDEX IF NOT EXISTS idx_results_run ON analytical_results(run_id, review_status);
CREATE INDEX IF NOT EXISTS idx_reports_lab_status ON laboratory_reports(laboratory_id, status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_passports_batch ON batch_passports(declared_batch_code, status);
CREATE INDEX IF NOT EXISTS idx_passport_links_passport ON passport_evidence_links(passport_id, status);
CREATE INDEX IF NOT EXISTS idx_conflicts_passport ON evidence_conflicts(passport_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_proposals_status ON laboratory_work_proposals(laboratory_id,status,created_at DESC);
`;
