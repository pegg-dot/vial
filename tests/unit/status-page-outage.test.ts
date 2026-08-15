import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The status page could not report an outage.
//
// It hardcoded "All systems operational" and "Catalog: Working", and then queried the database for
// its other two cards. So a real database outage produced both failures at once: the page threw a
// 500 because the reads failed, while the markup it was trying to render asserted that everything
// was fine. The single page whose job is to tell you the truth during an incident was the one page
// structurally incapable of reporting one.
//
// This test drives the page with every database read failing and asserts two things: it renders at
// all, and what it renders says there is an outage.

const OUTAGE = new Error("connect ECONNREFUSED 10.42.7.19:5432");

vi.mock("@/server/db/client", () => ({
  getDatabase: vi.fn(async () => {
    throw OUTAGE;
  }),
}));
vi.mock("@/server/refresh/repository", () => ({
  getRefreshMetrics: vi.fn(async () => {
    throw OUTAGE;
  }),
}));
vi.mock("@/server/intelligence/repository", () => ({
  getIntelligenceMetrics: vi.fn(async () => {
    throw OUTAGE;
  }),
}));

const StatusPage = (await import("@/app/status/page")).default;

/**
 * Collects every string the page put into the tree — children *and* props such as `value` and
 * `detail`, because the cards are components that are not rendered without react-dom.
 */
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

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/status during a database outage", () => {
  it("renders instead of throwing", async () => {
    // The old page did `await Promise.all([getRefreshMetrics(), getIntelligenceMetrics()])`
    // unguarded, so this line alone rejected and the route 500ed.
    await expect(StatusPage()).resolves.toBeTruthy();
  });

  it("reports the outage rather than claiming everything is operational", async () => {
    const text = strings(await StatusPage()).join(" | ");
    expect(text).toContain("Major outage");
    expect(text).not.toContain("All systems operational");
  });

  it("marks the catalog unavailable rather than Working", async () => {
    const text = strings(await StatusPage()).join(" | ");
    expect(text).toContain("Unavailable");
    expect(text).not.toContain("Working");
  });

  it("shows no numbers for subsystems it could not read", async () => {
    // "0 queued · 0 stale" during an outage is a lie shaped like a measurement.
    const text = strings(await StatusPage()).join(" | ");
    expect(text).toContain("Not reporting");
    expect(text).not.toContain("0 enabled");
    expect(text).not.toContain("0 traces");
  });
});
