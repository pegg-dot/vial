import { describe, expect, it } from "vitest";
import { isPausedTransactionEndpoint } from "@/lib/commerce-pause";

describe("new-sale suspension preserves customer remedies", () => {
  it.each([
    "/go",
    "/go/",
    "/api/partner/conversion",
    "/api/v1/commerce/checkout",
    "/api/v1/commerce/approved-checkout",
    "/api/v1/commerce/cart",
    "/api/v1/commerce/activation",
    "/api/v1/commerce/provider/onboarding",
    "/api/v1/commerce/provider/sync",
    "/go/saved-vendor",
    "/api/v1/commerce/checkout/attempt-123",
    "/api/v1/commerce/cart/line-items",
    "/api/v1/commerce/provider/sync/attempt",
  ])("closes the new-sale/referral path %s", (path) => {
    expect(isPausedTransactionEndpoint(path)).toBe(true);
  });
  it.each([
    "/api/v1/commerce/refunds",
    "/api/v1/commerce/returns",
    "/api/v1/commerce/disputes",
    "/api/v1/commerce/disputes/evidence",
    "/api/v1/commerce/orders/previous-order",
    "/api/v1/commerce/control-plane",
    "/api/v1/commerce/provider/webhook",
    "/api/v1/commerce/settlements",
  ])("leaves authenticated remedies and administration at %s", (path) => {
    expect(isPausedTransactionEndpoint(path)).toBe(false);
  });
});
