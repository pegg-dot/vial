import { isPausedTransactionEndpoint } from "@/lib/commerce-pause";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicReleaseAction, legacyResearchDestination, publicBrowseRelease, isBrowsePage, hidesCommerce } from "@/lib/public-research-release";

describe("public research-only deployment quarantine", () => {
  // The deployment may have the browse flag on; these cases describe the flag being off.
  beforeEach(() => vi.stubEnv("VIALGRADE_PUBLIC_BROWSE", ""));
  afterEach(() => vi.unstubAllEnvs());

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
  const dest = (path: string) => legacyResearchDestination(path);

  it.each(["retatrutide", "tirzepatide", "semaglutide", "cagrilintide", "ll-37", "oxytocin"])(
    "leaves /compounds/%s on its own page: the compound page is the dossier now", slug => {
      expect(dest("/compounds/" + slug)).toBeNull();
      expect(dest("/compounds/" + slug + "/")).toBeNull();
    });

  it("sends the compounds index to the research market", () => {
    expect(dest("/compounds")).toBe("/intelligence/market");
  });

  it.each(["/compounds/bpc-157", "/compounds/not-a-compound", "/compounds/retatrutide/market", "/market", "/vendors/x", "/compounds/..%2Fadmin"])(
    "leaves %s on the generic retired notice", path => {
      expect(dest(path)).toBeNull();
    });
});


describe("read-only browse release (VIALGRADE_PUBLIC_BROWSE)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless exactly true", () => {
    expect(publicBrowseRelease("")).toBe(false);
    expect(publicBrowseRelease("1")).toBe(false);
    expect(publicBrowseRelease("true")).toBe(true);
    vi.stubEnv("VIALGRADE_PUBLIC_BROWSE", "true");
    expect(publicBrowseRelease()).toBe(true);
  });

  it.each(["/compounds", "/compounds/retatrutide", "/vendors", "/vendors/acme", "/labs", "/labs/janoshik",
    "/passports", "/passports/abc", "/grades", "/methodology", "/how-we-check",
  ])("opens the read-only page when on: %s", path => {
    expect(publicReleaseAction(path, "GET", true, true)).toBeNull();
    expect(publicReleaseAction(path, "HEAD", true, true)).toBeNull();
  });

  it.each(["/products/legacy", "/compounds/retatrutide/market", "/go/anything", "/cart", "/checkout",
    "/market", "/stacks", "/search", "/verify", "/compare", "/news", "/about", "/help", "/coverage", "/testing", "/api/v1/catalog", "/api/search", "/api/v1/verify",
  ])("keeps shop, market tables and every API closed even when on: %s", path => {
    expect(publicReleaseAction(path, "GET", true, true)).not.toBeNull();
  });

  it("new purchases and click-throughs stay paused by their own switch", () => {
    for (const path of ["/go/acme", "/api/v1/commerce/checkout", "/api/v1/commerce/cart", "/api/partner/conversion"]) {
      expect(isPausedTransactionEndpoint(path)).toBe(true);
    }
  });

  it.each(["/compounds/%6Darket", "/compounds/x%2Fmarket", "/compounds/x/market", "/compounds/x/market/", "/compounds//x",
    "/vendors/../products/x", "/vendors/a;b", "/vendors/A", "/compounds/bpc_157", "/labs/a/b", "/grades/x", "/vendors\\a",
  ])("refuses odd, encoded or deeper paths that a router could read differently: %s", path => {
    expect(isBrowsePage(path)).toBe(false);
    expect(publicReleaseAction(path, "GET", true, true)).not.toBeNull();
  });

  it("opens only exact page shapes, with or without one trailing slash", () => {
    expect(isBrowsePage("/compounds/bpc-157/")).toBe(true);
    expect(isBrowsePage("/vendors")).toBe(true);
    expect(isBrowsePage("/vendors/arcwell-analytics")).toBe(true);
  });

  it("never opens writes", () => {
    expect(publicReleaseAction("/vendors/acme", "POST", true, true)).toBe("gone");
    expect(publicReleaseAction("/compounds/x", "POST", true, true)).toBe("gone");
    expect(isBrowsePage("/compounds/x", "DELETE")).toBe(false);
  });

  it("does nothing when the browse flag is off", () => {
    expect(publicReleaseAction("/compounds/retatrutide", "GET", true, false)).toBe("redirect");
  });

  it("opens a compound page that carries a research file even with the browse flag off, reads only", () => {
    const hasDossier = (slug: string) => slug === "pexiganan";
    expect(publicReleaseAction("/compounds/pexiganan", "GET", true, false, hasDossier)).toBeNull();
    expect(publicReleaseAction("/compounds/pexiganan", "HEAD", true, false, hasDossier)).toBeNull();
    expect(publicReleaseAction("/compounds/pexiganan", "POST", true, false, hasDossier)).toBe("gone");
    expect(publicReleaseAction("/compounds/bpc-157", "GET", true, false, () => false)).toBe("redirect");
  });

  it("pages hide commerce whenever the quarantine is on", () => {
    expect(hidesCommerce(true)).toBe(true);
    expect(hidesCommerce(false)).toBe(false);
  });
});
