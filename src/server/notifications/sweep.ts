// The scheduled half of the notification system.
//
// Everything here existed already and only ever ran when a reader loaded /for-you or
// /account/notifications. `syncWatchlistNotifications` had exactly three callers, all of them
// user-initiated, and no cron referenced it. So the product told people "we'll tell you when a
// price moves" and then told them only if they came back and asked. The one channel that could
// have reached someone who was away — web-push — fired inside that same user-initiated loop, so it
// could only ever notify a reader who was already looking at the page.
//
// This is the missing scheduler. It is deliberately cheap: pure SQL and an in-process search, no
// model calls, so a daily tick over the whole reader base costs nothing worth measuring.

import { getDatabase } from "@/server/db/client";
import { recordCollectorRun } from "@/server/health/data-health";
import { generateMarketChangeSummary, syncWatchlistNotifications } from "@/server/consumer-intelligence/service";
import { runSavedSearchAlerts } from "./saved-search-alerts";

/** Per-tick ceiling. Sized so the sweep cannot outlive a serverless function's budget. */
export const NOTIFICATION_SWEEP_USERS = 200;

export interface SweepResult {
  candidates: number;
  swept: number;
  savedSearchesChecked: number;
  savedSearchAlerts: number;
  failures: number;
  stoppedEarly: boolean;
  budgetMs: number;
}

/**
 * Readers with something to be notified ABOUT, least-recently-notified first.
 *
 * Ordering by the newest notification a reader holds, NULLS FIRST, means anyone who has never been
 * notified is served before anyone who was served an hour ago. That keeps the per-tick cap from
 * permanently starving the tail of the table, which is how the collector sweep quietly ran at 8%
 * cadence for weeks.
 */
async function candidateUsers(limit: number) {
  const db = await getDatabase();
  return (await db.query<{ user_id: string }>(
    `SELECT u.id AS user_id
     FROM auth_users u
     WHERE u.status='active'
       AND (
         EXISTS (SELECT 1 FROM user_watchlists w WHERE w.user_id=u.id)
         OR EXISTS (SELECT 1 FROM entity_follows f WHERE f.user_id=u.id)
         OR EXISTS (SELECT 1 FROM saved_searches s WHERE s.user_id=u.id AND s.active=TRUE AND s.alert_mode<>'off')
       )
     ORDER BY (SELECT MAX(n.created_at) FROM user_notifications n WHERE n.user_id=u.id) ASC NULLS FIRST, u.id
     LIMIT $1`,
    [limit],
  )).rows.map((row) => row.user_id);
}

export async function runNotificationSweep(options: { maxUsers?: number; budgetMs?: number; now?: Date } = {}): Promise<SweepResult> {
  const maxUsers = Math.max(1, options.maxUsers ?? NOTIFICATION_SWEEP_USERS);
  const budgetMs = Math.max(1_000, options.budgetMs ?? 60_000);
  const now = options.now ?? new Date();
  const startedAt = Date.now();

  const users = await candidateUsers(maxUsers);
  const result: SweepResult = { candidates: users.length, swept: 0, savedSearchesChecked: 0, savedSearchAlerts: 0, failures: 0, stoppedEarly: false, budgetMs };

  for (const userId of users) {
    // Stop cleanly rather than being killed mid-user. A sweep that dies at the function ceiling
    // leaves no receipt, and "no receipt" is indistinguishable from "never scheduled".
    if (Date.now() - startedAt > budgetMs) { result.stoppedEarly = true; break; }
    try {
      await syncWatchlistNotifications(userId, now);
      const searches = await runSavedSearchAlerts(userId, now);
      result.savedSearchesChecked += searches.checked;
      result.savedSearchAlerts += searches.alerted;
      // Best-effort: the digest is a nice-to-have and must never cost someone their price alerts.
      await generateMarketChangeSummary(userId).catch(() => null);
      result.swept += 1;
    } catch (error) {
      // One reader's bad data must not end the sweep for everyone behind them in the queue.
      result.failures += 1;
      console.error(`[notification-sweep] ${userId} failed:`, error);
    }
  }

  // A receipt every tick, including a tick that found nobody. Zero swept with a receipt is "ran,
  // nothing to do"; no receipt at all is "never ran" — and those look identical from the outside
  // unless something writes the difference down.
  const db = await getDatabase();
  await recordCollectorRun(db, {
    collector: "notification-sweep",
    target: "customers",
    items: result.swept,
    ok: result.failures === 0 && !result.stoppedEarly,
  });

  return result;
}

export interface SweepHealth {
  /** Null when the sweep has never run at all — which is different from having run and found nobody. */
  lastRanAt: string | null;
  lastSweptUsers: number;
  lastOk: boolean;
  hoursSinceLastRun: number | null;
}

/**
 * What /status needs to tell "ran and found nothing" from "never ran".
 *
 * Two crons in this repository were silently dead for weeks because a missing perimeter entry 401'd
 * every invocation and no surface said so. A sweep whose whole purpose is reaching people who are
 * not looking is exactly the one nobody would notice had stopped.
 */
export async function getNotificationSweepHealth(now = new Date()): Promise<SweepHealth> {
  const db = await getDatabase();
  const row = (await db.query<{ ran_at: string; items: string | number; ok: boolean }>(
    `SELECT ran_at::text, items, ok FROM collector_runs WHERE collector='notification-sweep' ORDER BY ran_at DESC LIMIT 1`,
  )).rows[0];
  if (!row) return { lastRanAt: null, lastSweptUsers: 0, lastOk: false, hoursSinceLastRun: null };
  const ranAt = new Date(row.ran_at);
  // `new Date(junk).toISOString()` throws RangeError, and this runs on /status — the one page whose
  // entire job is to still render when something underneath it is wrong. An unreadable timestamp is
  // a result ("we cannot tell when it last ran"), not an exception.
  if (Number.isNaN(ranAt.getTime())) return { lastRanAt: null, lastSweptUsers: Number(row.items) || 0, lastOk: false, hoursSinceLastRun: null };
  return {
    lastRanAt: ranAt.toISOString(),
    lastSweptUsers: Number(row.items),
    lastOk: Boolean(row.ok),
    hoursSinceLastRun: (now.getTime() - ranAt.getTime()) / 3_600_000,
  };
}

/** Daily schedule, so anything past ~2 days is a stopped cron rather than a quiet one. */
export const SWEEP_STALE_HOURS = 48;

export function isSweepHealthy(health: SweepHealth) {
  if (health.lastRanAt === null) return false;
  if (!health.lastOk) return false;
  return (health.hoursSinceLastRun ?? Infinity) < SWEEP_STALE_HOURS;
}
