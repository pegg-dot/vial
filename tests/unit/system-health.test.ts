import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deriveSystemHealth, type SystemHealthInputs } from "@/lib/system-health";

// One verdict, two pages. /status derived this inline; putting the same judgement on /admin by
// copying it would have created two implementations of one question, drifting the moment either is
// edited. The owner reads /admin and the public reads /status — a disagreement between them is
// worse than either being wrong on its own.

function healthy(over: Partial<SystemHealthInputs> = {}): SystemHealthInputs {
  return {
    readiness: { status: "ready", schema: { expected: 51, actual: 51 } },
    collectors: { enabled: 98, overdue: 0, failing: 0, oldestOverdueMinutes: null, keepingUp: true },
    refresh: { enabled: 12, failed: 0, worstLateness: 0.2, behind: false },
    intelligenceReporting: true,
    sweep: { lastRanAt: "2026-08-26T18:30:00.000Z", lastOk: true, backlogReaders: 0, healthy: true, keepingUp: true },
    ...over,
  };
}

describe("deriveSystemHealth", () => {
  it("says operational only when every subsystem is well", () => {
    const health = deriveSystemHealth(healthy());
    expect(health.level).toBe("operational");
    expect(health.headline).toBe("All systems operational");
  });

  it("calls an unreachable database an outage, not a degradation", () => {
    const health = deriveSystemHealth(healthy({ readiness: { status: "not_ready", schema: { expected: 51, actual: null } } }));
    expect(health.level).toBe("outage");
  });

  it("names the schema mismatch, because that is the number needed to fix it", () => {
    const health = deriveSystemHealth(healthy({ readiness: { status: "degraded", schema: { expected: 51, actual: 50 } } }));
    expect(health.headline).toContain("50");
    expect(health.headline).toContain("51");
  });

  // The lie this whole surface exists to prevent: reporting health because a probe FAILED.
  it.each([
    ["collectors", { collectors: null }],
    ["refresh", { refresh: null }],
    ["sweep", { sweep: null }],
    ["intelligence", { intelligenceReporting: false }],
  ])("never reports operational when the %s probe could not be read", (_name, over) => {
    const health = deriveSystemHealth(healthy(over as Partial<SystemHealthInputs>));
    expect(health.level).toBe("degraded");
    expect(health.headline).toContain("not reporting");
  });

  it("attributes a collector backlog to failures when there are any", () => {
    const health = deriveSystemHealth(healthy({
      collectors: { enabled: 98, overdue: 36, failing: 12, oldestOverdueMinutes: 26 * 60, keepingUp: false },
    }));
    expect(health.headline).toContain("12 sources are failing");
  });

  it("says the queue is draining when a backlog has no failures behind it", () => {
    // A slow queue and a stuck queue have opposite prognoses, and "behind" alone cannot tell them
    // apart — which is exactly what made a growing backlog undiagnosable from outside.
    const health = deriveSystemHealth(healthy({
      collectors: { enabled: 98, overdue: 36, failing: 0, oldestOverdueMinutes: 26 * 60, keepingUp: false },
    }));
    expect(health.headline).toContain("none are failing");
    expect(health.headline).toContain("draining");
  });

  it("distinguishes a sweep that never ran from one that failed from one that is merely behind", () => {
    const never = deriveSystemHealth(healthy({ sweep: { lastRanAt: null, lastOk: false, backlogReaders: 0, healthy: false, keepingUp: true } }));
    expect(never.headline).toContain("never run");

    const failed = deriveSystemHealth(healthy({ sweep: { lastRanAt: "x", lastOk: false, backlogReaders: 0, healthy: false, keepingUp: true } }));
    expect(failed.headline).toContain("failed on one or more readers");

    const stale = deriveSystemHealth(healthy({ sweep: { lastRanAt: "x", lastOk: true, backlogReaders: 0, healthy: false, keepingUp: true } }));
    expect(stale.headline).toContain("not completed on schedule");

    // Behind is a COVERAGE complaint, not a fault — the sweep ran and succeeded.
    const behind = deriveSystemHealth(healthy({ sweep: { lastRanAt: "x", lastOk: true, backlogReaders: 340, healthy: true, keepingUp: false } }));
    expect(behind.headline).toContain("340 subscribed readers");
    expect(behind.headline).not.toContain("failed");
  });

  it("treats a sweep that ran and found nobody as operational", () => {
    // Zero readers is a legitimate answer on a young deployment, not an outage.
    expect(deriveSystemHealth(healthy()).level).toBe("operational");
  });
});

describe("both pages read the same verdict", () => {
  const status = readFileSync(new URL("../../src/app/status/page.tsx", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../../src/app/admin/page.tsx", import.meta.url), "utf8");

  it.each([["/status", status], ["/admin", admin]])("%s derives its headline rather than composing its own", (_name, source) => {
    expect(source).toContain("deriveSystemHealth");
  });

  it("keeps neither page hand-rolling the operational string", () => {
    // If a page starts writing its own verdict again, the two can disagree — which is the whole
    // reason this module exists.
    for (const [name, source] of [["/status", status], ["/admin", admin]] as const) {
      const isComment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line);
      const hardcoded = source
        .split("\n")
        .filter((line) => !isComment(line))
        .filter((line) => line.includes('"All systems operational"') && !line.includes("deriveSystemHealth"));
      expect(hardcoded, `${name} composes the verdict itself instead of reading it`).toEqual([]);
    }
  });

  it("puts the health band above the fold on /admin", () => {
    // The owner asked for this precisely because they would otherwise forget to look.
    const bandAt = admin.indexOf('data-testid="admin-system-health"');
    const trafficAt = admin.indexOf("Traffic you can prove you sent");
    expect(bandAt).toBeGreaterThan(-1);
    expect(bandAt, "the health band must come before the traffic report, not after it").toBeLessThan(trafficAt);
  });

  it("links from /admin to the full status page", () => {
    expect(admin).toContain('href="/status"');
  });
});
