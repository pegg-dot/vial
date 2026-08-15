import { CURRENT_SCHEMA_VERSION } from "@/server/db/migrations";
import { getDatabase } from "@/server/db/client";

/**
 * One readiness check, read by both `/api/health/ready` and the public `/status` page.
 *
 * They used to disagree by construction: the route probed the database, while the status page
 * hardcoded "All systems operational" and then queried the database itself — so during an outage
 * the page 500ed while its own copy claimed everything was fine. A status page that cannot report
 * an outage is worse than no status page, because it converts a visible failure into a denial.
 *
 * This function therefore never throws. An unreachable database is a *result* ("not_ready"), not an
 * exception, so every caller can render it instead of crashing on it.
 */
export type ReadinessStatus = "ready" | "degraded" | "not_ready";

export interface Readiness {
  status: ReadinessStatus;
  database: "reachable" | "unreachable";
  schema: { expected: number; actual: number | null };
  latencyMs: number;
  time: string;
}

export async function checkReadiness(): Promise<Readiness> {
  const started = Date.now();
  const expected = CURRENT_SCHEMA_VERSION;
  try {
    const db = await getDatabase();
    const result = await db.query<{ version: number }>(`SELECT COALESCE(MAX(version),0)::int AS version FROM schema_migrations`);
    const actual = Number(result.rows[0]?.version ?? 0);
    return {
      status: actual === expected ? "ready" : "degraded",
      database: "reachable",
      schema: { expected, actual },
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    };
  } catch (error) {
    // The driver's own message names the host, port, database, role and pool state — a free map of
    // the infrastructure for anyone who can curl the health endpoint. It belongs in the server log,
    // which operators can read, and nowhere in the response, which anybody can read.
    console.error("[health/ready] database unreachable:", error);
    return {
      status: "not_ready",
      database: "unreachable",
      schema: { expected, actual: null },
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    };
  }
}
