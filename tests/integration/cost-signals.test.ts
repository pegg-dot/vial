import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { countCostSignal, reviewCostSignals } from "@/server/observability/cost-signals";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "cost-signals-test-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "cost-signals-privacy-secret-at-least-32-chars";

// The database quota was exhausted because nothing was cached, and the only symptom was the site
// dying two weeks later. Caching fixed it, but caching is the kind of thing a later edit breaks
// silently — everything still works, it just costs a hundred times more. These tests pin the canary
// that makes that visible while it is still cheap.
describe("cost signals", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("counts occurrences for today", async () => {
    const db = await getDatabase();
    await db.query(`DELETE FROM cost_signals`);
    await countCostSignal("catalog-compute", db);
    await countCostSignal("catalog-compute", db);
    const n = (await db.query<{ count: string }>(`SELECT count FROM cost_signals WHERE metric='catalog-compute' AND day=CURRENT_DATE`)).rows[0];
    expect(Number(n?.count)).toBe(2);
  });

  it("reports normal usage without alerting", async () => {
    const db = await getDatabase();
    await db.query(`DELETE FROM cost_signals`);
    await countCostSignal("catalog-compute", db);
    const report = await reviewCostSignals(db);
    const row = report.find((r) => r.metric === "catalog-compute");
    expect(row?.overLimit).toBe(false);
  });

  it("flags the cache being bypassed", async () => {
    const db = await getDatabase();
    // Stand in for a `force-dynamic` that slipped back into a layout: the work still succeeds, it
    // simply runs on every request. That is precisely the condition that emptied the quota.
    await db.query(`DELETE FROM cost_signals`);
    await db.query(`INSERT INTO cost_signals(day, metric, count) VALUES (CURRENT_DATE, 'catalog-compute', 5000)`);
    const report = await reviewCostSignals(db);
    const row = report.find((r) => r.metric === "catalog-compute");
    expect(row?.overLimit).toBe(true);
    expect(row?.today).toBe(5000);
  });

  it("never lets the counter break the operation it is counting", async () => {
    const exploding = { query: vi.fn().mockRejectedValue(new Error("database gone")) };
    await expect(countCostSignal("catalog-compute", exploding as never)).resolves.toBeUndefined();
  });
});
