// The one verdict, so two pages cannot disagree about whether the system is well.
//
// /status derived this inline. Putting the same judgement on /admin by copying it would have
// created exactly the failure this codebase has fixed twice already — two surfaces answering the
// same question from two implementations, drifting the moment one is edited. The owner reads
// /admin; the public reads /status; a disagreement between them is worse than either being wrong.
//
// Pure: every input arrives as a plain value, so the whole ladder is testable without a database.

export type HealthLevel = "operational" | "degraded" | "outage";

export interface SystemHealthInputs {
  readiness: { status: "ready" | "degraded" | "not_ready"; schema: { expected: number; actual: number | null } };
  /** Null means the subsystem could not be read — which is itself degraded, never "fine". */
  collectors: { enabled: number; overdue: number; failing: number; oldestOverdueMinutes: number | null; keepingUp: boolean } | null;
  refresh: { enabled: number; failed: number; worstLateness: number | null; behind: boolean } | null;
  intelligenceReporting: boolean;
  sweep: { lastRanAt: string | null; lastOk: boolean; backlogReaders: number; healthy: boolean; keepingUp: boolean } | null;
}

export interface SystemHealth {
  level: HealthLevel;
  /** The single sentence both pages show. */
  headline: string;
}

/** "4h" / "3d" — a wait is easier to judge than a count of minutes. */
export function describeWaitMinutes(minutes: number): string {
  if (minutes < 90) return `${Math.round(minutes)}m`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (60 * 24))}d`;
}

export function deriveSystemHealth(input: SystemHealthInputs): SystemHealth {
  const { readiness, collectors, refresh, sweep } = input;
  const degraded = (headline: string): SystemHealth => ({ level: "degraded", headline });

  if (readiness.status === "not_ready") return { level: "outage", headline: "Major outage — the database is unreachable" };
  if (readiness.status === "degraded") {
    return degraded(`Degraded — database schema is at ${readiness.schema.actual}, expected ${readiness.schema.expected}`);
  }
  // A subsystem that cannot be read is not a healthy subsystem. Reporting "operational" because a
  // query failed is the precise lie this page exists to prevent.
  if (!collectors || !refresh || !sweep || !input.intelligenceReporting) {
    return degraded("Degraded — one or more subsystems are not reporting");
  }
  if (collectors.enabled === 0) return degraded("Degraded — no collectors are registered, so nothing is being gathered");
  if (!collectors.keepingUp) {
    const waited = describeWaitMinutes(collectors.oldestOverdueMinutes ?? 0);
    // Name the cause. "Behind" alone is not actionable: a slow queue drains on its own, a queue of
    // failing targets never will.
    const because = collectors.failing > 0 ? `${collectors.failing} ${collectors.failing === 1 ? "source is" : "sources are"} failing` : "none are failing, so the queue is draining";
    return degraded(`Degraded — collectors are behind; the oldest source has waited ${waited} past its schedule (${because})`);
  }
  if (refresh.enabled === 0) return degraded("Degraded — no sources are enabled, so nothing is being refreshed");
  if (refresh.behind) return degraded(`Degraded — the refresh queue is behind; the worst source is ${Math.round(refresh.worstLateness ?? 0)}x its own interval late`);
  if (refresh.failed > 0) return degraded(`Degraded — ${refresh.failed} refresh ${refresh.failed === 1 ? "job has" : "jobs have"} failed`);
  if (!sweep.healthy) {
    if (sweep.lastRanAt === null) return degraded("Degraded — the alert sweep has never run, so nobody is being notified while they are away");
    if (!sweep.lastOk) return degraded("Degraded — the alert sweep failed on one or more readers");
    return degraded("Degraded — the alert sweep has not completed on schedule");
  }
  // Not a fault, and it must not be phrased as one: the sweep ran, succeeded, and is simply too
  // small for the number of readers now subscribed. The honest complaint is coverage.
  if (!sweep.keepingUp) {
    return degraded(`Degraded — the alert sweep is behind; ${sweep.backlogReaders} subscribed readers were not reached on its last tick`);
  }
  return { level: "operational", headline: "All systems operational" };
}
