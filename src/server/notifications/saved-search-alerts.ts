// Saved searches that actually tell you something.
//
// `alert_mode` ("off" | "important" | "all") was written at creation, stored, mapped, and rendered
// as a select with a Bell badge — and read by NO code. Selecting "No alerts" and selecting "All
// reviewed changes" produced identical behaviour: none. A saved search never re-ran on its own,
// never compared itself to its last result, and never produced a notification. `last_run_at` and
// `last_result_count` only moved when the reader clicked "Run" themselves.
//
// So the saved search was a bookmark for a query string, sold as a standing question.

import type { SqlConnection } from "@/server/db/client";
import { getDatabase } from "@/server/db/client";
import { searchMarket } from "@/server/search/engine";
import { decideDelivery, type NotificationPreferences } from "./policy";
import {
  getNotificationChannelPreferences,
  listSavedSearches,
  updateSavedSearchResult,
  upsertUserNotification,
} from "@/server/consumer-intelligence/repository";

export type AlertMode = "off" | "important" | "all";

/**
 * How many saved searches one reader may cost a single tick.
 *
 * Every search here runs `searchMarket`, which reads `search_documents` whole and scores it in JS.
 * Nothing caps how many saved searches an account may hold, so before this constant one reader with
 * a few thousand of them could spend the sweep's entire budget alone, be killed before the receipt
 * was written, and silently un-notify every reader queued behind them — a denial of the whole
 * notification system available to any authenticated customer for the price of a for-loop.
 *
 * 25 is a ceiling on cost, not a judgement about how many searches someone may save: the rest are
 * deferred to the next tick, not dropped, because the queue is ordered least-recently-run first.
 */
export const SAVED_SEARCH_ALERTS_PER_USER = 25;

export interface SavedSearchAlertRun {
  /** Saved searches actually re-run this tick. */
  checked: number;
  alerted: number;
  /** Active, non-"off" searches this reader holds — the work that was ASKED for. */
  eligible: number;
  /** Eligible searches this tick did not reach. Silence here would read as "covered everything". */
  dropped: number;
  /** True when the sweep's own budget, not the per-reader cap, ended the work. */
  stoppedEarly: boolean;
}

export function asAlertMode(raw: string | null | undefined): AlertMode {
  return raw === "off" || raw === "all" ? raw : "important";
}

/**
 * Whether a change in result count is worth telling this reader about.
 *
 * - `off`    — never. The reader said so.
 * - `important` — only when the search found something NEW. A listing disappearing is not why
 *                 someone saves "BPC-157 with current evidence"; a new one appearing is.
 * - `all`    — any movement in either direction.
 *
 * A first run has no previous count to compare against and is NOT an alert: every saved search
 * would otherwise fire once the moment this shipped, which is a storm, not news.
 */
export function shouldAlertOnResultChange(input: { mode: AlertMode; previousCount: number | null; currentCount: number }): boolean {
  if (input.mode === "off") return false;
  if (input.previousCount === null) return false;
  if (input.currentCount === input.previousCount) return false;
  return input.mode === "all" || input.currentCount > input.previousCount;
}

export function describeResultChange(input: { name: string; previousCount: number; currentCount: number }) {
  const delta = input.currentCount - input.previousCount;
  const title = delta > 0
    ? `${delta} new ${delta === 1 ? "match" : "matches"} for “${input.name}”`
    : `${Math.abs(delta)} ${Math.abs(delta) === 1 ? "match" : "matches"} dropped off “${input.name}”`;
  const body = `Your saved search now returns ${input.currentCount} ${input.currentCount === 1 ? "record" : "records"}, up from ${input.previousCount}.`;
  const bodyDown = `Your saved search now returns ${input.currentCount} ${input.currentCount === 1 ? "record" : "records"}, down from ${input.previousCount}.`;
  return { title, body: delta > 0 ? body : bodyDown };
}

/**
 * Re-runs every active saved search for one reader and notifies on movement.
 *
 * Notifications go through the same policy every other notification does, so `saved_search_alerts`,
 * quiet hours, the digest window and the relevance threshold all apply — the per-search `alertMode`
 * narrows on top of the account-level switch rather than bypassing it.
 */
export async function runSavedSearchAlerts(
  userId: string,
  now = new Date(),
  connection?: SqlConnection,
  options: { maxSearches?: number; deadlineAt?: number } = {},
): Promise<SavedSearchAlertRun> {
  const db = connection ?? (await getDatabase());
  const maxSearches = Math.max(1, options.maxSearches ?? SAVED_SEARCH_ALERTS_PER_USER);
  const preferences: NotificationPreferences = await getNotificationChannelPreferences(userId, db);
  const searches = await listSavedSearches(userId, db);
  let checked = 0;
  let alerted = 0;
  let stoppedEarly = false;

  // Decide eligibility BEFORE the cap so an inactive or "off" search cannot consume a slot that a
  // search the reader is actually waiting on would have used. "off" still never runs a query.
  const eligible = searches
    .filter((saved) => saved.active && asAlertMode(saved.alertMode) !== "off")
    // Least-recently-run first, never-run before that. The cap has to rotate: ordering by the
    // repository's default (updated_at DESC) would re-run the same top slice every night and the
    // tail would never run at all — the same starvation the sweep's own queue had.
    .sort((a, b) => (a.lastRunAt ? Date.parse(a.lastRunAt) : 0) - (b.lastRunAt ? Date.parse(b.lastRunAt) : 0));

  for (const saved of eligible) {
    // Two independent stops. The cap bounds one reader's cost; the deadline is the SWEEP's budget,
    // visible in here so a reader holding a lot of searches can be interrupted mid-reader instead
    // of running the whole tick over its ceiling and being killed before it can leave a receipt.
    if (checked >= maxSearches) break;
    if (options.deadlineAt !== undefined && Date.now() > options.deadlineAt) { stoppedEarly = true; break; }
    const mode = asAlertMode(saved.alertMode);

    const types = Array.isArray(saved.filters.types)
      ? saved.filters.types.filter((value): value is string => typeof value === "string")
      : undefined;
    const result = await searchMarket({ query: saved.query, types, limit: 30, actorKey: `cron:${userId}`, log: false });
    checked += 1;

    // totalMatches, not results.length: results is capped at the page size, so comparing it would
    // report "no change" for a search that went from 40 matches to 400.
    const currentCount = result.totalMatches;
    const previousCount = saved.lastRunAt ? saved.lastResultCount : null;
    await updateSavedSearchResult(userId, saved.id, currentCount, db);

    if (!shouldAlertOnResultChange({ mode, previousCount, currentCount })) continue;

    const copy = describeResultChange({ name: saved.name, previousCount: previousCount!, currentCount });
    const decision = decideDelivery({ category: null, source: "saved-search", relevance: 0.7, preferences, now });
    if (!decision.inApp) continue;
    await upsertUserNotification(userId, {
      category: "saved-search",
      title: copy.title,
      body: copy.body,
      actionHref: `/saved-searches`,
      relevanceScore: 0.7,
      // One notification per search per day, so a search that churns cannot flood the inbox.
      dedupeKey: `saved-search:${saved.id}:${now.toISOString().slice(0, 10)}`,
      deliverAfter: decision.deliverAfter,
    }, db);
    alerted += 1;
  }

  const dropped = eligible.length - checked;
  if (dropped > 0) {
    // Say it out loud. Truncating in silence reports the same shape as "this reader had nothing",
    // and a reader whose alerts are being skipped every night would look identical to a quiet one.
    console.warn(
      `[saved-search-alerts] ${userId}: ran ${checked} of ${eligible.length} saved searches (` +
        `${stoppedEarly ? "sweep budget expired" : `per-reader cap ${maxSearches}`}); ${dropped} deferred to the next tick`,
    );
  }

  return { checked, alerted, eligible: eligible.length, dropped, stoppedEarly };
}
