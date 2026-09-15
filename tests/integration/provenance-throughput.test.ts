// The refresh sweep must report what it achieved, not just that it ran.
//
// On 2026-09-07 the provenance sweep moved to one run a day, sized against an ASSUMPTION of 1s per
// job. Production answered a week later: /status showed 497 jobs queued and 499 of 699 policies
// stale, a steady ~71% backlog. Nothing anywhere had said so, because this was the only queue in
// the system that recorded nothing about its own throughput — the collector queue and the
// notification sweep both write a collector_runs row, and this one did not. A sweep finishing a
// fraction of a day's work was indistinguishable from a healthy one.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests, type SqlConnection } from "@/server/db/client";
import { runRefreshSweep } from "@/server/refresh/scheduler";
import {
  PROVENANCE_BUDGET_MS, PROVENANCE_CONCURRENCY, PROVENANCE_ASSUMED_JOB_MS, perUnitBudgetMs,
} from "@/server/collect/schedule-capacity";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "provenance-throughput-secret-at-least-32-chars!!";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "provenance-throughput-privacy-at-least-32-chars!";

let db: SqlConnection;
beforeAll(async () => { await resetDatabaseForTests(); db = await getDatabase(); });
afterAll(async () => { await resetDatabaseForTests(); });

const runs = async () => (await db.query<{ collector: string; items: number; ok: boolean }>(
  `SELECT collector, items, ok FROM collector_runs WHERE collector = 'provenance-sweep' ORDER BY ran_at DESC`,
)).rows;

describe("the sweep leaves a record of its own throughput", () => {
  beforeEach(async () => { await db.query(`DELETE FROM collector_runs WHERE collector = 'provenance-sweep'`); });

  it("writes a run row even when there is nothing queued", async () => {
    const result = await runRefreshSweep(10, 5_000, 2);
    const rows = await runs();
    expect(rows, "a sweep that processed nothing must still say so").toHaveLength(1);
    expect(rows[0].items).toBe(result.processed);
  });

  // A run that stopped on its budget is the finding, so it must not be recorded as a clean run.
  it("records a budget-exhausted run as NOT ok", async () => {
    await runRefreshSweep(1000, 0, 2);
    const rows = await runs();
    expect(rows).toHaveLength(1);
    expect(rows[0].ok).toBe(false);
  });

  it("records a completed run as ok", async () => {
    const result = await runRefreshSweep(10, 30_000, 2);
    expect(result.budgetExhausted).toBe(false);
    expect((await runs())[0].ok).toBe(true);
  });
});

describe("the daily sweep affords a realistic amount of time per job", () => {
  // 897 product pages on the public sitemap; 1.5x for headroom. The per-job budget this yields is
  // the number that was wrong before: 1.78s, against network fetches to other people's storefronts.
  const DEMAND = 897 * 1.5;

  it("gives each job more than the floor the constants declare", () => {
    expect(perUnitBudgetMs(DEMAND, PROVENANCE_BUDGET_MS, PROVENANCE_CONCURRENCY))
      .toBeGreaterThan(PROVENANCE_ASSUMED_JOB_MS);
  });

  it("is materially wider than the configuration that produced the backlog", () => {
    const before = perUnitBudgetMs(DEMAND, 200_000, 12);
    const now = perUnitBudgetMs(DEMAND, PROVENANCE_BUDGET_MS, PROVENANCE_CONCURRENCY);
    expect(now).toBeGreaterThan(before * 2);
  });

  // The run must still finish inside the function ceiling, or it is killed mid-flight and leaves
  // claimed jobs stranded — which is worse than under-running.
  it("leaves headroom under the 300s function ceiling", () => {
    expect(PROVENANCE_BUDGET_MS).toBeLessThan(300_000);
    expect(300_000 - PROVENANCE_BUDGET_MS).toBeGreaterThanOrEqual(15_000);
  });
});
