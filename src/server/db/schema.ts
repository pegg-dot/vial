export const schemaSql = String.raw`
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  organization_type TEXT NOT NULL DEFAULT 'vendor',
  display_name TEXT NOT NULL,
  legal_name TEXT,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  domains JSONB NOT NULL DEFAULT '[]'::jsonb,
  profile_status TEXT NOT NULL DEFAULT 'unclaimed',
  participation_status TEXT NOT NULL DEFAULT 'independent',
  location TEXT,
  founded TEXT,
  description TEXT NOT NULL DEFAULT '',
  initials TEXT NOT NULL DEFAULT '',
  product_count INTEGER NOT NULL DEFAULT 0,
  documentation_current INTEGER NOT NULL DEFAULT 0,
  median_ship_days NUMERIC(8,2) NOT NULL DEFAULT 0,
  support_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  last_observed TEXT NOT NULL DEFAULT '',
  accent JSONB NOT NULL DEFAULT '[]'::jsonb,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compounds (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  canonical_name TEXT NOT NULL,
  shorthand TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  listing_count INTEGER NOT NULL DEFAULT 0,
  median_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_change NUMERIC(8,2) NOT NULL DEFAULT 0,
  documentation_coverage INTEGER NOT NULL DEFAULT 0,
  accent JSONB NOT NULL DEFAULT '[]'::jsonb,
  research_note TEXT NOT NULL DEFAULT '',
  sequence TEXT,
  molecular_formula TEXT,
  expected_mass NUMERIC(14,6),
  form_or_counterion TEXT,
  public_identifiers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  vendor_id TEXT NOT NULL REFERENCES organizations(id),
  compound_id TEXT NOT NULL REFERENCES compounds(id),
  name TEXT NOT NULL,
  declared_quantity TEXT NOT NULL,
  declared_form TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL REFERENCES products(id),
  price NUMERIC(12,2) NOT NULL,
  previous_price NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  availability TEXT NOT NULL,
  shipping_claim TEXT NOT NULL,
  evidence_level TEXT NOT NULL,
  evidence_label TEXT NOT NULL,
  report_date TEXT NOT NULL,
  report_issuer TEXT NOT NULL,
  report_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  batch_code TEXT NOT NULL,
  batch_linked BOOLEAN NOT NULL DEFAULT FALSE,
  sample_origin TEXT NOT NULL,
  last_checked TEXT NOT NULL,
  rating NUMERIC(8,2) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  checkout_mode TEXT NOT NULL DEFAULT 'information-only',
  price_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  accent JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_id TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  canonical_location TEXT NOT NULL UNIQUE,
  owner_organization_id TEXT REFERENCES organizations(id),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content_hash TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text/plain',
  fetch_status TEXT NOT NULL DEFAULT 'captured',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  UNIQUE(source_id, content_hash)
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  workflow TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  tool_budget INTEGER NOT NULL DEFAULT 0,
  proposed_changes INTEGER NOT NULL DEFAULT 0,
  published_changes INTEGER NOT NULL DEFAULT 0,
  blocked_reason TEXT,
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS evidence_claims (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  predicate TEXT NOT NULL,
  value_json JSONB NOT NULL,
  previous_value_json JSONB,
  unit TEXT,
  source_snapshot_id TEXT NOT NULL REFERENCES source_snapshots(id),
  agent_run_id TEXT NOT NULL REFERENCES agent_runs(id),
  extractor_version TEXT NOT NULL,
  model_confidence NUMERIC(5,4) NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'source-observed',
  review_status TEXT NOT NULL DEFAULT 'pending',
  risk_level TEXT NOT NULL DEFAULT 'standard',
  rationale TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS review_decisions (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES evidence_claims(id),
  reviewer_role TEXT NOT NULL,
  reviewer_label TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publication_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  published_claim_ids JSONB NOT NULL,
  before_json JSONB NOT NULL,
  after_json JSONB NOT NULL,
  supersedes_event_id TEXT,
  published_by TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, version)
);

CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_compound ON products(compound_id);
CREATE INDEX IF NOT EXISTS idx_listings_product ON listings(product_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_source ON source_snapshots(source_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_review ON evidence_claims(review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_subject ON evidence_claims(subject_type, subject_id, predicate);
CREATE INDEX IF NOT EXISTS idx_runs_started ON agent_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_calls_run ON tool_calls(run_id, started_at);
CREATE INDEX IF NOT EXISTS idx_publications_entity ON publication_events(entity_type, entity_id, version DESC);
ALTER TABLE publication_events ADD COLUMN IF NOT EXISTS root_event_id TEXT;

CREATE TABLE IF NOT EXISTS source_refresh_policies (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE REFERENCES sources(id) ON DELETE CASCADE,
  target_listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  transport TEXT NOT NULL DEFAULT 'http',
  parser_profile TEXT NOT NULL DEFAULT 'generic',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  interval_minutes INTEGER NOT NULL DEFAULT 360,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_started_at TIMESTAMPTZ,
  last_succeeded_at TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  timeout_ms INTEGER NOT NULL DEFAULT 10000,
  max_response_bytes INTEGER NOT NULL DEFAULT 1000000,
  allowed_content_types JSONB NOT NULL DEFAULT '["text/html","text/plain","application/json","application/ld+json"]'::jsonb,
  allowed_hostnames JSONB NOT NULL DEFAULT '[]'::jsonb,
  etag TEXT,
  last_modified TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_fixtures (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES source_refresh_policies(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text/html',
  raw_content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(policy_id, version)
);

CREATE TABLE IF NOT EXISTS refresh_jobs (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES source_refresh_policies(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'scheduled',
  trigger_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 100,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL DEFAULT 'scheduler',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES refresh_jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  http_status INTEGER,
  bytes_received INTEGER,
  resolved_ip TEXT,
  content_type TEXT,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(job_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS source_snapshot_diffs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  previous_snapshot_id TEXT REFERENCES source_snapshots(id),
  current_snapshot_id TEXT NOT NULL REFERENCES source_snapshots(id) ON DELETE CASCADE,
  changed BOOLEAN NOT NULL,
  added_lines INTEGER NOT NULL DEFAULT 0,
  removed_lines INTEGER NOT NULL DEFAULT 0,
  previous_hash TEXT,
  current_hash TEXT NOT NULL,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(current_snapshot_id)
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  root_event_id TEXT NOT NULL,
  parent_event_id TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  actor TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trace_edges (
  id TEXT PRIMARY KEY,
  root_event_id TEXT NOT NULL,
  from_event_id TEXT NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
  to_event_id TEXT NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_event_id, to_event_id, relation)
);

CREATE TABLE IF NOT EXISTS entity_metric_snapshots (
  id TEXT PRIMARY KEY,
  root_event_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  value_json JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  root_event_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunity_signals (
  id TEXT PRIMARY KEY,
  signal_key TEXT NOT NULL UNIQUE,
  root_event_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  score NUMERIC(8,4) NOT NULL DEFAULT 0,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_policies_due ON source_refresh_policies(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_refresh_jobs_queue ON refresh_jobs(status, available_at, priority);
CREATE INDEX IF NOT EXISTS idx_refresh_attempts_job ON refresh_attempts(job_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_snapshot_diffs_source ON source_snapshot_diffs(source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_root ON domain_events(root_event_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_domain_events_entity ON domain_events(entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_trace_edges_root ON trace_edges(root_event_id);
CREATE INDEX IF NOT EXISTS idx_metric_entity ON entity_metric_snapshots(entity_type, entity_id, metric_key, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_entity ON alert_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_root ON alert_events(root_event_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_status ON opportunity_signals(status, score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_entity ON opportunity_signals(entity_type, entity_id, signal_type);
`;

export const commerceSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS commerce_sellers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id),
  status TEXT NOT NULL DEFAULT 'sandbox_pending',
  processor_provider TEXT NOT NULL DEFAULT 'mock_connect',
  processor_account_id TEXT,
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  requirements_due JSONB NOT NULL DEFAULT '[]'::jsonb,
  agreement_version TEXT,
  agreement_accepted_at TIMESTAMPTZ,
  reserve_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_listing_eligibility (
  listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'information_only',
  processor_review_status TEXT NOT NULL DEFAULT 'not_submitted',
  legal_review_status TEXT NOT NULL DEFAULT 'not_reviewed',
  allowed_customer_types JSONB NOT NULL DEFAULT '["sandbox"]'::jsonb,
  allowed_jurisdictions JSONB NOT NULL DEFAULT '["US-SANDBOX"]'::jsonb,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  policy_version TEXT NOT NULL DEFAULT 'commerce-sandbox-v1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_carts (
  id TEXT PRIMARY KEY,
  customer_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  currency TEXT NOT NULL DEFAULT 'USD',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_cart_lines (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES commerce_carts(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 20),
  unit_price NUMERIC(12,2) NOT NULL,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cart_id, listing_id)
);
CREATE TABLE IF NOT EXISTS commerce_checkout_attempts (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES commerce_carts(id),
  status TEXT NOT NULL DEFAULT 'created',
  idempotency_key TEXT NOT NULL UNIQUE,
  processor_payment_id TEXT,
  customer_email TEXT NOT NULL,
  shipping_address JSONB NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  shipping_total NUMERIC(12,2) NOT NULL,
  platform_fee_total NUMERIC(12,2) NOT NULL,
  tax_total NUMERIC(12,2) NOT NULL,
  grand_total NUMERIC(12,2) NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS commerce_orders (
  id TEXT PRIMARY KEY,
  checkout_attempt_id TEXT NOT NULL UNIQUE REFERENCES commerce_checkout_attempts(id),
  customer_key TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(12,2) NOT NULL,
  shipping_total NUMERIC(12,2) NOT NULL,
  platform_fee_total NUMERIC(12,2) NOT NULL,
  tax_total NUMERIC(12,2) NOT NULL,
  grand_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),
  product_name TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  platform_fee NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  fulfillment_status TEXT NOT NULL DEFAULT 'pending',
  tracking_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id),
  amount NUMERIC(12,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sandbox_succeeded',
  processor_refund_id TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_disputes (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id),
  amount NUMERIC(12,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_response',
  evidence_due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_ledger_entries (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES commerce_orders(id),
  seller_id TEXT REFERENCES commerce_sellers(id),
  entry_type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  direction TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  root_event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'processed',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cart_customer ON commerce_carts(customer_key, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON commerce_orders(customer_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_lines_seller ON commerce_order_lines(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_order ON commerce_ledger_entries(order_id, created_at);
CREATE TABLE IF NOT EXISTS commerce_returns (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id),
  order_line_id TEXT REFERENCES commerce_order_lines(id),
  customer_key TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  resolution TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_shipments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id),
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),
  carrier TEXT,
  service TEXT,
  tracking_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_inventory (
  listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),
  available INTEGER NOT NULL DEFAULT 25 CHECK (available >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  reorder_point INTEGER NOT NULL DEFAULT 5,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_inventory_reservations (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES commerce_carts(id),
  listing_id TEXT NOT NULL REFERENCES listings(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cart_id, listing_id, status)
);
CREATE TABLE IF NOT EXISTS commerce_tax_calculations (
  id TEXT PRIMARY KEY,
  checkout_attempt_id TEXT REFERENCES commerce_checkout_attempts(id),
  provider TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  taxable_amount NUMERIC(12,2) NOT NULL,
  rate NUMERIC(8,6) NOT NULL,
  tax_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'estimated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_risk_assessments (
  id TEXT PRIMARY KEY,
  cart_id TEXT REFERENCES commerce_carts(id),
  checkout_attempt_id TEXT REFERENCES commerce_checkout_attempts(id),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  outcome TEXT NOT NULL,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider TEXT NOT NULL DEFAULT 'vial_rules_v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_reconciliation_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'running',
  provider TEXT NOT NULL,
  expected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  observed_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  variance NUMERIC(12,2) NOT NULL DEFAULT 0,
  issue_count INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS commerce_dispute_evidence (
  id TEXT PRIMARY KEY,
  dispute_id TEXT NOT NULL REFERENCES commerce_disputes(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  content TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commerce_payouts (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processor_payout_id TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_returns_order ON commerce_returns(order_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON commerce_shipments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_expiry ON commerce_inventory_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_risk_checkout ON commerce_risk_assessments(checkout_attempt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_started ON commerce_reconciliation_runs(started_at DESC);
`;

export const internalOpsSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS internal_users (id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,display_name TEXT NOT NULL,account_type TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',roles JSONB NOT NULL DEFAULT '[]'::jsonb,mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,last_login_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS internal_notifications (id TEXT PRIMARY KEY,user_id TEXT REFERENCES internal_users(id),channel TEXT NOT NULL DEFAULT 'in_app',category TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'unread',dedupe_key TEXT UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),read_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS support_cases (id TEXT PRIMARY KEY,requester_type TEXT NOT NULL,requester_label TEXT NOT NULL,order_id TEXT,seller_id TEXT,subject TEXT NOT NULL,category TEXT NOT NULL,priority TEXT NOT NULL DEFAULT 'normal',status TEXT NOT NULL DEFAULT 'open',assignee TEXT,sla_due_at TIMESTAMPTZ,resolution_code TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS marketplace_reviews (id TEXT PRIMARY KEY,listing_id TEXT REFERENCES listings(id),author_user_id TEXT REFERENCES internal_users(id),verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,product_rating INTEGER NOT NULL DEFAULT 0,shipping_rating INTEGER NOT NULL DEFAULT 0,documentation_rating INTEGER NOT NULL DEFAULT 0,body TEXT NOT NULL,moderation_status TEXT NOT NULL DEFAULT 'pending',seller_response TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS policy_versions (id TEXT PRIMARY KEY,version INTEGER UNIQUE NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',rules JSONB NOT NULL DEFAULT '{}'::jsonb,impact_summary JSONB NOT NULL DEFAULT '{}'::jsonb,created_by TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),activated_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS fraud_cases (id TEXT PRIMARY KEY,subject_type TEXT NOT NULL,subject_id TEXT NOT NULL,score INTEGER NOT NULL,severity TEXT NOT NULL,signals JSONB NOT NULL DEFAULT '[]'::jsonb,status TEXT NOT NULL DEFAULT 'open',analyst TEXT,decision TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS analytics_events (id TEXT PRIMARY KEY,event_name TEXT NOT NULL,actor_key TEXT NOT NULL,entity_type TEXT,entity_id TEXT,properties JSONB NOT NULL DEFAULT '{}'::jsonb,occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS feature_flags (id TEXT PRIMARY KEY,key TEXT UNIQUE NOT NULL,description TEXT NOT NULL,enabled BOOLEAN NOT NULL DEFAULT FALSE,rollout_percent INTEGER NOT NULL DEFAULT 0,audience JSONB NOT NULL DEFAULT '{}'::jsonb,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS agent_evaluations (id TEXT PRIMARY KEY,workflow TEXT NOT NULL,version TEXT NOT NULL,dataset TEXT NOT NULL,score NUMERIC(8,4) NOT NULL,pass BOOLEAN NOT NULL,failures JSONB NOT NULL DEFAULT '[]'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS privacy_requests (id TEXT PRIMARY KEY,user_id TEXT REFERENCES internal_users(id),request_type TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'received',due_at TIMESTAMPTZ NOT NULL,completed_at TIMESTAMPTZ,audit_notes TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS scenario_runs (id TEXT PRIMARY KEY,scenario_key TEXT NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'completed',inputs JSONB NOT NULL DEFAULT '{}'::jsonb,outputs JSONB NOT NULL DEFAULT '{}'::jsonb,root_event_id TEXT,created_by TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS seller_catalog_drafts (id TEXT PRIMARY KEY,seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),name TEXT NOT NULL,compound TEXT NOT NULL,quantity_label TEXT NOT NULL,price NUMERIC(12,2) NOT NULL,inventory INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'draft',evidence_status TEXT NOT NULL DEFAULT 'missing',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS seller_team_members (id TEXT PRIMARY KEY,seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),email TEXT NOT NULL,display_name TEXT NOT NULL,role TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'invited',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(seller_id,email));
`;
