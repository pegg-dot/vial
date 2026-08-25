import { describe, expect, it, vi } from "vitest";
import { CURRENT_SCHEMA_VERSION } from "@/server/db/migrations";

// status-page-healthy proves the page still says "operational" when it should. It cannot prove the
// page NOTICES a starving collection queue, because its fixture is healthy — deleting the collector
// check entirely left it green. This is the missing half.
//
// It matters because the starvation it describes is not hypothetical: on 2026-08-24 the collectors
// ran at 8% of their declared cadence for an unknown length of time while /status said "All systems
// operational", and every tick had genuinely succeeded. The page needs to be able to say this.

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

const metrics = vi.hoisted(() => ({ value: { enabled: 99, disabled: 0, overdue: 0, oldestOverdueMinutes: null as number | null, worstLateness: null as number | null } }));
vi.mock("@/server/collect/metrics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/collect/metrics")>()),
  getCollectionMetrics: vi.fn(async () => metrics.value),
}));

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
const render = async () => strings(await StatusPage()).join(" | ");

describe("/status can report a starving collection queue", () => {
  // The exact production state: a 6-hour cadence served roughly every twelve days.
  it("says the collectors are behind, not that all is well", async () => {
    metrics.value = { enabled: 99, disabled: 0, overdue: 91, oldestOverdueMinutes: 60 * 24 * 12, worstLateness: 48 };
    const text = await render();
    expect(text).not.toContain("All systems operational");
    expect(text).toContain("collectors are behind");
    expect(text).toContain("12d");           // how long the oldest source has waited
    expect(text).toContain("91 waiting");
  });

  // An empty queue is trivially never late, so a naive lateness check calls it perfectly healthy.
  // It is the most serious state this card can report and must never render as the calmest.
  it("says nothing is being gathered when no collectors are registered", async () => {
    metrics.value = { enabled: 0, disabled: 0, overdue: 0, oldestOverdueMinutes: null, worstLateness: null };
    const text = await render();
    expect(text).not.toContain("All systems operational");
    expect(text).toContain("no collectors are registered");
  });

  // The refresh engine card had the same shape and the same blind spot.
  it("does not call the refresh engine healthy with nothing enabled", async () => {
    const { getRefreshMetrics } = await import("@/server/refresh/repository");
    vi.mocked(getRefreshMetrics).mockResolvedValueOnce({ enabled: 0, due: 0, queued: 0, failed: 0, stale: 0, attempts: 0, worstLateness: null });
    metrics.value = { enabled: 99, disabled: 0, overdue: 0, oldestOverdueMinutes: null, worstLateness: null };
    const text = await render();
    expect(text).not.toContain("All systems operational");
    expect(text).toContain("nothing is being refreshed");
  });

  // Sizing the refresh sweep depends on the live listing count, and that was misread once already
  // (43 off a facet count, when the sitemap carries 897 product pages). So the page has to report
  // the queue being behind on its own, rather than the arithmetic being trusted to have been right.
  it("says the refresh queue is behind when it cannot catch up", async () => {
    const { getRefreshMetrics } = await import("@/server/refresh/repository");
    vi.mocked(getRefreshMetrics).mockResolvedValueOnce({ enabled: 900, due: 640, queued: 20, failed: 0, stale: 300, attempts: 9, worstLateness: 7 });
    metrics.value = { enabled: 99, disabled: 0, overdue: 0, oldestOverdueMinutes: null, worstLateness: null };
    const text = await render();
    expect(text).not.toContain("All systems operational");
    expect(text).toContain("refresh queue is behind");
    expect(text).toContain("7x its own interval late");
  });

  // Control: a queue with work in it that is keeping up is normal and must not cry wolf.
  it("does not call a busy-but-current refresh queue behind", async () => {
    const { getRefreshMetrics } = await import("@/server/refresh/repository");
    vi.mocked(getRefreshMetrics).mockResolvedValueOnce({ enabled: 900, due: 40, queued: 20, failed: 0, stale: 10, attempts: 9, worstLateness: 0.6 });
    metrics.value = { enabled: 99, disabled: 0, overdue: 0, oldestOverdueMinutes: null, worstLateness: null };
    expect(await render()).toContain("All systems operational");
  });

  // "0 queued · N stale" is what a queue looks like when nothing has run, AND what it looks like
  // when every job ran and failed — last_succeeded_at is null either way. Production showed exactly
  // that ambiguity and the card could not resolve it.
  it("says how many refresh jobs failed rather than hiding it behind 'stale'", async () => {
    const { getRefreshMetrics } = await import("@/server/refresh/repository");
    vi.mocked(getRefreshMetrics).mockResolvedValueOnce({ enabled: 25, due: 0, queued: 0, failed: 25, stale: 25, attempts: 25, worstLateness: null });
    metrics.value = { enabled: 99, disabled: 0, overdue: 0, oldestOverdueMinutes: null, worstLateness: null };
    const text = await render();
    expect(text).toContain("25 failed");
    expect(text).not.toContain("All systems operational");
  });

  // The control: with collectors present and inside cadence, the page must still say so, or the
  // check above is just a page that always cries wolf.
  it("still reports operational when the queue is keeping up", async () => {
    metrics.value = { enabled: 99, disabled: 0, overdue: 6, oldestOverdueMinutes: 42, worstLateness: 0.4 };
    expect(await render()).toContain("All systems operational");
  });
});
