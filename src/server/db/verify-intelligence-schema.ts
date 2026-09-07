// The two things /verify needed storage for: not repeating outbound work, and remembering what
// people asked.
//
// /verify held nothing at all. A query for a domain we do not track ran three requests against
// other people's servers — an RDAP registry lookup, a Reddit search, a COA index check — and threw
// the answers away, so two readers checking the same scam domain paid for it twice and the registry
// was asked twice. Nothing was recorded either, which meant the single clearest demand signal the
// product generates (which untracked vendors buyers are worried about) was discarded on every call.
//
// Both tables are deliberately small and deliberately not personal. The cache stores the RAW FACT a
// probe returned, never a rendered verdict, so a cached answer still composes against today's
// database rather than serving yesterday's conclusion. The query log stores what was typed and how
// it classified, and no request context whatsoever — no address, no session, no agent, nothing that
// joins a query back to a person.
export const verifyIntelligenceSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS verify_probe_cache (
  probe TEXT NOT NULL,
  probe_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (probe, probe_key)
);
CREATE INDEX IF NOT EXISTS idx_verify_probe_cache_expiry ON verify_probe_cache(expires_at);

CREATE TABLE IF NOT EXISTS verify_queries (
  normalized TEXT PRIMARY KEY,
  display TEXT NOT NULL,
  kind TEXT NOT NULL,
  last_verdict TEXT NOT NULL,
  checks INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verify_queries_demand ON verify_queries(kind, checks DESC);
CREATE INDEX IF NOT EXISTS idx_verify_queries_recent ON verify_queries(last_seen_at DESC);
`;
