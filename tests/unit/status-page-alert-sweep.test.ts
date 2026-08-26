import { describe, expect, it, vi } from "vitest";
import { CURRENT_SCHEMA_VERSION } from "@/server/db/migrations";

// The sweep that delivers alerts runs on a Vercel cron. Two crons in this repository were silently
// dead for weeks — one because a missing perimeter entry 401'd every invocation — and nothing on
// any page said so. A sweep whose whole purpose is reaching people who are NOT looking is precisely
// the one nobody would notice had stopped, so /status has to be able to say it out loud.

vi.mock("@/server/db/client", () => ({
  getDatabase: vi.fn(async () => ({
    query: async () => ({ rows: [{ version: CURRENT_SCHEMA_VERSION }], rowCount: 1 }),
  })),
}));
vi.mock("@/server/refresh/repository", () => ({
  getRefreshMetrics: vi.fn(async () => ({ enabled: 12, due: 3, queued: 4, failed: 0, stale: 2, attempts: 0, worstLateness: 0.3 })),
}));
vi.mock("@/server/intelligence/repository", () => ({
  getIntelligenceMetrics: vi.fn(async () => ({ open: 5, watching: 6, traces: 118, alerts: 7 })),
}));
vi.mock("@/server/collect/metrics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/collect/metrics")>()),
  getCollectionMetrics: vi.fn(async () => ({ enabled: 99, disabled: 0, overdue: 0, oldestOverdueMinutes: 0, worstLateness: 0.1 })),
}));
vi.mock("@/server/notifications/sweep", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/notifications/sweep")>()),
  getNotificationSweepHealth: vi.fn(async () => ({ lastRanAt: null, lastSweptUsers: 0, lastOk: false, hoursSinceLastRun: null, waitingReaders: 12, backlogReaders: 12 })),
}));

const { getNotificationSweepHealth } = await import("@/server/notifications/sweep");
const StatusPage = (await import("@/app/status/page")).default;

function strings(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") { out.push(String(node)); return out; }
  if (Array.isArray(node)) { for (const child of node) strings(child, out); return out; }
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: Record<string, unknown> }).props ?? {};
    for (const [key, value] of Object.entries(props)) {
      if (key === "className" || key === "style") continue;
      strings(value, out);
    }
  }
  return out;
}

describe("/status reports the alert sweep", () => {
  it("says so when the sweep has never run", async () => {
    const text = strings(await StatusPage()).join(" | ");
    expect(text).toContain("Never run");
    expect(text).toContain("nobody is being notified");
    // And it must not claim everything is fine while nobody is being told anything.
    expect(text).not.toContain("All systems operational");
  });

  it("says so when the sweep has stopped running on schedule", async () => {
    vi.mocked(getNotificationSweepHealth).mockResolvedValueOnce({
      lastRanAt: "2026-08-01T00:00:00.000Z", lastSweptUsers: 40, lastOk: true, hoursSinceLastRun: 200, waitingReaders: 40, backlogReaders: 0,
    });
    const text = strings(await StatusPage()).join(" | ");
    expect(text).toContain("has not completed on schedule");
    expect(text).not.toContain("All systems operational");
  });

  it("reports a sweep that is behind as coverage rather than as a broken sweep", async () => {
    // A tick that stopped on its budget succeeded. What it cost is readers it did not reach, and
    // that is the complaint this page should make — not "the sweep has not completed on schedule",
    // which is what it said on every healthy tick while a budget stop was recorded as a failure.
    vi.mocked(getNotificationSweepHealth).mockResolvedValueOnce({
      lastRanAt: "2026-08-26T00:00:00.000Z", lastSweptUsers: 200, lastOk: true, hoursSinceLastRun: 2, waitingReaders: 1_400, backlogReaders: 1_200,
    });
    const text = strings(await StatusPage()).join(" | ");
    expect(text).toContain("the alert sweep is behind");
    expect(text).toContain("1200 subscribed readers were not reached");
    expect(text).not.toContain("has not completed on schedule");
    expect(text).not.toContain("All systems operational");
  });

  it("treats a recent tick that swept nobody as operational", async () => {
    // Zero readers is a legitimate answer on a young deployment. "Ran and found nobody" must not
    // read as an outage, or the signal becomes noise and stops being watched.
    vi.mocked(getNotificationSweepHealth).mockResolvedValueOnce({
      lastRanAt: "2026-08-26T00:00:00.000Z", lastSweptUsers: 0, lastOk: true, hoursSinceLastRun: 2, waitingReaders: 0, backlogReaders: 0,
    });
    const text = strings(await StatusPage()).join(" | ");
    expect(text).toContain("All systems operational");
    expect(text).toContain("0 readers");
  });
});
