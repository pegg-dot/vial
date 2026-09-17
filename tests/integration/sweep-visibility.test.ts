// The queue counts describe the backlog. They cannot say whether the run meant to drain it
// finished — "74 queued" reads identically whether the sweep processed six hundred jobs and left a
// tail, or processed thirty and gave up on its budget. Those are opposite problems with opposite
// fixes, and for two days the sweep recorded its own throughput while nothing read it.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getDatabase, resetDatabaseForTests, type SqlConnection } from "@/server/db/client";
import { getLastSweepRun } from "@/server/refresh/repository";
import { runRefreshSweep } from "@/server/refresh/scheduler";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "sweep-visibility-secret-at-least-32-characters!!";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "sweep-visibility-privacy-at-least-32-characters!";

let db: SqlConnection;
beforeAll(async () => { await resetDatabaseForTests(); db = await getDatabase(); });
afterAll(async () => { await resetDatabaseForTests(); });

describe("the last sweep's throughput is readable", () => {
  beforeEach(async () => { await db.query(`DELETE FROM collector_runs WHERE collector = 'provenance-sweep'`); });

  it("reports nothing before a sweep has ever run", async () => {
    expect(await getLastSweepRun()).toBeNull();
  });

  it("reports what a completed run achieved", async () => {
    const result = await runRefreshSweep(10, 30_000, 2);
    const run = await getLastSweepRun();
    expect(run).not.toBeNull();
    expect(run!.items).toBe(result.processed);
    expect(run!.ok).toBe(true);
  });

  // A run that gave up on its budget must be distinguishable from one that finished.
  it("reports a budget-exhausted run as not ok", async () => {
    await runRefreshSweep(1000, 0, 2);
    expect((await getLastSweepRun())!.ok).toBe(false);
  });

  it("reports the most recent run, not the first", async () => {
    await runRefreshSweep(1000, 0, 2);          // stopped on budget
    await new Promise(r => setTimeout(r, 15));
    await runRefreshSweep(10, 30_000, 2);        // finished
    expect((await getLastSweepRun())!.ok).toBe(true);
  });

  // The whole point is that something READS it. A recorded number nobody renders is a write-only
  // feature, which is what this was for two days.
  it("is rendered on the public status page", () => {
    const page = readFileSync(new URL("../../src/app/status/page.tsx", import.meta.url), "utf8");
    expect(page).toContain("getLastSweepRun");
    expect(page).toContain("last sweep did");
    expect(page).toContain("stopped on its budget");
  });
});
