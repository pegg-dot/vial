import { describe, expect, it } from "vitest";
import { isPausedPersonalDataEndpoint } from "@/lib/privacy-pause";

describe("evidence-only privacy hold", () => {
  it.each([
    "/api/track/view", "/api/v1/auth/register", "/api/v1/verify",
    "/api/v1/verify/document", "/api/v1/saved-searches",
    "/api/v1/notifications", "/api/v1/follows", "/api/v1/consumer/preferences",
    "/api/v1/decision-events",
  ])("prevents new sensitive data collection via %s", p => {
    expect(isPausedPersonalDataEndpoint(p,"POST")).toBe(true);
  });
  it.each([
    "/api/v1/watchlist", "/api/v1/comparisons", "/api/v1/account/preferences"
  ])("prevents new personalization writes but leaves legacy reads for %s", p => {
    expect(isPausedPersonalDataEndpoint(p,"POST")).toBe(true);
    expect(isPausedPersonalDataEndpoint(p,"PUT")).toBe(true);
    expect(isPausedPersonalDataEndpoint(p,"PATCH")).toBe(true);
    expect(isPausedPersonalDataEndpoint(p,"GET")).toBe(false);
  });
  it.each([
    "/api/v1/auth/login", "/api/v1/auth/logout",
    "/api/v1/commerce/refunds", "/api/v1/commerce/returns",
    "/api/v1/commerce/provider/webhook", "/api/v1/commerce/orders/a",
    "/api/v1/catalog",
  ])("does not block legitimate account access, remedies or documentary reads at %s", p => {
    expect(isPausedPersonalDataEndpoint(p,"POST")).toBe(false);
  });
});
