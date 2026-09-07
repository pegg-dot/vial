// Can the schedule actually deliver the cadences it declares?
//
// CADENCE_MINUTES is a promise: a headless catalogue is re-read every 6 hours, a vendor's status
// every 24. Nothing was checking that the cron firing the tick could keep that promise. On
// 2026-08-24 it could not, and by a wide margin: 99 targets, 8 per tick, one tick per day — a
// twelve-day cycle for collectors that claim six hours. The collectors worked, the queue worked,
// every run went green, and the catalogue was a twelfth as fresh as the code said it was.
//
// That is the same shape as the other defects found today. Nothing failed. It just quietly did not
// happen. So the arithmetic is written down here and asserted in CI, where adding vendors or
// tightening a cadence past what the cron can serve turns red instead of turning slow.

import { CADENCE_MINUTES, type CollectorKind } from "./scheduler";

/** How many targets one tick will claim. The route reads this so both sides cannot drift. */
export const TICK_MAX_TARGETS = 140;

/** In-flight collector targets. Never two against one vendor — see server/collect/pool.ts. */
export const TICK_CONCURRENCY = 6;

/** Wall-clock the collection tick may spend starting targets, inside a 300s function ceiling. */
export const TICK_BUDGET_MS = 180_000;

const MINUTES_PER_DAY = 24 * 60;

/**
 * Ticks per day from a cron expression.
 *
 * Deliberately handles only the shapes Vercel crons use here — a fixed minute, a step, or a
 * wildcard — and throws on anything else rather than guessing. A capacity check that silently
 * mis-parses its own schedule is worse than no check.
 */
export function ticksPerDay(cron: string): number {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`unsupported cron (want 5 fields): ${cron}`);
  const [minute, hour, dom, month, dow] = fields as [string, string, string, string, string];
  if (dom !== "*" || month !== "*" || dow !== "*") throw new Error(`unsupported cron (only daily patterns): ${cron}`);

  const count = (field: string, range: number): number => {
    if (field === "*") return range;
    const step = /^\*\/(\d+)$/.exec(field);
    if (step) return Math.floor(range / Number(step[1]));
    if (/^\d+$/.test(field)) return 1;
    if (/^[\d,]+$/.test(field)) return field.split(",").length;
    throw new Error(`unsupported cron field "${field}" in: ${cron}`);
  };
  return count(minute, 60) * count(hour, 24);
}

export interface TargetCounts {
  /** Vendors that get a catalogue collector (shopify, woo, or rsc — one each, never two). */
  withCatalog: number;
  /** Vendors that get status, domain-age and tracker-ratings. */
  collected: number;
}

/**
 * Target-runs per day the declared cadences ask for.
 *
 * Counted from the cadences themselves rather than a hand-written number, so tightening a cadence
 * moves this automatically. That matters: the last time a formula and its thresholds were allowed
 * to drift apart, correcting the formula silently broke every consumer of it.
 */
export function dailyDemand(counts: TargetCounts): number {
  const perDay = (kind: CollectorKind) => MINUTES_PER_DAY / CADENCE_MINUTES[kind];
  const catalogue = counts.withCatalog * perDay("catalog-rsc"); // shopify/woo/rsc share a cadence
  const perVendor = counts.collected * (perDay("vendor-status") + perDay("domain-age") + perDay("tracker-ratings"));
  const market = perDay("enforcement-openfda") + perDay("news-feeds") + perDay("lab-janoshik") + perDay("lab-janoshik-capture");
  return catalogue + perVendor + market;
}

/** Target-runs per day the schedule can actually serve. */
export function dailyCapacity(cron: string, maxTargets = TICK_MAX_TARGETS): number {
  return ticksPerDay(cron) * maxTargets;
}

/**
 * Wall-clock each unit of work gets, if the run is to serve a day of demand.
 *
 * Counting jobs alone stopped being enough the moment the schedule went daily. A tick that claims
 * 1,400 jobs is not serving 1,400 jobs unless it can actually finish them inside one function
 * lifetime — and when the work is network fetches against other people's servers, that is a claim
 * about seconds, not about counters. Under the old 15- and 30-minute crons the distinction did not
 * matter: no tick ever had more than a nibble to do. Under a daily cron it is the whole question.
 *
 * So capacity is expressed as the per-unit time the budget affords at the configured concurrency.
 * If that number drops below what a real fetch costs, the run stops on its budget and the queue
 * lags — quietly, greenly, exactly like the 2026-08-24 starvation. The tests hold it above a floor
 * so that adding vendors or listings turns red rather than turning slow.
 */
export function perUnitBudgetMs(demandPerDay: number, budgetMs: number, concurrency: number, runsPerDay = 1): number {
  if (demandPerDay <= 0) return Infinity;
  return (budgetMs * concurrency * runsPerDay) / demandPerDay;
}

/**
 * Headroom as a multiple of demand. Below 1.0 the queue can never catch up and the oldest targets
 * starve; a tick that always finds work is a tick that is always behind.
 */
export function headroom(cron: string, counts: TargetCounts, maxTargets = TICK_MAX_TARGETS): number {
  return dailyCapacity(cron, maxTargets) / dailyDemand(counts);
}

// ── Provenance sweep capacity ────────────────────────────────────────────────────────────────────
//
// The refresh sweep used to ride the daily housekeeping cron claiming 20 jobs, which was harmless
// only because nothing was ever enrolled. Now every catalogue listing is, so it has its own cron
// and its own arithmetic. These two intervals still differ on purpose — the registration default
// applies to manually registered sources, the schema default to anything inserted without one —
// and the difference is load-bearing, so it is asserted rather than tidied away.

/**
 * Jobs one provenance sweep claims. The route imports this, so scored and used cannot drift.
 *
 * 20 was sized against a cron running 96 times a day. On a daily cron the whole 897-listing
 * catalogue has to be served by a single sweep, so this is the day's work rather than a tick's —
 * which is only possible because the jobs no longer run one at a time.
 */
export const PROVENANCE_SWEEP_JOBS = 1400;

/** In-flight refresh jobs. Never two against one vendor — see server/collect/pool.ts. */
export const PROVENANCE_CONCURRENCY = 12;

/** Wall-clock the sweep may spend starting jobs, inside a 300s function ceiling. */
export const PROVENANCE_BUDGET_MS = 200_000;

/**
 * The slowest a provenance fetch may average before the daily sweep stops keeping its promise.
 *
 * This is an ASSUMPTION, written down so it can be checked rather than believed: at 12 in flight
 * for 200s, 1,346 jobs get 1.78s each. A real fetch-and-parse against a storefront is comfortably
 * inside that, but it has not been measured against production yet — the first daily run reports
 * `processed` and `budgetExhausted`, and those two numbers are what confirm or refute it.
 */
export const PROVENANCE_ASSUMED_JOB_MS = 1_000;

/** Interval a policy gets from registerLiveHttpSource when the caller does not specify one. */
export const REFRESH_DEFAULT_INTERVAL_MINUTES = 720;

/** Interval the schema hands a policy inserted without one. Deliberately different — that is the point. */
export const REFRESH_SCHEMA_INTERVAL_MINUTES = 360;

/**
 * Listings the provenance sweep can serve.
 *
 * Every catalogue listing is now enrolled, at PROVENANCE_INTERVAL_MINUTES (daily), so demand is
 * simply the listing count. Supply is the cron frequency times the sweep size.
 *
 * Sized against the real catalogue, not a guess: the public sitemap carries 897 product pages, and
 * a comment in woocommerce-import records 537 live listings at the time it was written. An earlier
 * reading of "43 listings" off the /market page was a facet count, and sizing to it would have
 * rebuilt the collector starvation on purpose — the very thing this whole arc was about.
 *
 * This used to say "the answer is frequency, not a bigger sweep", because jobs ran strictly one at
 * a time and a sweep big enough for 900+ listings would outlive the function ceiling. Frequency is
 * no longer available — the schedule is daily by the owner's decision — so the sweep got the other
 * half instead: bounded concurrency, serialised per vendor. The count below is therefore only half
 * the answer; `perUnitBudgetMs` is the half that says whether the count can actually be reached.
 */
export function provenanceListingCeiling(cron: string, intervalMinutes: number, sweepJobs = PROVENANCE_SWEEP_JOBS): number {
  const runsPerListingPerDay = MINUTES_PER_DAY / intervalMinutes;
  return Math.floor((ticksPerDay(cron) * sweepJobs) / runsPerListingPerDay);
}
