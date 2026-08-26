export const consumerIntelligenceSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS user_market_preferences (
  user_id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  price_floor NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_ceiling NUMERIC(12,2) NOT NULL DEFAULT 500,
  max_shipping_days INTEGER NOT NULL DEFAULT 7,
  evidence_priorities JSONB NOT NULL DEFAULT '["batch_linkage","report_confirmation","freshness"]'::jsonb,
  required_evidence_levels JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_vendor_slugs JSONB NOT NULL DEFAULT '[]'::jsonb,
  hidden_vendor_slugs JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_compound_slugs JSONB NOT NULL DEFAULT '[]'::jsonb,
  home_view TEXT NOT NULL DEFAULT 'balanced',
  personalization_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  alert_mode TEXT NOT NULL DEFAULT 'important',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_result_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS comparison_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Current comparison',
  listing_slugs JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comparison_default_user ON comparison_sessions(user_id) WHERE is_default=TRUE;

CREATE TABLE IF NOT EXISTS entity_follows (
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, entity_type, entity_slug)
);

CREATE TABLE IF NOT EXISTS decision_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_change_summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  relevance_score NUMERIC(7,4) NOT NULL DEFAULT 0,
  dedupe_key TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  UNIQUE(user_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_href TEXT,
  relevance_score NUMERIC(7,4) NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'unread',
  dedupe_key TEXT NOT NULL,
  deliver_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  UNIQUE(user_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS user_visit_state (
  user_id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  previous_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_home_seen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS saved_search_alerts BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS followed_entity_alerts BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS market_digest BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT NOT NULL DEFAULT '22:00';
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS relevance_threshold NUMERIC(5,4) NOT NULL DEFAULT 0.45;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS availability_alerts BOOLEAN NOT NULL DEFAULT TRUE;
-- When this notification's push actually went out. NULL means it never has.
--
-- Gating push on "was this row just INSERTED" looked equivalent and is not: a notification first
-- written during quiet hours is inserted with push withheld, and every later tick then sees it as
-- an update and never pushes it at all. Deferral has to be recoverable, so the ledger records
-- delivery rather than novelty.
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ;
-- When the scheduled sweep last CONSIDERED this reader, which is not the same as when it last had
-- something to tell them. Ordering the queue by their newest notification meant a reader with
-- nothing to report never advanced, sat at the head of the queue forever, and starved everyone
-- behind the per-tick cap — the exact failure the sweep's own comment claimed to prevent.
ALTER TABLE user_visit_state ADD COLUMN IF NOT EXISTS notification_swept_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_comparisons_user ON comparison_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_user ON entity_follows(user_id, entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_events_user ON decision_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_summaries_user ON market_change_summaries(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id, status, relevance_score DESC, created_at DESC);
`;
