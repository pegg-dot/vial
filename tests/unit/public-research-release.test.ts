import { describe, expect, it } from "vitest";
import { researchSubjectBySlug } from "@/lib/research-explorer";
import { publicReleaseAction, legacyResearchDestination } from "@/lib/public-research-release";

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

describe("retired shop URLs with a research equivalent", () => {
  const dest = (path: string) => legacyResearchDestination(path, slug => !!researchSubjectBySlug(slug));

  it.each(["retatrutide", "tirzepatide", "semaglutide", "cagrilintide", "ll-37", "oxytocin"])(
    "sends /compounds/%s to its dossier", slug => {
      expect(dest("/compounds/" + slug)).toBe("/intelligence/explore/" + slug);
      expect(dest("/compounds/" + slug + "/")).toBe("/intelligence/explore/" + slug);
    });

  it("sends the compounds index to the research market", () => {
    expect(dest("/compounds")).toBe("/intelligence/market");
  });

  it.each(["/compounds/bpc-157", "/compounds/not-a-compound", "/compounds/retatrutide/market", "/market", "/vendors/x", "/compounds/..%2Fadmin"])(
    "leaves %s on the generic retired notice", path => {
      expect(dest(path)).toBeNull();
    });
});
