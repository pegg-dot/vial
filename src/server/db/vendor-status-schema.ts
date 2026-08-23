// Migration 21 — vendor liveness / exit-scam status.
//
// The clearest exit-scam tell is operational: the storefront goes dark, starts redirecting
// elsewhere, or turns into a parked "domain for sale" page while (in the classic version) still
// taking money by email. This records the result of probing each vendor's domain — is the site
// still up, still a real storefront, or gone — so a buyer sees "operating" vs "offline / possible
// exit scam" before they send money to a vendor that has quietly vanished.
export const vendorStatusSchemaSql = `
CREATE TABLE IF NOT EXISTS vendor_status (
  id TEXT PRIMARY KEY,
  vendor_slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,          -- operating | offline | redirected | parked | blocked | unknown
  http_code INTEGER,
  redirect_host TEXT,            -- when status='redirected', where it now points
  detail TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'live',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- How many consecutive checks have found this storefront not operating. One failed request is a
-- timeout, the same answer twice is a storefront that is actually gone. Without this the table
-- keeps only the latest probe, so a lone network blip was the whole evidence base for a verdict.
-- NOTE no semicolons in this comment: exec() splits schema SQL on them and would cut it in half.
ALTER TABLE vendor_status ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_vendor_status_vendor ON vendor_status(vendor_slug);
`;
