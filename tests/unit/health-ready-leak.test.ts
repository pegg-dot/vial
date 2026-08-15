import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// /api/health/ready is unauthenticated by design — Docker's HEALTHCHECK and any uptime probe must
// reach it without a session. It returned the raw database driver message on failure, which is not
// a status: it is the host, port, database name, role and pool state of the production database,
// handed to whoever curls the URL. During an outage — the one moment the endpoint gets hit hardest
// and from the widest set of addresses — it published the infrastructure map.

const DRIVER_DETAIL = "connect ECONNREFUSED 10.42.7.19:5432 — password authentication failed for user \"vialgrade_app\"";

vi.mock("@/server/db/client", () => ({
  getDatabase: vi.fn(async () => {
    throw new Error(DRIVER_DETAIL);
  }),
}));

const { GET } = await import("@/app/api/health/ready/route");

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/api/health/ready — driver detail must not reach an anonymous caller", () => {
  it("reports the outage without quoting the driver", async () => {
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe("not_ready");
    expect(body.database).toBe("unreachable");

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(DRIVER_DETAIL);
    expect(serialized).not.toContain("ECONNREFUSED");
    expect(serialized).not.toContain("10.42.7.19");
    expect(serialized).not.toContain("5432");
    expect(serialized).not.toContain("vialgrade_app");
    expect(serialized).not.toContain("password");
    expect(body.error).toBeUndefined();
  });

  it("logs the detail server-side instead of discarding it", async () => {
    // The information is still needed — by operators reading logs, not by strangers reading JSON.
    await GET();
    expect(errorLog).toHaveBeenCalled();
    expect(errorLog.mock.calls.flat().map(String).join(" ")).toContain("ECONNREFUSED");
  });

  it("keeps the fields probes actually depend on", async () => {
    const body = await (await GET()).json();
    expect(typeof body.latencyMs).toBe("number");
    expect(typeof body.time).toBe("string");
    expect(body.schema.expected).toBeGreaterThan(0);
  });
});
