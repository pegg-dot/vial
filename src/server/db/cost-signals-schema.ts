// A daily counter for operations that are supposed to be RARE.
//
// The database quota was exhausted because nothing was cached: every page view read the whole
// catalog, and the only symptom was the site dying two weeks later. Caching fixed it — but caching
// is exactly the kind of thing a future edit breaks silently. Someone adds `force-dynamic` to a
// layout, or a new page calls the uncached path, and everything still WORKS. It just quietly costs
// a hundred times more until the bill or the quota says so.
//
// So the expensive paths count themselves. A catalog snapshot computation is meant to happen a
// handful of times a day; if it starts happening thousands of times, the cache is broken and the
// daily check says so while it is still cheap to fix.
//
// One upsert per expensive operation is deliberate: it is only written when the costly thing has
// already happened, so it can never be a meaningful cost of its own.
export const costSignalsSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS cost_signals (
  day DATE NOT NULL,
  metric TEXT NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric)
);
CREATE INDEX IF NOT EXISTS idx_cost_signals_day ON cost_signals(day DESC);
`;
