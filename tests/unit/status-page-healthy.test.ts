import { describe, expect, it, vi } from "vitest";
import { CURRENT_SCHEMA_VERSION } from "@/server/db/migrations";

// The companion to status-page-outage.test.ts. That file proves the page can report a failure; this
// one proves it still reports success when there is one — i.e. that the fix replaced a hardcoded
// "All systems operational" with a derivation, rather than with a differently-hardcoded string.

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
// A healthy system has collectors, and they are inside their cadence. This fixture had to change
// when the Collectors card landed, which is the point: "healthy" now includes something it did not
// before, and a stale fixture would have gone on asserting operational while the page said
// otherwise. isKeepingUp is deliberately NOT mocked — the real predicate judges these numbers.
vi.mock("@/server/collect/metrics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/collect/metrics")>()),
  getCollectionMetrics: vi.fn(async () => ({
    enabled: 99, disabled: 0, overdue: 6, oldestOverdueMinutes: 42, worstLateness: 0.4,
  })),
}));

const StatusPage = (await import("@/app/status/page")).default;

function strings(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) strings(child, out);
    return out;
  }
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: Record<string, unknown> }).props ?? {};
    for (const [key, value] of Object.entries(props)) {
      if (key === "className" || key === "style") continue;
      strings(value, out);
    }
  }
  return out;
}

describe("/status when everything is healthy", () => {
  it("reports operational and shows the real figures", async () => {
    const text = strings(await StatusPage()).join(" | ");
    expect(text).toContain("All systems operational");
    expect(text).toContain("Working");
    expect(text).toContain("12 enabled");
    expect(text).toContain("4 queued · 2 stale");
    expect(text).toContain("118 traces");
    expect(text).toContain("7 alerts · 5 open signals");
    expect(text).toContain("99 enabled");
    expect(text).toContain("6 waiting · oldest 42m past due");
    expect(text).not.toContain("Major outage");
    expect(text).not.toContain("Not reporting");
  });
});
