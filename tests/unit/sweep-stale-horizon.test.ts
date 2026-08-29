import { describe, expect, it } from "vitest";
import { isSweepHealthy, SWEEP_STALE_HOURS } from "@/server/notifications/sweep";

// Phase 1.6: the notification sweep runs every six hours, so a 48-hour horizon lets eight missed
// ticks pass silently. Thirteen hours catches two missed ticks and still tolerates one slow one.
describe("the sweep is called stale after two missed six-hourly ticks", () => {
  const health = (hoursSinceLastRun: number) => ({ lastRanAt: "2026-08-29T00:00:00.000Z", lastSweptUsers: 5, lastOk: true, hoursSinceLastRun, waitingReaders: 5, backlogReaders: 0 });
  it("is unhealthy at 14 hours", () => {
    // Fails while the horizon is 48 hours.
    expect(isSweepHealthy(health(14))).toBe(false);
  });
  it("is healthy at 12 hours (control)", () => {
    expect(isSweepHealthy(health(12))).toBe(true);
  });
  it("documents the horizon", () => {
    expect(SWEEP_STALE_HOURS).toBe(13);
  });
});
