import { describe, expect, it } from "vitest";
import { legacyResearchDestination, publicReleaseAction } from "@/lib/public-research-release";

describe("public research-only deployment quarantine", () => {
  it.each(["/", "/market", "/vendors", "/vendors/store", "/compounds/retatrutide",
    "/products/legacy", "/passports/coa", "/research", "/search", "/about", "/stacks",
  ])("redirects legacy public pages instead of publishing unreviewed source records: %s", path => {
    expect(publicReleaseAction(path, "GET", true)).toBe("redirect");
  });

  it.each(["/api/public/v1/catalog", "/api/v1/catalog", "/api/search",
    "/api/v1/verify", "/api/v1/alerts", "/api/track/view", "/api/openapi.json",
  ])("refuses legacy public APIs rather than exposing source data: %s", path => {
    expect(publicReleaseAction(path, "GET", true)).toBe("gone");
  });

  it("rejects mutations on hidden public pages", () => {
    expect(publicReleaseAction("/vendors/a", "POST", true)).toBe("gone");
  });

  it.each(["/intelligence", "/intelligence/", "/intelligence/retatrutide", "/intelligence/cagrilintide", "/intelligence/tirzepatide", "/legal/privacy",
    "/legal/us-regulations", "/legal/contact", "/sitemap.xml", "/robots.txt",
    "/login", "/register",
  ])("preserves the narrow public research and legal paths: %s", path => {
    expect(publicReleaseAction(path, "GET", true)).toBeNull();
  });

  it.each(["/admin", "/admin/privacy", "/account", "/account/security",
    "/orders/historical", "/api/v1/commerce/refunds",
    "/api/v1/commerce/returns", "/api/v1/commerce/provider/webhook",
    "/api/v1/auth/login", "/api/v1/account/preferences",
    "/api/v1/push/unsubscribe", "/api/internal/cron/refresh",
  ])("keeps existing remediation under its original authentication gates: %s", path => {
    expect(publicReleaseAction(path, "POST", true)).toBeNull();
  });

  it("has no effect unless the deployment explicitly opts into the quarantine", () => {
    expect(publicReleaseAction("/vendors/a", "GET", false)).toBeNull();
    expect(publicReleaseAction("/api/v1/catalog", "GET", false)).toBeNull();
  });
});

describe("retired shopping URLs keep research intent only where an equivalent exists", () => {
  const known = (slug: string) => ["pexiganan", "magainin-2"].includes(slug);
  it("maps compounds and the market, not arbitrary or transactional paths", () => {
    expect(legacyResearchDestination("/compounds/pexiganan", known)).toBe("/intelligence/explore/pexiganan");
    expect(legacyResearchDestination("/compounds/pexiganan/market", known)).toBe("/intelligence/explore/pexiganan");
    expect(legacyResearchDestination("/compounds/", known)).toBe("/intelligence/market");
    expect(legacyResearchDestination("/market", known)).toBe("/intelligence/market");
    expect(legacyResearchDestination("/compounds/bpc-157", known)).toBeNull();
    expect(legacyResearchDestination("/checkout", known)).toBeNull();
    expect(legacyResearchDestination("/products/pexiganan", known)).toBeNull();
    expect(legacyResearchDestination("/compounds/../admin", known)).toBeNull();
  });
});
