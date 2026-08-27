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

import { getDatabase, type SqlConnection } from "@/server/db/client";
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
  /** Saved searches that were due and did not run this tick — per-reader cap or budget. */
  savedSearchesDropped: number;
  failures: number;
  /** Stopped on its own budget. Designed behaviour, NOT a fault — see the receipt below. */
  stoppedEarly: boolean;
  /** Selected readers this tick never reached. They are first in line next tick, not skipped. */
  deferred: number;
  budgetMs: number;
}

/**
 * Readers with something to be notified ABOUT, least-recently-SWEPT first.
 *
 * This used to order by the newest notification a reader held. That looked like the same thing and
 * was not: being swept did not advance a reader's position, only RECEIVING something did. A
 * subscribed reader whose listings never moved therefore stayed NULL forever, sat at the head of
 * the queue on every tick, and starved everyone past the per-tick cap — the exact collector-cadence
 * failure this comment used to claim it prevented. Worse, the cost of holding that seat was zero,
 * so any authenticated customer could take it.
 *
 * `notification_swept_at` records when the sweep last CONSIDERED someone, which advances whether or
 * not there was anything to tell them. A reader with no `user_visit_state` row at all has never
 * been swept and has never visited; the LEFT JOIN yields NULL for them and NULLS FIRST puts them at
 * the front, which is where a never-swept reader belongs.
 */
async function candidateUsers(limit: number) {
  const db = await getDatabase();
  return (await db.query<{ user_id: string }>(
    `SELECT u.id AS user_id
     FROM auth_users u
     LEFT JOIN user_visit_state v ON v.user_id=u.id
     WHERE u.status='active'
       AND (
         EXISTS (SELECT 1 FROM user_watchlists w WHERE w.user_id=u.id)
         OR EXISTS (SELECT 1 FROM entity_follows f WHERE f.user_id=u.id)
         OR EXISTS (SELECT 1 FROM saved_searches s WHERE s.user_id=u.id AND s.active=TRUE AND s.alert_mode<>'off')
       )
     ORDER BY v.notification_swept_at ASC NULLS FIRST, u.id
     LIMIT $1`,
    [limit],
  )).rows.map((row) => row.user_id);
}

/**
 * Record that this reader was considered, without pretending they visited.
 *
 * `touchVisit` is the wrong tool even though it owns this table: it moves `last_seen_at` to now and
 * cascades the old value into `previous_seen_at`, which is the window "since your last review" is
 * measured from. Calling it here would have made a scheduled cron look like a visit and collapsed
 * every reader's digest window to "since the sweep ran". So this writes exactly one
 * column, and only seeds the visit columns on INSERT because `last_seen_at` is NOT NULL.
 */
async function markSwept(db: SqlConnection, userId: string) {
  await db.query(
    `INSERT INTO user_visit_state(user_id,previous_seen_at,last_seen_at,notification_swept_at)
     VALUES($1,NULL,NOW(),NOW())
     ON CONFLICT(user_id) DO UPDATE SET notification_swept_at=NOW(),updated_at=NOW()`,
    [userId],
  );
}

/**
 * Runs the sweep and ALWAYS leaves a receipt, even when it throws before doing any work.
 *
 * This wrapper exists because its absence cost hours of misdiagnosis. Three columns were missing
 * from the production database, so `candidateUsers` threw on its first query — before the loop,
 * before `recordCollectorRun`. No receipt was written, /status read "Never run", and "never run"
 * is indistinguishable from "never invoked". The cron was firing correctly the whole time and the
 * owner was told to suspect CRON_SECRET and the perimeter, both of which were fine.
 *
 * A scheduled job that can fail silently is a job you cannot debug from the outside. It re-throws
 * afterwards so the route still 500s and the platform still records the invocation as failed.
 */
export async function runNotificationSweep(options: { maxUsers?: number; budgetMs?: number; now?: Date } = {}): Promise<SweepResult> {
  try {
    return await sweep(options);
  } catch (error) {
    console.error("[notification-sweep] tick failed before completing:", error);
    // Best-effort and deliberately separate: if the database is the thing that is broken, this
    // write fails too, and that must not replace the original error with a confusing one.
    try {
      const db = await getDatabase();
      await recordCollectorRun(db, { collector: "notification-sweep", target: "customers", items: 0, ok: false });
    } catch (receiptError) {
      console.error("[notification-sweep] could not even record the failure:", receiptError);
    }
    throw error;
  }
}

async function sweep(options: { maxUsers?: number; budgetMs?: number; now?: Date } = {}): Promise<SweepResult> {
  const maxUsers = Math.max(1, options.maxUsers ?? NOTIFICATION_SWEEP_USERS);
  const budgetMs = Math.max(1_000, options.budgetMs ?? 60_000);
  const now = options.now ?? new Date();
  const startedAt = Date.now();
  const deadlineAt = startedAt + budgetMs;

  const db = await getDatabase();
  const users = await candidateUsers(maxUsers);
  const result: SweepResult = {
    candidates: users.length, swept: 0, savedSearchesChecked: 0, savedSearchAlerts: 0,
    savedSearchesDropped: 0, failures: 0, stoppedEarly: false, deferred: 0, budgetMs,
  };

  for (const userId of users) {
    // Stop cleanly rather than being killed mid-user. A sweep that dies at the function ceiling
    // leaves no receipt, and "no receipt" is indistinguishable from "never scheduled".
    if (Date.now() - startedAt > budgetMs) { result.stoppedEarly = true; break; }
    try {
      await syncWatchlistNotifications(userId, now);
      // The budget travels INTO the per-reader work. Checking it only out here bounded the number
      // of readers and not the cost of one, so a single account holding thousands of saved searches
      // could run past the ceiling on its own and take the whole tick's receipt down with it.
      const searches = await runSavedSearchAlerts(userId, now, db, { deadlineAt });
      result.savedSearchesChecked += searches.checked;
      result.savedSearchAlerts += searches.alerted;
      result.savedSearchesDropped += searches.dropped;
      // Best-effort: the digest is a nice-to-have and must never cost someone their price alerts.
      await generateMarketChangeSummary(userId).catch(() => null);
      result.swept += 1;
    } catch (error) {
      // One reader's bad data must not end the sweep for everyone behind them in the queue.
      result.failures += 1;
      console.error(`[notification-sweep] ${userId} failed:`, error);
    } finally {
      // Stamped for everyone the sweep TOUCHED — including the reader who had nothing waiting and
      // including the one who just threw. A reader who fails every night would otherwise hold the
      // head of the queue permanently, which is the starvation bug wearing a different hat.
      await markSwept(db, userId).catch((error) => console.error(`[notification-sweep] ${userId} stamp failed:`, error));
    }
  }

  result.deferred = users.length - result.swept - result.failures;
  if (result.stoppedEarly || result.savedSearchesDropped > 0) {
    console.warn(
      `[notification-sweep] stopped after ${result.swept} of ${result.candidates} readers in ${Date.now() - startedAt}ms; ` +
        `${result.deferred} readers and ${result.savedSearchesDropped} saved searches deferred to the next tick`,
    );
  }

  // A receipt every tick, including a tick that found nobody. Zero swept with a receipt is "ran,
  // nothing to do"; no receipt at all is "never ran" — and those look identical from the outside
  // unless something writes the difference down.
  //
  // `ok` means "nothing FAILED". It deliberately no longer folds in `stoppedEarly`: stopping on the
  // budget is the behaviour this loop was built to have, and with a 200-reader cap inside 90s any
  // per-reader cost over ~450ms made it true every single tick — so /status said "the alert sweep
  // has not completed on schedule" continuously, and the one page whose job is telling a real fault
  // from a quiet one cried wolf until nobody read it. What a budget stop actually costs is
  // COVERAGE, and coverage is reported as a backlog by `getNotificationSweepHealth` below, where a
  // backlog that keeps growing is visible without a healthy tick having to lie about failing.
  await recordCollectorRun(db, {
    collector: "notification-sweep",
    target: "customers",
    items: result.swept,
    ok: result.failures === 0,
  });

  return result;
}

export interface SweepHealth {
  /** Null when the sweep has never run at all — which is different from having run and found nobody. */
  lastRanAt: string | null;
  lastSweptUsers: number;
  /** Whether the last tick FAILED. A tick that stopped on its budget is not a failure. */
  lastOk: boolean;
  hoursSinceLastRun: number | null;
  /**
   * Readers currently subscribed to something. Nobody waiting means nobody is being failed.
   * Null when the count could not be read — which is not the same as zero, and must not be
   * treated as the reassuring answer.
   */
  waitingReaders: number | null;
  /**
   * Subscribed readers the last tick did not reach — its cost, stated as coverage rather than as a
   * fault. A sweep can be perfectly healthy and still be too small for its audience, and those are
   * different problems that need different words.
   */
  /** Readers NOT reached on the last tick. Null when the waiting count could not be read. */
  backlogReaders: number | null;
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
  const [row, waiting] = await Promise.all([
    db.query<{ ran_at: string; items: string | number; ok: boolean }>(
      `SELECT ran_at::text, items, ok FROM collector_runs WHERE collector='notification-sweep' ORDER BY ran_at DESC LIMIT 1`,
    ).then((r) => r.rows[0]),
    // Cheap: it only needs to know whether anyone is waiting, not who.
    db.query<{ n: string | number }>(
      `SELECT COUNT(*) n FROM auth_users u WHERE u.status='active' AND (
         EXISTS (SELECT 1 FROM user_watchlists w WHERE w.user_id=u.id)
         OR EXISTS (SELECT 1 FROM entity_follows f WHERE f.user_id=u.id)
         OR EXISTS (SELECT 1 FROM saved_searches s WHERE s.user_id=u.id AND s.active=TRUE AND s.alert_mode<>'off'))`,
    ).then((r) => Number(r.rows[0]?.n ?? 0)).catch((error) => { console.error("[notification-sweep] could not count waiting readers:", error); return null; }),
  ]);
  if (!row) return { lastRanAt: null, lastSweptUsers: 0, lastOk: false, hoursSinceLastRun: null, waitingReaders: waiting, backlogReaders: waiting };
  const ranAt = new Date(row.ran_at);
  // `new Date(junk).toISOString()` throws RangeError, and this runs on /status — the one page whose
  // entire job is to still render when something underneath it is wrong. An unreadable timestamp is
  // a result ("we cannot tell when it last ran"), not an exception.
  if (Number.isNaN(ranAt.getTime())) {
    const swept = Number(row.items) || 0;
    return { lastRanAt: null, lastSweptUsers: swept, lastOk: false, hoursSinceLastRun: null, waitingReaders: waiting, backlogReaders: waiting === null ? null : Math.max(0, waiting - swept) };
  }
  const swept = Number(row.items) || 0;
  return {
    lastRanAt: ranAt.toISOString(),
    lastSweptUsers: swept,
    lastOk: Boolean(row.ok),
    hoursSinceLastRun: (now.getTime() - ranAt.getTime()) / 3_600_000,
    waitingReaders: waiting,
    // Derived rather than stored: one tick's own "I stopped early" flag cannot say whether the
    // backlog is being cleared or growing, and this is the number a reader is actually waiting in.
    backlogReaders: waiting === null ? null : Math.max(0, waiting - swept),
  };
}

/** Daily schedule, so anything past ~2 days is a stopped cron rather than a quiet one. */
export const SWEEP_STALE_HOURS = 48;

/**
 * Is the sweep FAULTED? Not "did it do all the work" — see `isSweepKeepingUp` for that.
 *
 * Deliberately blind to a budget stop. Stopping on the budget is the designed behaviour, and
 * folding it into this predicate made /status report "the alert sweep has not completed on
 * schedule" on every healthy tick.
 */
export function isSweepHealthy(health: SweepHealth) {
  // A sweep that has never run is only a FAULT if somebody is waiting on it. On a fresh deployment
  // with nobody subscribed to anything, nobody is being failed — and a status page that cries
  // degraded on day one teaches its reader to stop looking, which costs more than it saves.
  //
  // An UNREADABLE count is not nobody: `null` must not buy a never-run sweep a clean bill of
  // health, or the check reports health precisely because it failed.
  if (health.lastRanAt === null) return health.waitingReaders === 0;
  if (!health.lastOk) return false;
  return (health.hoursSinceLastRun ?? Infinity) < SWEEP_STALE_HOURS;
}

/**
 * Is it big enough for its audience?
 *
 * A tick reaches at most `NOTIFICATION_SWEEP_USERS` readers and the cron runs every six hours, so a
 * backlog inside one tick's capacity is cleared by the next tick — well inside `SWEEP_STALE_HOURS`,
 * the horizon every other judgement in this file is made against. A backlog LARGER than one tick
 * means somebody waits past that horizon for an alert, tick after tick, while every tick reports a
 * clean success. That is worth saying out loud, and it is a different sentence from "it is broken".
 */
export function isSweepKeepingUp(health: SweepHealth) {
  // An unknown backlog is not a small one. Answering "keeping up" because the count failed is the
  // same lie as answering "healthy" because a probe failed.
  if (health.backlogReaders === null) return false;
  return health.backlogReaders <= NOTIFICATION_SWEEP_USERS;
}
