import { describe, expect, it } from "vitest";
import { asAlertMode, describeResultChange, shouldAlertOnResultChange } from "@/server/notifications/saved-search-alerts";

// `alert_mode` was stored, mapped, validated and rendered as a select — and read by nothing.
// "No alerts" and "All reviewed changes" behaved identically: neither did anything.
describe("shouldAlertOnResultChange", () => {
  it("never alerts when the reader chose off", () => {
    expect(shouldAlertOnResultChange({ mode: "off", previousCount: 3, currentCount: 9 })).toBe(false);
    expect(shouldAlertOnResultChange({ mode: "off", previousCount: 9, currentCount: 3 })).toBe(false);
  });

  it("alerts on new matches under important", () => {
    expect(shouldAlertOnResultChange({ mode: "important", previousCount: 3, currentCount: 4 })).toBe(true);
  });

  it("stays quiet when matches only disappear under important", () => {
    // Nobody saves "BPC-157 with current evidence" to be told something stopped matching.
    expect(shouldAlertOnResultChange({ mode: "important", previousCount: 9, currentCount: 3 })).toBe(false);
  });

  it("alerts in both directions under all", () => {
    expect(shouldAlertOnResultChange({ mode: "all", previousCount: 9, currentCount: 3 })).toBe(true);
    expect(shouldAlertOnResultChange({ mode: "all", previousCount: 3, currentCount: 9 })).toBe(true);
  });

  it("says nothing when the count did not move", () => {
    for (const mode of ["important", "all"] as const) {
      expect(shouldAlertOnResultChange({ mode, previousCount: 4, currentCount: 4 })).toBe(false);
    }
  });

  it("does not alert on the very first run", () => {
    // Every saved search in the database would otherwise fire the moment this shipped. That is a
    // storm, not news.
    expect(shouldAlertOnResultChange({ mode: "all", previousCount: null, currentCount: 12 })).toBe(false);
    expect(shouldAlertOnResultChange({ mode: "important", previousCount: null, currentCount: 12 })).toBe(false);
  });

  it("treats a drop to zero as a real change under all", () => {
    expect(shouldAlertOnResultChange({ mode: "all", previousCount: 5, currentCount: 0 })).toBe(true);
  });
});

describe("asAlertMode", () => {
  it("accepts the three stored values", () => {
    expect(asAlertMode("off")).toBe("off");
    expect(asAlertMode("all")).toBe("all");
    expect(asAlertMode("important")).toBe("important");
  });

  it("falls back to important rather than silently muting on junk", () => {
    // Defaulting an unreadable value to "off" would silently stop someone's alerts.
    expect(asAlertMode("urgent")).toBe("important");
    expect(asAlertMode(null)).toBe("important");
    expect(asAlertMode(undefined)).toBe("important");
  });
});

describe("describeResultChange", () => {
  it("counts up and down correctly and names the search", () => {
    const up = describeResultChange({ name: "Copper peptides", previousCount: 3, currentCount: 5 });
    expect(up.title).toContain("2 new matches");
    expect(up.title).toContain("Copper peptides");
    expect(up.body).toContain("up from 3");

    const down = describeResultChange({ name: "Copper peptides", previousCount: 5, currentCount: 3 });
    expect(down.title).toContain("2 matches dropped off");
    expect(down.body).toContain("down from 5");
  });

  it("uses the singular for one", () => {
    expect(describeResultChange({ name: "X", previousCount: 0, currentCount: 1 }).title).toContain("1 new match");
    expect(describeResultChange({ name: "X", previousCount: 1, currentCount: 0 }).title).toContain("1 match dropped off");
  });
});

// The two crons before this one were silently dead for weeks because a missing perimeter entry
// 401'd every invocation and no surface reported it. A sweep whose entire purpose is reaching
// people who are NOT looking is the one nobody would notice had stopped, so /status has to be able
// to say "never run" — and that has to be distinguishable from "ran and found nobody".
describe("sweep health", () => {
  it("treats a sweep that has never run as unhealthy WHEN readers are waiting", async () => {
    const { isSweepHealthy } = await import("@/server/notifications/sweep");
    expect(isSweepHealthy({ lastRanAt: null, lastSweptUsers: 0, lastOk: false, hoursSinceLastRun: null, waitingReaders: 12 })).toBe(false);
  });

  it("does not cry degraded on a fresh deployment with nobody subscribed", async () => {
    const { isSweepHealthy } = await import("@/server/notifications/sweep");
    // Nobody is waiting, so nobody is being failed. A status page that reports degraded on day one
    // teaches its reader to stop looking, which costs more than it saves.
    expect(isSweepHealthy({ lastRanAt: null, lastSweptUsers: 0, lastOk: false, hoursSinceLastRun: null, waitingReaders: 0 })).toBe(true);
  });

  it("treats a recent clean tick that swept nobody as HEALTHY", async () => {
    const { isSweepHealthy } = await import("@/server/notifications/sweep");
    // Zero readers swept is a legitimate answer; it must not read as an outage.
    expect(isSweepHealthy({ lastRanAt: "2026-08-25T00:00:00.000Z", lastSweptUsers: 0, lastOk: true, hoursSinceLastRun: 6, waitingReaders: 0 })).toBe(true);
  });

  it("treats a stale tick as unhealthy even though it succeeded", async () => {
    const { isSweepHealthy, SWEEP_STALE_HOURS } = await import("@/server/notifications/sweep");
    expect(isSweepHealthy({ lastRanAt: "2026-08-01T00:00:00.000Z", lastSweptUsers: 40, lastOk: true, hoursSinceLastRun: SWEEP_STALE_HOURS + 1, waitingReaders: 40 })).toBe(false);
  });

  it("treats a recent failed tick as unhealthy", async () => {
    const { isSweepHealthy } = await import("@/server/notifications/sweep");
    expect(isSweepHealthy({ lastRanAt: "2026-08-25T00:00:00.000Z", lastSweptUsers: 3, lastOk: false, hoursSinceLastRun: 1, waitingReaders: 3 })).toBe(false);
  });
});
