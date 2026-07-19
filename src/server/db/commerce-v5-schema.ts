export const commerceV5SchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS commerce_provider_accounts (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL UNIQUE REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'sandbox',
  provider_account_id TEXT NOT NULL,
  account_configuration TEXT NOT NULL DEFAULT 'seller_merchant',
  merchant_of_record TEXT NOT NULL DEFAULT 'seller',
  fees_collector TEXT NOT NULL DEFAULT 'platform',
  losses_collector TEXT NOT NULL DEFAULT 'platform',
  onboarding_type TEXT NOT NULL DEFAULT 'hosted',
  country TEXT NOT NULL DEFAULT 'US',
  default_currency TEXT NOT NULL DEFAULT 'USD',
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  transfers_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  underwriting_status TEXT NOT NULL DEFAULT 'not_submitted',
  risk_tier TEXT NOT NULL DEFAULT 'unrated',
  requirements_currently_due JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements_eventually_due JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements_past_due JSONB NOT NULL DEFAULT '[]'::jsonb,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  disabled_reason TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_provider_onboarding_sessions (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  provider_account_id TEXT NOT NULL REFERENCES commerce_provider_accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  onboarding_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  provider_session_id TEXT,
  url TEXT,
  collection_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_activation_policies (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS commerce_activation_decisions (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  seller_id TEXT REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  listing_id TEXT REFERENCES listings(id) ON DELETE CASCADE,
  customer_type TEXT NOT NULL DEFAULT 'sandbox_customer',
  jurisdiction TEXT NOT NULL DEFAULT 'US-SANDBOX',
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  decision TEXT NOT NULL,
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  policy_version TEXT NOT NULL,
  root_event_id TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_provider_payment_intents (
  id TEXT PRIMARY KEY,
  checkout_attempt_id TEXT UNIQUE REFERENCES commerce_checkout_attempts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL UNIQUE,
  provider_account_id TEXT,
  charge_model TEXT NOT NULL,
  merchant_of_record TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  application_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  transfer_group TEXT,
  status TEXT NOT NULL,
  client_secret_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_provider_transfers (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  provider_transfer_id TEXT NOT NULL UNIQUE,
  source_payment_id TEXT,
  transfer_group TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_reserve_holds (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES commerce_orders(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),
  amount NUMERIC(12,2) NOT NULL,
  reserve_percent NUMERIC(6,3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'held',
  reason TEXT NOT NULL,
  release_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_tax_transactions (
  id TEXT PRIMARY KEY,
  checkout_attempt_id TEXT REFERENCES commerce_checkout_attempts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  liable_party TEXT NOT NULL,
  seller_id TEXT REFERENCES commerce_sellers(id),
  jurisdiction TEXT NOT NULL,
  taxable_amount NUMERIC(12,2) NOT NULL,
  tax_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,
  provider_reference TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_fraud_decisions (
  id TEXT PRIMARY KEY,
  cart_id TEXT REFERENCES commerce_carts(id),
  checkout_attempt_id TEXT REFERENCES commerce_checkout_attempts(id),
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  outcome TEXT NOT NULL,
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider_reference TEXT,
  rule_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_fulfillment_quotes (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES commerce_carts(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),
  provider TEXT NOT NULL,
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  eta_min_days INTEGER,
  eta_max_days INTEGER,
  status TEXT NOT NULL DEFAULT 'quoted',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_settlement_runs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  dispute_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reserve_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  seller_payable NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  variance NUMERIC(12,2) NOT NULL DEFAULT 0,
  issue_count INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS commerce_underwriting_reviews (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id) ON DELETE CASCADE,
  provider_account_id TEXT REFERENCES commerce_provider_accounts(id) ON DELETE SET NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  catalog_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  jurisdictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_notes TEXT NOT NULL DEFAULT '',
  requested_by TEXT NOT NULL,
  reviewed_by TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

ALTER TABLE commerce_checkout_attempts ADD COLUMN IF NOT EXISTS commerce_mode TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE commerce_checkout_attempts ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mock_connect';
ALTER TABLE commerce_checkout_attempts ADD COLUMN IF NOT EXISTS activation_decision_id TEXT REFERENCES commerce_activation_decisions(id);
ALTER TABLE commerce_checkout_attempts ADD COLUMN IF NOT EXISTS payment_intent_id TEXT REFERENCES commerce_provider_payment_intents(id);
ALTER TABLE commerce_checkout_attempts ADD COLUMN IF NOT EXISTS tax_transaction_id TEXT REFERENCES commerce_tax_transactions(id);
ALTER TABLE commerce_checkout_attempts ADD COLUMN IF NOT EXISTS fraud_decision_id TEXT REFERENCES commerce_fraud_decisions(id);
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mock_connect';
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS commerce_mode TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS merchant_of_record TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS charge_model TEXT NOT NULL DEFAULT 'platform_separate';
ALTER TABLE commerce_refunds ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mock_connect';
ALTER TABLE commerce_refunds ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE commerce_disputes ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mock_connect';
ALTER TABLE commerce_disputes ADD COLUMN IF NOT EXISTS provider_dispute_id TEXT;
ALTER TABLE commerce_disputes ADD COLUMN IF NOT EXISTS liability TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE commerce_webhook_events ADD COLUMN IF NOT EXISTS signature_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE commerce_webhook_events ADD COLUMN IF NOT EXISTS livemode BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE commerce_webhook_events ADD COLUMN IF NOT EXISTS connected_account_id TEXT;
ALTER TABLE commerce_webhook_events ADD COLUMN IF NOT EXISTS api_version TEXT;
ALTER TABLE commerce_webhook_events ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE commerce_payouts ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mock_connect';
ALTER TABLE commerce_payouts ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE commerce_payouts ADD COLUMN IF NOT EXISTS settlement_run_id TEXT REFERENCES commerce_settlement_runs(id);

CREATE INDEX IF NOT EXISTS idx_provider_accounts_status ON commerce_provider_accounts(mode, underwriting_status, charges_enabled, payouts_enabled);
CREATE INDEX IF NOT EXISTS idx_activation_decisions_subject ON commerce_activation_decisions(subject_type, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON commerce_provider_payment_intents(provider, mode, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_order ON commerce_provider_transfers(order_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_reserves_seller ON commerce_reserve_holds(seller_id, status, release_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reserves_order_seller_unique ON commerce_reserve_holds(order_id, seller_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tax_checkout ON commerce_tax_transactions(checkout_attempt_id);
CREATE INDEX IF NOT EXISTS idx_fraud_checkout_v5 ON commerce_fraud_decisions(checkout_attempt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_period ON commerce_settlement_runs(provider, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_underwriting_seller ON commerce_underwriting_reviews(seller_id, requested_at DESC);
`;
