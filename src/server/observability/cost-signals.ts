// Counting the operations that are supposed to be rare, so a broken cache is visible before it is
// expensive. See cost-signals-schema.ts for why this exists.
import type { SqlConnection } from "@/server/db/client";
import { getDatabase } from "@/server/db/client";
import { reportError } from "./alerts";

/** Operations worth counting. Each is something that should happen a handful of times a day. */
export type CostMetric = "catalog-compute";

/**
 * Daily ceilings. Crossing one does not mean something is broken — it means something changed
 * enough to be worth a look while it is still cheap.
 *
 * The catalog snapshot is cached for 6 hours and invalidated once a day by the collect cron, so a
 * healthy day is single digits. Serverless cold starts and preview deployments add some noise, so
 * the threshold sits well above expected rather than at it: a false alarm trains you to ignore the
 * channel, which is how the original outage went unnoticed.
 */
const DAILY_LIMIT: Record<CostMetric, number> = {
  "catalog-compute": 200,
};

/** Record one occurrence. Never throws and never blocks — it is bookkeeping, not the work. */
export async function countCostSignal(metric: CostMetric, connection?: SqlConnection): Promise<void> {
  try {
    const db = connection ?? (await getDatabase());
    await db.query(
      `INSERT INTO cost_signals(day, metric, count) VALUES (CURRENT_DATE, $1, 1)
       ON CONFLICT (day, metric) DO UPDATE SET count = cost_signals.count + 1`,
      [metric],
    );
  } catch {
    /* a counter that breaks the thing it counts is worse than no counter */
  }
}

export interface CostReport { metric: string; today: number; limit: number; overLimit: boolean }

/**
 * Read today's counters and alert on anything past its ceiling. Called from the daily cron.
 *
 * Returns the full picture rather than only the breaches, so the cron response is a usable
 * dashboard even when nothing is wrong.
 */
export async function reviewCostSignals(connection?: SqlConnection): Promise<CostReport[]> {
  const db = connection ?? (await getDatabase());
  const rows = (await db.query<{ metric: string; count: string | number }>(
    `SELECT metric, count FROM cost_signals WHERE day = CURRENT_DATE`,
  )).rows;

  const seen = new Map(rows.map((r) => [r.metric, Number(r.count)]));
  const report: CostReport[] = (Object.keys(DAILY_LIMIT) as CostMetric[]).map((metric) => {
    const today = seen.get(metric) ?? 0;
    const limit = DAILY_LIMIT[metric];
    return { metric, today, limit, overLimit: today > limit };
  });

  for (const r of report.filter((r) => r.overLimit)) {
    reportError({
      kind: `cost-signal-${r.metric}`,
      severity: "critical",
      message: `${r.metric} ran ${r.today} times today, against an expected ceiling of ${r.limit}. Something is bypassing the cache — this is how the database quota was exhausted before. Check for a newly added force-dynamic or an uncached call path.`,
      context: { metric: r.metric, today: r.today, limit: r.limit },
    });
  }
  return report;
}
