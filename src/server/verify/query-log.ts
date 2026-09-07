import { getDatabase } from "@/server/db/client";
import type { VerifyResult } from "./index";

// What people ask /verify about.
//
// This is the clearest demand signal the product generates and it was being thrown away on every
// call. A reader who pastes a domain we do not track has told us, at the exact moment of highest
// intent, that they are about to spend money at a shop we have nothing on — and that is precisely
// the list of vendors worth tracking next. It also names the scams doing the rounds: an untracked
// domain checked forty times this week is a link circulating somewhere.
//
// Three deliberate limits, because the value is in the aggregate and the risk is in the detail:
//
//   - NO request context is stored. No address, no address hash, no session, no agent, no
//     timestamp per call. One row per distinct query with a counter, so the table cannot be used to
//     reconstruct what any individual looked at.
//   - Only queries that CLASSIFIED are kept. A query that matched nothing is exactly where a
//     mistyped personal detail would land, and it is also the least useful row, so it is dropped.
//   - Recording never blocks or breaks a verdict. A failed write costs a row, not an answer.

/** Query kinds worth keeping. `nothing` is excluded on purpose — see above. */
const RECORDED_KINDS: ReadonlySet<VerifyResult["kind"]> = new Set(["vendor", "coa", "compound", "unknown-domain"]);

/** Trimmed to the same ceiling the API accepts, so a row can never be larger than a request. */
const MAX_DISPLAY = 200;

export function shouldRecord(result: Pick<VerifyResult, "kind" | "query">): boolean {
  return RECORDED_KINDS.has(result.kind) && result.query.trim().length > 0;
}

export async function recordVerifyQuery(result: Pick<VerifyResult, "kind" | "query" | "verdict">): Promise<void> {
  if (!shouldRecord(result)) return;
  const display = result.query.trim().slice(0, MAX_DISPLAY);
  const normalized = display.toLowerCase();
  try {
    const db = await getDatabase();
    await db.query(
      // The counter increments on conflict rather than inserting a second row, which is what keeps
      // this an aggregate: there is no per-call record to read back.
      `INSERT INTO verify_queries (normalized, display, kind, last_verdict, checks)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (normalized) DO UPDATE
         SET checks = verify_queries.checks + 1,
             last_seen_at = NOW(),
             kind = EXCLUDED.kind,
             last_verdict = EXCLUDED.last_verdict`,
      [normalized, display, result.kind, result.verdict],
    );
  } catch {
    // A verdict is never withheld because its bookkeeping failed.
  }
}

export interface VerifyDemandRow {
  display: string;
  kind: string;
  lastVerdict: string;
  checks: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

/**
 * The demand list, most-checked first.
 *
 * `kind` defaults to untracked domains because that is the actionable half: a vendor we already
 * cover being checked often is interesting, a vendor we do NOT cover being checked often is a
 * decision waiting to be made.
 */
export async function listVerifyDemand(options: { kind?: string; limit?: number } = {}): Promise<VerifyDemandRow[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
  try {
    const db = await getDatabase();
    const rows = await db.query<{ display: string; kind: string; last_verdict: string; checks: number | string; first_seen_at: string; last_seen_at: string }>(
      options.kind
        ? `SELECT display, kind, last_verdict, checks, first_seen_at, last_seen_at FROM verify_queries WHERE kind = $2 ORDER BY checks DESC, last_seen_at DESC LIMIT $1`
        : `SELECT display, kind, last_verdict, checks, first_seen_at, last_seen_at FROM verify_queries ORDER BY checks DESC, last_seen_at DESC LIMIT $1`,
      options.kind ? [limit, options.kind] : [limit],
    );
    return rows.rows.map((r) => ({
      display: r.display, kind: r.kind, lastVerdict: r.last_verdict,
      checks: Number(r.checks),
      firstSeenAt: new Date(r.first_seen_at).toISOString(),
      lastSeenAt: new Date(r.last_seen_at).toISOString(),
    }));
  } catch {
    return [];
  }
}
