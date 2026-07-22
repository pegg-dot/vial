import { describe, expect, it } from "vitest";
import { bucketByAge, detectBrokenCollectors } from "@/server/health/data-health";

const asOf = new Date("2026-07-22T00:00:00Z");
const daysAgo = (n: number) => new Date(asOf.getTime() - n * 86_400_000).toISOString();

describe("bucketByAge", () => {
  it("buckets timestamps into fresh / aging / stale / missing", () => {
    const b = bucketByAge([daysAgo(5), daysAgo(20), daysAgo(120), null, "not-a-date"], asOf, 14, 45);
    expect(b).toEqual({ fresh: 1, aging: 1, stale: 1, missing: 2, total: 5 });
  });
});

describe("detectBrokenCollectors", () => {
  it("flags a source that yielded data before and now yields zero", () => {
    const broken = detectBrokenCollectors([
      { collector: "shopify", target: "umbrellalabs.is", items: 48, ok: true, ranAt: "2026-07-01" },
      { collector: "shopify", target: "umbrellalabs.is", items: 0, ok: true, ranAt: "2026-07-22" },
    ]);
    expect(broken).toHaveLength(1);
    expect(broken[0]).toMatchObject({ target: "umbrellalabs.is", previousItems: 48, latestItems: 0 });
  });

  it("flags a source whose latest run failed outright", () => {
    const broken = detectBrokenCollectors([
      { collector: "woo", target: "x.com", items: 10, ok: true, ranAt: "2026-07-01" },
      { collector: "woo", target: "x.com", items: 0, ok: false, ranAt: "2026-07-22" },
    ]);
    expect(broken).toHaveLength(1);
    expect(broken[0].latestOk).toBe(false);
  });

  it("does NOT flag a source that has always been empty (never worked)", () => {
    const broken = detectBrokenCollectors([
      { collector: "shopify", target: "never.com", items: 0, ok: true, ranAt: "2026-07-01" },
      { collector: "shopify", target: "never.com", items: 0, ok: true, ranAt: "2026-07-22" },
    ]);
    expect(broken).toHaveLength(0);
  });

  it("does NOT flag a healthy source that still yields data", () => {
    const broken = detectBrokenCollectors([
      { collector: "shopify", target: "ok.com", items: 30, ok: true, ranAt: "2026-07-01" },
      { collector: "shopify", target: "ok.com", items: 31, ok: true, ranAt: "2026-07-22" },
    ]);
    expect(broken).toHaveLength(0);
  });

  it("recovers: a source that broke then came back is not flagged", () => {
    const broken = detectBrokenCollectors([
      { collector: "shopify", target: "flaky.com", items: 20, ok: true, ranAt: "2026-07-01" },
      { collector: "shopify", target: "flaky.com", items: 0, ok: true, ranAt: "2026-07-10" },
      { collector: "shopify", target: "flaky.com", items: 22, ok: true, ranAt: "2026-07-22" },
    ]);
    expect(broken).toHaveLength(0);
  });
});
