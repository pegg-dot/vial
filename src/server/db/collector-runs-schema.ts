// One row per collector run against one target (a vendor host, the Janoshik feed, etc.), recording
// how many items it yielded and whether it succeeded. Comparing a target's latest run to its history
// is how we catch a collector that silently broke — yielded data before, yields none now.
export const collectorRunsSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS collector_runs (
  id TEXT PRIMARY KEY,
  collector TEXT NOT NULL,
  target TEXT NOT NULL,
  items INTEGER NOT NULL DEFAULT 0,
  ok BOOLEAN NOT NULL DEFAULT TRUE,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_collector_runs_key ON collector_runs(collector, target, ran_at DESC);
`;
