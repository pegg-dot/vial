// How long operational history is kept.
//
// Before this existed, the codebase had exactly ONE retention rule — operational metric snapshots,
// 30 days — and every other history table grew forever. Every collector run appended a row that
// nothing ever removed. That is fine for a week and not fine for a year: the tables that grow
// without bound are also the tables that get scanned, so unbounded history quietly becomes
// unbounded read volume, which is what a managed Postgres bills for.
//
// WHAT IS DELIBERATELY NOT PURGED, and must stay that way:
//
//   source_snapshots / diffs   The project rule is to preserve immutable snapshots and diffs. They
//                              are the provenance behind every published claim; losing them means a
//                              claim can no longer be traced to what was actually fetched.
//   outbound_clicks            This IS the attribution evidence — the record that VialGrade sent a
//                              vendor real buyers. Deleting it deletes the business case, and a
//                              vendor asking "prove it" a year from now is the entire point.
//   price_observations         One row per listing per day, and the price history is a product
//                              surface, not telemetry.
//   compounds / listings / vendors  Updated in place, never appended, so they do not grow.
//
// Everything below is operational exhaust: useful recently, worthless old.
import type { SqlConnection } from "./client";

// The timestamp column differs per table — page_views uses created_at, collector_runs uses ran_at,
// the snapshot tables use observed_at. Naming it per rule is not pedantry: a hardcoded `created_at`
// deletes NOTHING on three of these five tables while still reporting success, which is precisely
// the kind of silent no-op that lets a "fixed" retention policy quietly never run.
interface Rule { table: string; column: string; days: number; where?: string; why: string }

const RULES: Rule[] = [
  {
    table: "page_views", column: "created_at", days: 30, where: "is_bot",
    why: "Crawler hits are never read by any surface — the funnel filters them out — so they are pure storage and scan cost.",
  },
  {
    table: "page_views", column: "created_at", days: 400, where: "NOT is_bot",
    why: "Real visits stay well over a year so year-over-year comparisons remain possible; the funnel itself only reads 30 days.",
  },
  {
    table: "collector_runs", column: "ran_at", days: 60,
    why: "Only used to show recent collector health. A run from two months ago answers no question anyone asks.",
  },
  {
    table: "source_reliability_snapshots", column: "observed_at", days: 90,
    why: "Recomputed from scratch on every quality pass, so old rows are superseded by construction.",
  },
  {
    table: "operational_metric_snapshots", column: "observed_at", days: 30,
    why: "Pre-existing rule, kept here so every retention decision is visible in one place.",
  },
  {
    table: "market_change_summaries", column: "generated_at", days: 90,
    why:
      "One row per reader per sweep, forever. The dedupe key embeds the period end, so a scheduled " +
      "sweep running four times a day mints a fresh key every day and the ON CONFLICT never fires. " +
      "/for-you only ever reads the most recent few, so a summary from three months ago is a row " +
      "nobody will read again — and before the cron existed this table only grew on a page load.",
  },
  {
    table: "user_notifications", column: "created_at", days: 180,
    // Deliberately longer than the summaries: this IS the reader's history, and the relevance
    // threshold filters it at READ time so lowering the slider is expected to bring old rows back.
    // Six months is the point past which "bring it back" stops being a real request.
    why: "The reader's own alert history. Kept long because the relevance filter is applied on read, so old rows must survive a threshold change.",
    where: "status = 'dismissed' OR read_at IS NOT NULL",
  },
  {
    table: "verify_queries", column: "last_seen_at", days: 180,
    // LAST_seen_at, not first_seen_at, and the distinction is the whole rule. This table is an
    // upsert with a counter, so a domain asked every week since March has an ancient first_seen_at
    // and is the single most valuable row in it — keying on first_seen_at would delete exactly the
    // rows the table exists to surface, while leaving one-off noise from last week untouched. This
    // file already warns that naming the wrong column deletes nothing while reporting success; here
    // it would delete the wrong thing while reporting success, which is worse.
    why:
      "The demand log behind /verify. It is written by an unauthenticated public endpoint, so its " +
      "distinct-query count is bounded by nothing but time — and a query nobody has asked in six " +
      "months has stopped being demand and become exhaust.",
  },
];

export interface RetentionResult { table: string; deleted: number; days: number }

/**
 * Delete operational history past its useful life. Safe to run repeatedly; each pass only removes
 * what is already past the window. Never throws — retention failing must not fail the caller.
 */
export async function applyRetention(db: SqlConnection): Promise<RetentionResult[]> {
  const results: RetentionResult[] = [];
  for (const rule of RULES) {
    try {
      const predicate = rule.where ? ` AND ${rule.where}` : "";
      const result = await db.query(
        `DELETE FROM ${rule.table} WHERE ${rule.column} < NOW() - $1::interval${predicate}`,
        [`${rule.days} days`],
      );
      results.push({ table: rule.table, deleted: result.rowCount ?? 0, days: rule.days });
    } catch (error) {
      // A missing table or column must not break the caller — retention is housekeeping.
      console.error(`[retention] skipped ${rule.table}:`, error);
    }
  }
  return results;
}

/** The rules, for display on an admin surface so the policy is legible rather than buried. */
export function retentionPolicy(): Rule[] {
  return RULES;
}
