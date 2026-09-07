import { getDatabase } from "@/server/db/client";

// Memoises the outbound probes /verify makes, so the same question is not asked of somebody else's
// server twice.
//
// Two rules make this safe to put in front of a trust verdict:
//
//   1. What is cached is the RAW FACT the probe returned — a registration date, a count of posts —
//      never a rendered verdict. A domain registered on a given day is registered on that day
//      forever; "registered 89 days ago" stops being true tomorrow. Caching the fact and computing
//      the age on every read means a cached probe still composes against today, which is the whole
//      reason the age threshold can be trusted at all.
//   2. A probe that FAILED caches briefly and a probe that succeeded caches for a long time. RDAP
//      being down for a minute must not pin "registration lookup unavailable" to a domain for a
//      month — and that asymmetry is the difference between a cache and a memory of an outage.
//
// The cache is never load-bearing: every read and write is wrapped, and a database that will not
// answer degrades to running the probe, exactly as before this file existed.

export interface ProbeTtl {
  /** Seconds to keep an answer the probe actually produced. */
  okSeconds: number;
  /** Seconds to keep a failure, so an outage cannot masquerade as a finding. */
  failSeconds: number;
}

export interface ProbeOutcome<T> {
  value: T;
  /** False when the probe could not reach its source. Selects the short TTL. */
  ok: boolean;
}

async function readCache<T>(probe: string, key: string): Promise<T | undefined> {
  try {
    const db = await getDatabase();
    const r = await db.query<{ payload: unknown }>(
      `SELECT payload FROM verify_probe_cache WHERE probe = $1 AND probe_key = $2 AND expires_at > NOW()`,
      [probe, key],
    );
    const row = r.rows[0];
    if (!row) return undefined;
    const payload = typeof row.payload === "string" ? (JSON.parse(row.payload) as { value: T }) : (row.payload as { value: T });
    return payload?.value;
  } catch {
    return undefined;
  }
}

async function writeCache(probe: string, key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const db = await getDatabase();
    await db.query(
      `INSERT INTO verify_probe_cache (probe, probe_key, payload, fetched_at, expires_at)
       VALUES ($1, $2, $3::jsonb, NOW(), NOW() + ($4 || ' seconds')::interval)
       ON CONFLICT (probe, probe_key) DO UPDATE
         SET payload = EXCLUDED.payload, fetched_at = NOW(), expires_at = EXCLUDED.expires_at`,
      [probe, key, JSON.stringify({ value }), String(Math.max(1, Math.floor(ttlSeconds)))],
    );
  } catch {
    // A cache that cannot be written is a cache miss next time, which is correct and harmless.
  }
}

/**
 * Run `probeFn` unless a fresh answer is already stored for this key.
 *
 * `key` must identify the QUESTION, not the query that prompted it: two readers asking about the
 * same domain are asking the same question and should cost one lookup between them.
 */
export async function withProbeCache<T>(
  probe: string,
  key: string,
  ttl: ProbeTtl,
  probeFn: () => Promise<ProbeOutcome<T>>,
): Promise<T> {
  const normalizedKey = key.trim().toLowerCase();
  if (!normalizedKey) return (await probeFn()).value;

  const hit = await readCache<T>(probe, normalizedKey);
  if (hit !== undefined) return hit;

  const outcome = await probeFn();
  await writeCache(probe, normalizedKey, outcome.value, outcome.ok ? ttl.okSeconds : ttl.failSeconds);
  return outcome.value;
}

/** Drops expired rows. Called from the daily housekeeping cron — the table is small either way. */
export async function pruneProbeCache(): Promise<number> {
  try {
    const db = await getDatabase();
    const r = await db.query<{ n: string }>(`WITH gone AS (DELETE FROM verify_probe_cache WHERE expires_at < NOW() RETURNING 1) SELECT COUNT(*) n FROM gone`);
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}
