import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { countingDay, countingDaySql } from "./counting-day";

// Per-day numbers, which the admin surfaces did not have.
//
// Everything before this was a 30-day TOTAL and a top-ten list: "4,102 views, back to work." A
// total cannot answer the questions worth asking — whether Tuesday was better than Monday, whether
// the thing you shipped moved anything, whether a spike was one link or a real change in traffic.
//
// Two rules hold this together:
//
//   1. Days are COUNTING days, not UTC days. The visitor hash is salted with the counting day so a
//      reader cannot be followed across days, and if the chart bucketed on UTC instead, a reader
//      near the boundary would be one person in the hash and two in the chart. countingDaySql is
//      the same definition the hash uses, and an invariant test fails if they ever drift.
//   2. Empty days are PRESENT, as zeroes. A series that silently omits the days nothing happened
//      draws a smooth line through a week-long outage. Gaps are the finding.
//
// What cannot be answered here, by construction: whether today's readers are the SAME people as
// yesterday's. The hash rotates daily on purpose. `readers` summed across days is reader-days, not
// people, and is named that way everywhere it is shown.

export interface DailyPoint {
  /** Counting day, YYYY-MM-DD. */
  day: string;
  views: number;
  /** Distinct visitor hashes that day. Across days these are reader-days, never people. */
  readers: number;
  /** Readers with more than one page view that day — the only "same person" this data supports. */
  returningWithinDay: number;
  clicks: number;
  /** Distinct readers who clicked through to a vendor that day. */
  clickers: number;
  conversions: number;
  revenueCents: number;
}

export interface DailySeries {
  points: DailyPoint[];
  totals: {
    views: number; readerDays: number; clicks: number; clickerDays: number;
    conversions: number; revenueCents: number;
  };
  /** Mean pages per reader across the window, weighted by day. */
  pagesPerReader: number;
  /** Share of readers who clicked through, across the window. */
  clickThroughRate: number;
}

/**
 * Every counting day in the window, oldest first, so days with nothing still appear.
 *
 * Built from countingDay, NOT from UTC dates. The first draft of this sliced `toISOString()`, which
 * is a different calendar after 8pm Eastern — the SQL buckets would key on the counting day while
 * the scaffold keyed on the UTC day, every lookup for the current day would miss, and the chart
 * would show today as empty every single evening. The module this imports from exists precisely
 * because two consumers of "a day" drifting apart is silent.
 *
 * Days are stepped from a midday anchor, which no timezone offset can push into an adjacent date.
 */
function dayScaffold(days: number): string[] {
  const today = countingDay(new Date());
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function getDailySeries(options: { days?: number; connection?: SqlConnection } = {}): Promise<DailySeries> {
  const days = Math.min(Math.max(1, options.days ?? 30), 180);
  const db = options.connection ?? await getDatabase();
  const window = `${days} days`;

  const traffic = await db.query<QueryResultRow & { day: string; views: string; readers: string; returning: string }>(
    `SELECT ${countingDaySql("created_at")} AS day,
            COUNT(*) AS views,
            COUNT(DISTINCT visitor_hash) AS readers,
            COUNT(DISTINCT visitor_hash) FILTER (WHERE per_visitor > 1) AS returning
       FROM (
         SELECT created_at, visitor_hash,
                COUNT(*) OVER (PARTITION BY visitor_hash, ${countingDaySql("created_at")}) AS per_visitor
           FROM page_views
          WHERE NOT is_bot AND created_at > NOW() - $1::interval
       ) v
      GROUP BY 1`,
    [window],
  );

  const clicks = await db.query<QueryResultRow & { day: string; clicks: string; clickers: string; conversions: string; revenue: string | null }>(
    `SELECT ${countingDaySql("created_at")} AS day,
            COUNT(*) AS clicks,
            COUNT(DISTINCT visitor_hash) AS clickers,
            COUNT(*) FILTER (WHERE converted_at IS NOT NULL) AS conversions,
            COALESCE(SUM(order_value_cents), 0) AS revenue
       FROM outbound_clicks
      WHERE NOT is_bot AND created_at > NOW() - $1::interval
      GROUP BY 1`,
    [window],
  );

  const t = new Map(traffic.rows.map(r => [r.day, r]));
  const c = new Map(clicks.rows.map(r => [r.day, r]));
  const points: DailyPoint[] = dayScaffold(days).map(day => ({
    day,
    views: Number(t.get(day)?.views ?? 0),
    readers: Number(t.get(day)?.readers ?? 0),
    returningWithinDay: Number(t.get(day)?.returning ?? 0),
    clicks: Number(c.get(day)?.clicks ?? 0),
    clickers: Number(c.get(day)?.clickers ?? 0),
    conversions: Number(c.get(day)?.conversions ?? 0),
    revenueCents: Number(c.get(day)?.revenue ?? 0),
  }));

  const sum = (pick: (p: DailyPoint) => number) => points.reduce((a, p) => a + pick(p), 0);
  const totals = {
    views: sum(p => p.views), readerDays: sum(p => p.readers),
    clicks: sum(p => p.clicks), clickerDays: sum(p => p.clickers),
    conversions: sum(p => p.conversions), revenueCents: sum(p => p.revenueCents),
  };
  return {
    points,
    totals,
    pagesPerReader: totals.readerDays > 0 ? totals.views / totals.readerDays : 0,
    clickThroughRate: totals.readerDays > 0 ? totals.clickerDays / totals.readerDays : 0,
  };
}

export interface BreakdownRow { label: string; people: number; events: number }

/** Where readers came from, by distinct readers rather than hits, so one noisy bot-ish referrer cannot dominate. */
export async function getSourceBreakdown(options: { days?: number; limit?: number; connection?: SqlConnection } = {}): Promise<BreakdownRow[]> {
  const db = options.connection ?? await getDatabase();
  const rows = await db.query<QueryResultRow & { label: string | null; people: string; events: string }>(
    `SELECT COALESCE(referrer_host, 'direct') AS label,
            COUNT(DISTINCT visitor_hash) AS people, COUNT(*) AS events
       FROM page_views
      WHERE NOT is_bot AND created_at > NOW() - $1::interval
      GROUP BY 1 ORDER BY people DESC, events DESC LIMIT $2`,
    [`${Math.min(Math.max(1, options.days ?? 30), 180)} days`, Math.min(Math.max(1, options.limit ?? 8), 50)],
  );
  return rows.rows.map(r => ({ label: r.label ?? "direct", people: Number(r.people), events: Number(r.events) }));
}

/** Which vendors readers actually click through to. This is the number a partner conversation opens with. */
export async function getVendorClickBreakdown(options: { days?: number; limit?: number; connection?: SqlConnection } = {}): Promise<BreakdownRow[]> {
  const db = options.connection ?? await getDatabase();
  const rows = await db.query<QueryResultRow & { label: string | null; people: string; events: string }>(
    `SELECT COALESCE(vendor_slug, '(unknown)') AS label,
            COUNT(DISTINCT visitor_hash) AS people, COUNT(*) AS events
       FROM outbound_clicks
      WHERE NOT is_bot AND created_at > NOW() - $1::interval
      GROUP BY 1 ORDER BY events DESC LIMIT $2`,
    [`${Math.min(Math.max(1, options.days ?? 30), 180)} days`, Math.min(Math.max(1, options.limit ?? 10), 50)],
  );
  return rows.rows.map(r => ({ label: r.label ?? "(unknown)", people: Number(r.people), events: Number(r.events) }));
}

/** Which compounds pull the traffic — the demand signal for what to cover next. */
export async function getCompoundClickBreakdown(options: { days?: number; limit?: number; connection?: SqlConnection } = {}): Promise<BreakdownRow[]> {
  const db = options.connection ?? await getDatabase();
  const rows = await db.query<QueryResultRow & { label: string | null; people: string; events: string }>(
    `SELECT COALESCE(compound_slug, '(unknown)') AS label,
            COUNT(DISTINCT visitor_hash) AS people, COUNT(*) AS events
       FROM outbound_clicks
      WHERE NOT is_bot AND created_at > NOW() - $1::interval
      GROUP BY 1 ORDER BY events DESC LIMIT $2`,
    [`${Math.min(Math.max(1, options.days ?? 30), 180)} days`, Math.min(Math.max(1, options.limit ?? 10), 50)],
  );
  return rows.rows.map(r => ({ label: r.label ?? "(unknown)", people: Number(r.people), events: Number(r.events) }));
}
