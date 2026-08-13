// The work queue behind continuous collection.
//
// Collection used to be a laptop operation: a human ran scripts/ingest-market.mjs against a
// database whose credentials they held. That is why production data went a week stale. This table
// turns it into a queue the deployment itself drains — one row per (collector, target), each with
// its own cadence and its own failure state, so a single vendor blocking us can never stall the
// rest and a run interrupted by a function timeout simply resumes on the next tick.
export const collectionTargetsSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS collection_targets (
  id TEXT PRIMARY KEY,
  collector TEXT NOT NULL,
  target TEXT NOT NULL,
  cadence_minutes INTEGER NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  next_due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at TIMESTAMPTZ,
  last_ok BOOLEAN,
  last_items INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(collector, target)
);
CREATE INDEX IF NOT EXISTS idx_collection_targets_due ON collection_targets(enabled, next_due_at);
`;
