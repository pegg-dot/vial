import { describe, expect, it } from "vitest";
import { runPooled } from "@/server/collect/pool";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("runPooled", () => {
  it("runs work concurrently up to the limit, and no further", async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await runPooled(items, async () => {
      inFlight += 1; peak = Math.max(peak, inFlight);
      await sleep(5);
      inFlight -= 1;
    }, { concurrency: 4, keyOf: (i) => `host-${i}` });
    expect(peak).toBe(4);
  });

  it("never runs two items with the same key at the same time", async () => {
    const active = new Set<string>();
    let collision = false;
    // Every item belongs to one of three hosts, so the pool must serialise within each host
    // while still keeping three of them busy.
    const items = Array.from({ length: 30 }, (_, i) => ({ id: i, host: `h${i % 3}` }));
    await runPooled(items, async (item) => {
      if (active.has(item.host)) collision = true;
      active.add(item.host);
      await sleep(3);
      active.delete(item.host);
    }, { concurrency: 8, keyOf: (item) => item.host });
    expect(collision).toBe(false);
  });

  it("still saturates the pool across distinct keys", async () => {
    let peak = 0; let inFlight = 0;
    const items = Array.from({ length: 12 }, (_, i) => ({ host: `h${i}` }));
    await runPooled(items, async () => {
      inFlight += 1; peak = Math.max(peak, inFlight); await sleep(5); inFlight -= 1;
    }, { concurrency: 6, keyOf: (i) => i.host });
    expect(peak).toBe(6);
  });

  it("stops starting new work once the budget is spent, and reports it", async () => {
    const started: number[] = [];
    const items = Array.from({ length: 50 }, (_, i) => i);
    const result = await runPooled(items, async (i) => { started.push(i); await sleep(10); },
      { concurrency: 2, keyOf: (i) => `k${i}`, budgetMs: 30 });
    expect(result.budgetExhausted).toBe(true);
    expect(started.length).toBeLessThan(items.length);
    expect(result.completed).toBe(started.length);
  });

  it("finishes every item and reports no exhaustion when the budget is ample", async () => {
    const items = Array.from({ length: 9 }, (_, i) => i);
    const result = await runPooled(items, async () => { await sleep(1); },
      { concurrency: 3, keyOf: (i) => `k${i}`, budgetMs: 5_000 });
    expect(result.completed).toBe(9);
    expect(result.budgetExhausted).toBe(false);
  });

  it("one failing item never stops the rest", async () => {
    const done: number[] = [];
    const items = [0, 1, 2, 3, 4];
    const result = await runPooled(items, async (i) => {
      if (i === 2) throw new Error("vendor blocked us");
      done.push(i);
    }, { concurrency: 2, keyOf: (i) => `k${i}` });
    expect(done.sort()).toEqual([0, 1, 3, 4]);
    expect(result.completed).toBe(5);
    expect(result.failed).toBe(1);
  });

  it("releases a key when its item throws, so the host is not wedged", async () => {
    const done: string[] = [];
    const items = [{ id: "a", host: "h" }, { id: "b", host: "h" }];
    await runPooled(items, async (item) => {
      if (item.id === "a") throw new Error("boom");
      done.push(item.id);
    }, { concurrency: 4, keyOf: (i) => i.host });
    expect(done).toEqual(["b"]);
  });

  it("handles an empty list", async () => {
    const result = await runPooled([], async () => {}, { concurrency: 4, keyOf: () => "k" });
    expect(result).toEqual({ completed: 0, failed: 0, budgetExhausted: false });
  });
});
