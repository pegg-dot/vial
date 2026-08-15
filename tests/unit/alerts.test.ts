import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportError, __resetAlertThrottleForTests } from "@/server/observability/alerts";

// The alerting path exists because the site served an error on every page for hours and the owner
// found out by looking. These tests pin the two properties that decide whether it is worth having:
// it must fire, and it must NOT fire thousands of times during a single outage — an alert channel
// that floods gets muted, and a muted channel is the same as no channel.
describe("error alerting", () => {
  const WEBHOOK = "https://example.invalid/hook";
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetAlertThrottleForTests();
    delete process.env.VIALGRADE_ALERT_WEBHOOK;
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("logs without a webhook and dispatches nothing", () => {
    const sent = reportError({ kind: "catalog-unavailable", message: "db down" });
    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    // Still recorded, so the Vercel log has it even with no webhook configured.
    expect(console.error).toHaveBeenCalled();
  });

  it("dispatches when a webhook is configured", () => {
    process.env.VIALGRADE_ALERT_WEBHOOK = WEBHOOK;
    expect(reportError({ kind: "catalog-unavailable", message: "db down" })).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(WEBHOOK);
    const body = JSON.parse((init as { body: string }).body);
    // Both keys, so one URL works for either Discord or Slack.
    expect(body.content).toContain("catalog-unavailable");
    expect(body.text).toBe(body.content);
  });

  it("collapses a repeated failure into one message", () => {
    process.env.VIALGRADE_ALERT_WEBHOOK = WEBHOOK;
    // This is the outage shape: the same failure on every single request.
    const results = Array.from({ length: 500 }, () =>
      reportError({ kind: "catalog-unavailable", message: "db down" }));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not let one noisy failure suppress a different one", () => {
    process.env.VIALGRADE_ALERT_WEBHOOK = WEBHOOK;
    reportError({ kind: "catalog-unavailable", message: "db down" });
    // A second, unrelated fault during the same window must still get through — otherwise the
    // throttle hides the very escalation it is meant to survive.
    expect(reportError({ kind: "client-error", message: "boom" })).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("separates severities so a critical is not swallowed by a warning", () => {
    process.env.VIALGRADE_ALERT_WEBHOOK = WEBHOOK;
    reportError({ kind: "catalog-unavailable", message: "warn" });
    expect(reportError({ kind: "catalog-unavailable", message: "now critical", severity: "critical" })).toBe(true);
  });

  it("never throws, whatever the webhook does", () => {
    process.env.VIALGRADE_ALERT_WEBHOOK = WEBHOOK;
    fetchMock.mockImplementation(() => { throw new Error("network is gone"); });
    // Monitoring that breaks the request it is monitoring is a net loss.
    expect(() => reportError({ kind: "client-error", message: "x" })).not.toThrow();
  });

  it("survives a malformed context without failing the caller", () => {
    process.env.VIALGRADE_ALERT_WEBHOOK = WEBHOOK;
    const circular: Record<string, unknown> = {};
    circular.self = circular; // JSON.stringify throws on this
    expect(() => reportError({ kind: "client-error", message: "x", context: circular })).not.toThrow();
  });
});
