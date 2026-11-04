// Email-only update list. Deliberately holds NO compound, search, page or account data: an address,
// the consent that was shown, and when it was confirmed and last mailed. Unsubscribing deletes the row.
export const emailDigestSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS digest_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active')),
  consent_version TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirm_sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  last_digest_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS digest_subscribers_status_idx ON digest_subscribers(status, created_at);
CREATE TABLE IF NOT EXISTS digest_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
