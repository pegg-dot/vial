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
export const TICK_MAX_TARGETS = 8;

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
  const market = perDay("enforcement-openfda") + perDay("news-feeds");
  return catalogue + perVendor + market;
}

/** Target-runs per day the schedule can actually serve. */
export function dailyCapacity(cron: string, maxTargets = TICK_MAX_TARGETS): number {
  return ticksPerDay(cron) * maxTargets;
}

/**
 * Headroom as a multiple of demand. Below 1.0 the queue can never catch up and the oldest targets
 * starve; a tick that always finds work is a tick that is always behind.
 */
export function headroom(cron: string, counts: TargetCounts, maxTargets = TICK_MAX_TARGETS): number {
  return dailyCapacity(cron, maxTargets) / dailyDemand(counts);
}
