import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.VIALGRADE_PGLITE_MEMORY = "true";

// Phase 1.1 of docs/superpowers/specs/2026-08-29-vial-price-truth-design.md. On 2026-08-29 the
// public /status page read "Degraded — the refresh queue is behind; the worst source is 4x its own
// interval late" with 48 policies due against 4.5× capacity. They were not slow, they were stuck:
// a job left `running` by a function killed at its 120 s ceiling is never re-claimed, and
// enqueueDueRefreshJobs skips any policy that has a running job — forever.

type Modules = {
  getDatabase: typeof import("@/server/db/client").getDatabase;
  runRefreshSweep: typeof import("@/server/refresh/scheduler").runRefreshSweep;
};

describe("a refresh job orphaned mid-run is reclaimed, not abandoned", () => {
  let m: Modules;
  let stuckPolicy: string;
  let livePolicy: string;

  beforeAll(async () => {
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
    const [database, scheduler] = await Promise.all([import("@/server/db/client"), import("@/server/refresh/scheduler")]);
    m = { getDatabase: database.getDatabase, runRefreshSweep: scheduler.runRefreshSweep };
    const db = await m.getDatabase();
    const policies = (await db.query<{ id: string }>(`SELECT id FROM source_refresh_policies WHERE enabled ORDER BY id LIMIT 2`)).rows;
    if (policies.length < 2) throw new Error("fixture seed should provide at least two refresh policies");
    [stuckPolicy, livePolicy] = [policies[0].id, policies[1].id];
    // Park every other policy so the sweep only has these two to look at.
    await db.query(`UPDATE source_refresh_policies SET next_run_at = NOW() + INTERVAL '1 day'`);
    await db.query(`UPDATE source_refresh_policies SET next_run_at = NOW() - INTERVAL '1 hour' WHERE id IN ($1, $2)`, [stuckPolicy, livePolicy]);
    await db.query(
      `INSERT INTO refresh_jobs (id, policy_id, trigger_type, status, priority, available_at, started_at, attempt_count, idempotency_key, created_by)
       VALUES ('job:stuck', $1, 'scheduled', 'running', 100, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '20 minutes', 1, 'stuck', 'test'),
              ('job:in-flight', $2, 'scheduled', 'running', 100, NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '2 minutes', 1, 'in-flight', 'test')`,
      [stuckPolicy, livePolicy],
    );
  });

  afterAll(async () => {
    const db = await m.getDatabase();
    await db.close();
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
  });

  const job = async (id: string) => {
    const db = await m.getDatabase();
    return (await db.query<{ status: string; attempt_count: number }>(`SELECT status, attempt_count FROM refresh_jobs WHERE id = $1`, [id])).rows[0];
  };

  it("re-runs a job that has been 'running' far longer than any function is allowed to live", async () => {
    // Fails if nothing reclaims stale running jobs: the job stays running with attempt_count 1.
    await m.runRefreshSweep(10, 30_000);
    const stuck = await job("job:stuck");
    expect(stuck.status).not.toBe("running");
    expect(Number(stuck.attempt_count)).toBeGreaterThanOrEqual(2);
  });

  it("leaves a job that started moments ago alone (control)", async () => {
    const inFlight = await job("job:in-flight");
    expect(inFlight.status).toBe("running");
    expect(Number(inFlight.attempt_count)).toBe(1);
  });
});
