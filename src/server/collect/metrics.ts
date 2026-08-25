// Is the collection queue keeping up?
//
// /status had a card for the refresh engine and none for the collectors, so on 2026-08-24 the
// collectors could run at 8% of their declared cadence — a twelve-day cycle for a six-hour promise
// — while the page said "All systems operational" and meant it. Every tick succeeded. Nothing was
// broken. The catalogue was just old, and no surface anywhere could say so.
//
// A queue that is permanently behind is a real outage with none of an outage's symptoms, so the
// measurement that matters is not "did the last tick work" but "how long has the oldest overdue
// target been waiting, against the cadence it was promised".

import { getDatabase } from "@/server/db/client";
import type { QueryResultRow } from "pg";

export interface CollectionMetrics {
  enabled: number;
  overdue: number;
  /** Minutes the oldest overdue target has been waiting past its due time. Null when none are. */
  oldestOverdueMinutes: number | null;
  /** That wait as a multiple of the target's own cadence — the number that says "behind". */
  worstLateness: number | null;
  disabled: number;
}

/**
 * A target one cadence late has simply not been picked up yet, which is normal for a queue that
 * spreads work across ticks. Three cadences late means the queue cannot serve what it promised.
 */
export const LATENESS_DEGRADED = 3;

/**
 * Zero enabled collectors is not a healthy queue, it is no queue.
 *
 * Caught on the first render of this card, which said "0 enabled · Every source is within its
 * schedule" — technically true and completely wrong, because a queue with nothing in it is
 * trivially never late. This page's own doctrine already names the trap: a zero it cannot stand
 * behind is a lie with the confident shape of a measurement. Nothing being collected is the most
 * serious state this card can report, so it must never render as the calmest.
 */
export function isKeepingUp(m: CollectionMetrics): boolean {
  if (m.enabled === 0) return false;
  return m.worstLateness === null || m.worstLateness < LATENESS_DEGRADED;
}

export async function getCollectionMetrics(): Promise<CollectionMetrics> {
  const db = await getDatabase();
  const result = await db.query<QueryResultRow & {
    enabled: string | number;
    disabled: string | number;
    overdue: string | number;
    oldest_minutes: string | number | null;
    worst_lateness: string | number | null;
  }>(
    // Lateness is measured per target against ITS OWN cadence, then maxed — a domain-age target on a
    // 30-day cadence being a day late is fine; a catalogue on a 6-hour cadence being a day late is
    // not, and a single overall "oldest wait" would rank them identically.
    `SELECT
       (SELECT COUNT(*) FROM collection_targets WHERE enabled) AS enabled,
       (SELECT COUNT(*) FROM collection_targets WHERE NOT enabled) AS disabled,
       (SELECT COUNT(*) FROM collection_targets WHERE enabled AND next_due_at <= NOW()) AS overdue,
       (SELECT MAX(EXTRACT(EPOCH FROM (NOW() - next_due_at)) / 60)
          FROM collection_targets WHERE enabled AND next_due_at <= NOW()) AS oldest_minutes,
       (SELECT MAX((EXTRACT(EPOCH FROM (NOW() - next_due_at)) / 60) / GREATEST(cadence_minutes, 1))
          FROM collection_targets WHERE enabled AND next_due_at <= NOW()) AS worst_lateness`,
  );
  const row = result.rows[0];
  const num = (v: string | number | null | undefined) => (v === null || v === undefined ? null : Number(v));
  return {
    enabled: Number(row?.enabled ?? 0),
    disabled: Number(row?.disabled ?? 0),
    overdue: Number(row?.overdue ?? 0),
    oldestOverdueMinutes: num(row?.oldest_minutes),
    worstLateness: num(row?.worst_lateness),
  };
}

/** "4h" / "3d" — a wait is easier to judge than a count of minutes. */
export function describeWait(minutes: number): string {
  if (minutes < 90) return `${Math.round(minutes)}m`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (60 * 24))}d`;
}
