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
    expect(isSweepHealthy({ lastRanAt: null, lastSweptUsers: 0, lastOk: false, hoursSinceLastRun: null, waitingReaders: 12, backlogReaders: 12 })).toBe(false);
  });

  it("does not cry degraded on a fresh deployment with nobody subscribed", async () => {
    const { isSweepHealthy } = await import("@/server/notifications/sweep");
    // Nobody is waiting, so nobody is being failed. A status page that reports degraded on day one
    // teaches its reader to stop looking, which costs more than it saves.
    expect(isSweepHealthy({ lastRanAt: null, lastSweptUsers: 0, lastOk: false, hoursSinceLastRun: null, waitingReaders: 0, backlogReaders: 0 })).toBe(true);
  });

  it("treats a recent clean tick that swept nobody as HEALTHY", async () => {
    const { isSweepHealthy } = await import("@/server/notifications/sweep");
    // Zero readers swept is a legitimate answer; it must not read as an outage.
    expect(isSweepHealthy({ lastRanAt: "2026-08-25T00:00:00.000Z", lastSweptUsers: 0, lastOk: true, hoursSinceLastRun: 6, waitingReaders: 0, backlogReaders: 0 })).toBe(true);
  });

  it("treats a stale tick as unhealthy even though it succeeded", async () => {
    const { isSweepHealthy, SWEEP_STALE_HOURS } = await import("@/server/notifications/sweep");
    expect(isSweepHealthy({ lastRanAt: "2026-08-01T00:00:00.000Z", lastSweptUsers: 40, lastOk: true, hoursSinceLastRun: SWEEP_STALE_HOURS + 1, waitingReaders: 40, backlogReaders: 0 })).toBe(false);
  });

  it("treats a recent failed tick as unhealthy", async () => {
    const { isSweepHealthy } = await import("@/server/notifications/sweep");
    expect(isSweepHealthy({ lastRanAt: "2026-08-25T00:00:00.000Z", lastSweptUsers: 3, lastOk: false, hoursSinceLastRun: 1, waitingReaders: 3, backlogReaders: 0 })).toBe(false);
  });

  // Stopping on the budget is the behaviour the sweep was BUILT to have, and it used to be recorded
  // as ok:false. With a 200-reader cap inside 90s, any per-reader cost over ~450ms makes that happen
  // every tick — so the one page whose job is telling a real fault from a quiet one said "the alert
  // sweep has not completed on schedule" continuously, which teaches its reader to stop looking.
  it("does not treat a clean stop on the budget as a fault", async () => {
    const { isSweepHealthy, isSweepKeepingUp } = await import("@/server/notifications/sweep");
    const budgetStopped = { lastRanAt: "2026-08-25T00:00:00.000Z", lastSweptUsers: 200, lastOk: true, hoursSinceLastRun: 2, waitingReaders: 260, backlogReaders: 60 };
    expect(isSweepHealthy(budgetStopped)).toBe(true);
    // 60 readers is inside a single tick's capacity, so tomorrow's tick clears it — nobody waits
    // longer than the staleness horizon every other judgement here is made against.
    expect(isSweepKeepingUp(budgetStopped)).toBe(true);
  });

  it("still says so when the backlog is bigger than a tick can clear", async () => {
    const { isSweepHealthy, isSweepKeepingUp, NOTIFICATION_SWEEP_USERS } = await import("@/server/notifications/sweep");
    const behind = { lastRanAt: "2026-08-25T00:00:00.000Z", lastSweptUsers: NOTIFICATION_SWEEP_USERS, lastOk: true, hoursSinceLastRun: 2, waitingReaders: NOTIFICATION_SWEEP_USERS * 4, backlogReaders: NOTIFICATION_SWEEP_USERS * 3 };
    // Nothing failed — and somebody is still waiting days for an alert. Two different sentences.
    expect(isSweepHealthy(behind)).toBe(true);
    expect(isSweepKeepingUp(behind)).toBe(false);
  });
});

// `last_result_count` had two writers meaning different things: the manual Run path stored
// `results.length` (capped at the page size) while the cron stores `totalMatches`. Pressing Run on
// a search with more matches than the page size wrote the CAP, and the next nightly tick compared
// the cap to the real total and announced new matches for a search where nothing had changed.
describe("the saved-search baseline has one meaning", () => {
  it("would fire a fabricated alert if a page size were ever stored as the count", async () => {
    const { shouldAlertOnResultChange } = await import("@/server/notifications/saved-search-alerts");
    // 120 real matches, but a page-size of 30 got written by the other writer.
    expect(shouldAlertOnResultChange({ mode: "important", previousCount: 30, currentCount: 120 })).toBe(true);
    // Stored consistently, the same search is correctly silent.
    expect(shouldAlertOnResultChange({ mode: "important", previousCount: 120, currentCount: 120 })).toBe(false);
  });

  it("stores the match count, not the displayed count, on the manual Run path", async () => {
    // Guards the specific regression: runSavedSearch calls searchMarket with limit:30, so storing
    // `results.length` there silently means "at most 30".
    const { readFileSync } = await import("node:fs");
    const service = readFileSync(new URL("../../src/server/consumer-intelligence/service.ts", import.meta.url), "utf8");
    const call = /updateSavedSearchResult\(userId,id,([^)]*)\)/.exec(service);
    expect(call, "runSavedSearch no longer updates the saved-search result count").toBeTruthy();
    expect(
      call![1],
      "the manual Run path must store the same quantity the cron compares against",
    ).toContain("totalMatches");
  });
});
