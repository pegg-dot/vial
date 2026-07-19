export const sellerOpsSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS seller_profiles (
  seller_id TEXT PRIMARY KEY REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  website_url TEXT,
  country_code TEXT NOT NULL DEFAULT 'US',
  business_type TEXT NOT NULL DEFAULT 'company',
  support_email TEXT,
  support_phone TEXT,
  shipping_origin JSONB NOT NULL DEFAULT '{}'::jsonb,
  returns_policy TEXT NOT NULL DEFAULT '',
  fulfillment_sla_hours INTEGER NOT NULL DEFAULT 48,
  onboarding_status TEXT NOT NULL DEFAULT 'not_started',
  readiness_state TEXT NOT NULL DEFAULT 'blocked',
  terms_version TEXT,
  terms_accepted_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_onboarding_sessions (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  current_step TEXT NOT NULL DEFAULT 'business',
  completion_percent INTEGER NOT NULL DEFAULT 0 CHECK (completion_percent >= 0 AND completion_percent <= 100),
  source TEXT NOT NULL DEFAULT 'self_serve',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_onboarding_active
  ON seller_onboarding_sessions(seller_id)
  WHERE status IN ('in_progress','submitted','changes_requested');

CREATE TABLE IF NOT EXISTS seller_onboarding_steps (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES seller_onboarding_sessions(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, step_key)
);

CREATE TABLE IF NOT EXISTS seller_integrations (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  connection_mode TEXT NOT NULL DEFAULT 'sandbox',
  external_account_id TEXT,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_reference TEXT,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(seller_id, provider)
);

CREATE TABLE IF NOT EXISTS seller_sync_runs (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES seller_integrations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'inbound',
  status TEXT NOT NULL DEFAULT 'queued',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  idempotency_key TEXT NOT NULL UNIQUE,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS seller_import_jobs (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  integration_id TEXT REFERENCES seller_integrations(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  payload_hash TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(seller_id, payload_hash)
);

CREATE TABLE IF NOT EXISTS seller_import_rows (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES seller_import_jobs(id) ON DELETE CASCADE,
  external_id TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  match_status TEXT NOT NULL DEFAULT 'unmatched',
  canonical_compound_id TEXT REFERENCES canonical_entities(id),
  match_score NUMERIC(6,5),
  match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected BOOLEAN NOT NULL DEFAULT TRUE,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_products (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  external_id TEXT,
  source_provider TEXT NOT NULL DEFAULT 'manual',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  compound_entity_id TEXT REFERENCES canonical_entities(id),
  quantity_label TEXT NOT NULL DEFAULT '',
  form_label TEXT NOT NULL DEFAULT 'lyophilized powder',
  sku TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  inventory INTEGER NOT NULL DEFAULT 0 CHECK (inventory >= 0),
  status TEXT NOT NULL DEFAULT 'draft',
  match_confidence NUMERIC(6,5),
  listing_id TEXT REFERENCES listings(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(seller_id, source_provider, external_id)
);

CREATE TABLE IF NOT EXISTS seller_batches (
  id TEXT PRIMARY KEY,
  seller_product_id TEXT NOT NULL REFERENCES seller_products(id) ON DELETE CASCADE,
  batch_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  production_date DATE,
  expiration_date DATE,
  quantity_available INTEGER NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(seller_product_id, batch_code)
);

CREATE TABLE IF NOT EXISTS seller_evidence_documents (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'coa',
  issuer TEXT,
  report_identifier TEXT,
  report_date DATE,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'uploaded',
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(seller_id, file_hash)
);

CREATE TABLE IF NOT EXISTS seller_evidence_links (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES seller_evidence_documents(id) ON DELETE CASCADE,
  seller_product_id TEXT REFERENCES seller_products(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES seller_batches(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'supports',
  confidence NUMERIC(6,5) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed',
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_inventory_events (
  id TEXT PRIMARY KEY,
  seller_product_id TEXT NOT NULL REFERENCES seller_products(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  delta INTEGER NOT NULL,
  resulting_quantity INTEGER NOT NULL CHECK (resulting_quantity >= 0),
  source TEXT NOT NULL DEFAULT 'manual',
  idempotency_key TEXT NOT NULL UNIQUE,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_readiness_snapshots (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  overall_state TEXT NOT NULL,
  completion_percent INTEGER NOT NULL CHECK (completion_percent >= 0 AND completion_percent <= 100),
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_api_tokens (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_webhook_endpoints (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  secret_prefix TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  last_delivery_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_webhook_deliveries (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL REFERENCES seller_webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  response_status INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  UNIQUE(endpoint_id, event_id)
);

CREATE TABLE IF NOT EXISTS seller_analytics_daily (
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  listing_views INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  comparison_adds INTEGER NOT NULL DEFAULT 0,
  carts INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  gross_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_rate NUMERIC(8,5) NOT NULL DEFAULT 0,
  evidence_coverage NUMERIC(8,5) NOT NULL DEFAULT 0,
  fulfillment_on_time_rate NUMERIC(8,5) NOT NULL DEFAULT 0,
  PRIMARY KEY(seller_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_seller_steps_session ON seller_onboarding_steps(session_id, step_key);
CREATE INDEX IF NOT EXISTS idx_seller_integrations_seller ON seller_integrations(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_seller_sync_integration ON seller_sync_runs(integration_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_import_rows_job ON seller_import_rows(job_id, match_status);
CREATE INDEX IF NOT EXISTS idx_seller_products_seller ON seller_products(seller_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_batches_product ON seller_batches(seller_product_id, status);
CREATE INDEX IF NOT EXISTS idx_seller_evidence_seller ON seller_evidence_documents(seller_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_evidence_links_product ON seller_evidence_links(seller_product_id, status);
CREATE INDEX IF NOT EXISTS idx_seller_readiness_seller ON seller_readiness_snapshots(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_tokens_seller ON seller_api_tokens(seller_id, revoked_at);
`;
