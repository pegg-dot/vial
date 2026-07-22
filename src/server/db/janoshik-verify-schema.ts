// Live re-verification against Janoshik's public test database (public.janoshik.com).
//
// Our COAs were ingested from a snapshot of that public feed; the snapshot ages. Re-checking the
// LIVE portal tells us whether each certificate is STILL publicly listed by the lab — a cert that
// gets pulled (vendor stopped paying, or the lab delisted it) flips janoshik_listed to false, which
// is a real trust change over time. This is a liveness/freshness signal, not independent
// corroboration (same source), and is surfaced honestly as "still publicly listed".
export const janoshikVerifySchemaSql = `
ALTER TABLE lab_test_records ADD COLUMN IF NOT EXISTS janoshik_listed BOOLEAN;
ALTER TABLE lab_test_records ADD COLUMN IF NOT EXISTS janoshik_made_by TEXT;
ALTER TABLE lab_test_records ADD COLUMN IF NOT EXISTS janoshik_checked_at TIMESTAMPTZ;
`;
