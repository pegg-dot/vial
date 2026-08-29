import { describe, expect, it } from "vitest";
import { computeListingTrend, describeListingTrend, type PricePoint } from "@/lib/price-trend";

// Phase 2 (D6 + §5 copy) of docs/superpowers/specs/2026-08-29-vial-price-truth-design.md. A change
// is shown only when it is earned; every other state says exactly what is known. Pure functions,
// so the rule can be tested without a database, and the copy without a browser.

const today = new Date("2026-08-29T12:00:00Z");
const day = (daysAgo: number) => new Date(today.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);
const pt = (daysAgo: number, price: number | null, available = price !== null): PricePoint => ({ day: day(daysAgo), price, available });

describe("computeListingTrend", () => {
  it("has no trend from a single check", () => {
    // Fails if one point yields a 0 % change (the old (last-first)/first on a write-once array).
    const trend = computeListingTrend([pt(0, 34.95)], today);
    expect(trend.state).toBe("none");
    expect(describeListingTrend(trend)).toMatch(/checked once, on .*no trend yet/i);
  });

  it("is insufficient when the span is under 14 days, and says how many checks since when", () => {
    const trend = computeListingTrend([pt(9, 34.95), pt(3, 29.95), pt(0, 29.95)], today);
    expect(trend.state).toBe("insufficient");
    expect(describeListingTrend(trend)).toMatch(/3 checks since .*too short a span for a 30-day change.*\$29\.95/i);
  });

  it("shows a 30-day change once a baseline, a fresh latest point and a 14-day span all exist", () => {
    // Fails if the baseline window (≤7 d before the window start) or the freshness (≤2 d) rule is dropped.
    const trend = computeListingTrend([pt(33, 34.95), pt(12, 29.95), pt(1, 29.95)], today);
    expect(trend.state).toBe("trending");
    if (trend.state !== "trending") throw new Error("unreachable");
    expect(trend.pct).toBeCloseTo(-14.3, 1);
    expect(trend.base).toEqual({ day: day(33), price: 34.95 });
    expect(trend.latest).toEqual({ day: day(1), price: 29.95 });
    expect(describeListingTrend(trend)).toMatch(/−14\.3 % over 30 days · 3 checks · \$34\.95 on .* → \$29\.95 on .*observed, not projected/i);
  });

  it("does not show a change when the latest check is older than two days, and says it is stale", () => {
    // Fails if a stale series can still print a percentage.
    const trend = computeListingTrend([pt(40, 34.95), pt(20, 29.95), pt(5, 29.95)], today);
    expect(trend.state).toBe("insufficient");
    expect(trend.staleDays).toBe(5);
    expect(describeListingTrend(trend)).toMatch(/last checked 5 days ago/i);
  });

  it("does not use a baseline from before the seven-day tolerance", () => {
    // Fails if any old point is accepted as the 30-day baseline.
    const trend = computeListingTrend([pt(60, 34.95), pt(1, 29.95)], today);
    expect(trend.state).toBe("insufficient");
  });

  it("reports unavailable-at-last-check with the last observed price", () => {
    const trend = computeListingTrend([pt(33, 34.95), pt(1, null, false)], today);
    expect(trend.state).toBe("unavailable");
    expect(describeListingTrend(trend)).toMatch(/not available when last checked.*last observed price \$34\.95 on/i);
  });

  it("never uses buy language", () => {
    for (const points of [[pt(0, 34.95)], [pt(9, 34.95), pt(0, 29.95)], [pt(33, 34.95), pt(1, 29.95)], [pt(33, 34.95), pt(1, null, false)]]) {
      expect(describeListingTrend(computeListingTrend(points, today))).not.toMatch(/\b(buy|deal|bargain|grab|hurry|stock up)\b/i);
    }
  });
});
