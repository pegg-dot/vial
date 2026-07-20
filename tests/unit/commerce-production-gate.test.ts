import { describe, expect, it } from "vitest";
import { liveChargeBlocked } from "@/server/commerce/production-gate";

// The commerce_production flag is the "real money movement hard stop". A live charge
// (stripe adapter + live mode) must be blocked unless the flag is explicitly enabled.
// Sandbox/mock configurations never charge real money, so the flag is irrelevant there.
describe("commerce production interlock", () => {
  it("blocks a live stripe charge when the flag is disabled", () => {
    expect(liveChargeBlocked({ mode: "live", provider: "stripe", flagEnabled: false })).toBe(true);
  });

  it("allows a live stripe charge when the flag is enabled", () => {
    expect(liveChargeBlocked({ mode: "live", provider: "stripe", flagEnabled: true })).toBe(false);
  });

  it("never blocks in sandbox mode regardless of the flag", () => {
    expect(liveChargeBlocked({ mode: "sandbox", provider: "stripe", flagEnabled: false })).toBe(false);
    expect(liveChargeBlocked({ mode: "test", provider: "stripe", flagEnabled: false })).toBe(false);
  });

  it("never blocks the mock provider (moves no real money)", () => {
    expect(liveChargeBlocked({ mode: "live", provider: "mock", flagEnabled: false })).toBe(false);
  });
});
