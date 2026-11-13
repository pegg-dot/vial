import { isPausedTransactionEndpoint } from "@/lib/commerce-pause";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicReleaseAction, legacyResearchDestination, publicBrowseRelease, isBrowsePage, hidesCommerce, hidesMarket, marketRecordsRelease } from "@/lib/public-research-release";

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

  it("leaves the compounds index on its own page: it is the research library now", () => {
    expect(dest("/compounds")).toBeNull();
    expect(dest("/compounds/")).toBeNull();
  });

  it.each(["/compounds/bpc-157", "/compounds/not-a-compound", "/compounds/retatrutide/market", "/market", "/vendors/x", "/compounds/..%2Fadmin"])(
    "leaves %s on the generic retired notice", path => {
      expect(dest(path)).toBeNull();
    });
});


describe("read-only browse release (VIALGRADE_PUBLIC_BROWSE)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["/compounds", "/compounds/", "/how-we-check", "/how-we-check/"])(
    "the research library and the method page stay public with browse OFF: %s", path => {
      expect(publicReleaseAction(path, "GET", true, false)).toBeNull();
      expect(publicReleaseAction(path, "HEAD", true, false)).toBeNull();
    });

  it.each(["/verify", "/verify/"])("lets %s reach its page, which forwards permanently to the source checker", path => {
    expect(publicReleaseAction(path, "GET", true, false)).toBeNull();
    expect(publicReleaseAction(path, "HEAD", true, false)).toBeNull();
    expect(publicReleaseAction(path, "POST", true, false)).not.toBeNull();
  });

  it.each(["/compounds", "/how-we-check"])("but only for reading: %s", path => {
    expect(publicReleaseAction(path, "POST", true, false)).not.toBeNull();
    expect(publicReleaseAction(path, "POST", true, true)).not.toBeNull();
  });

  it.each(["/compounds/x", "/compoundsx", "/how-we-check/x", "/verify/x", "/verifyx", "/vendors", "/labs", "/passports", "/grades"])(
    "everything else under the directories still needs the browse release: %s", path => {
      expect(publicReleaseAction(path, "GET", true, false)).not.toBeNull();
    });

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
    "/market", "/stacks", "/search", "/compare", "/news", "/about", "/help", "/coverage", "/testing", "/api/v1/catalog", "/api/search", "/api/v1/verify",
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

describe("market-record release (VIALGRADE_MARKET_RECORDS)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless exactly true, and reads the environment by default", () => {
    // Explicit values only: passing undefined would fall through to the environment, and the
    // production build runs this suite with the flag set.
    for (const value of ["", "1", "TRUE", "yes", "false", " true"]) expect(marketRecordsRelease(value)).toBe(false);
    expect(marketRecordsRelease("true")).toBe(true);
    vi.stubEnv("VIALGRADE_MARKET_RECORDS", "true");
    expect(marketRecordsRelease()).toBe(true);
    vi.stubEnv("VIALGRADE_MARKET_RECORDS", "false");
    expect(marketRecordsRelease()).toBe(false);
    vi.stubEnv("VIALGRADE_MARKET_RECORDS", "");
    expect(marketRecordsRelease()).toBe(false);
  });

  it("prices and listings show under the quarantine only when browse AND the market record are both on", () => {
    // [evidenceOnly, browse, market] -> hidden
    expect(hidesMarket(true, true, true)).toBe(false);
    expect(hidesMarket(true, true, false)).toBe(true);
    expect(hidesMarket(true, false, true)).toBe(true);
    expect(hidesMarket(true, false, false)).toBe(true);
    // With the quarantine off the legacy site shows them whatever the other two say.
    for (const browse of [true, false]) for (const market of [true, false]) expect(hidesMarket(false, browse, market)).toBe(false);
  });

  it("reads all three flags from the environment by default", () => {
    vi.stubEnv("VIALGRADE_PUBLIC_EVIDENCE_ONLY", "true");
    vi.stubEnv("VIALGRADE_PUBLIC_BROWSE", "true");
    vi.stubEnv("VIALGRADE_MARKET_RECORDS", "");
    expect(hidesMarket()).toBe(true);
    vi.stubEnv("VIALGRADE_MARKET_RECORDS", "true");
    expect(hidesMarket()).toBe(false);
    vi.stubEnv("VIALGRADE_PUBLIC_BROWSE", "");
    expect(hidesMarket()).toBe(true);
  });

  it("leaves the rest of the commerce surface hidden: it is a narrower switch than hidesCommerce", () => {
    vi.stubEnv("VIALGRADE_PUBLIC_EVIDENCE_ONLY", "true");
    vi.stubEnv("VIALGRADE_PUBLIC_BROWSE", "true");
    vi.stubEnv("VIALGRADE_MARKET_RECORDS", "true");
    expect(hidesMarket()).toBe(false);
    expect(hidesCommerce()).toBe(true);
  });

  it.each(["/products/legacy", "/compounds/retatrutide/market", "/go/anything", "/cart", "/checkout", "/market", "/stacks", "/stacks/x",
    "/compare", "/search", "/api/v1/catalog", "/api/v1/compare", "/api/partner/conversion",
  ])("opens no route: %s stays closed with the flag on", path => {
    vi.stubEnv("VIALGRADE_PUBLIC_EVIDENCE_ONLY", "true");
    vi.stubEnv("VIALGRADE_PUBLIC_BROWSE", "true");
    vi.stubEnv("VIALGRADE_MARKET_RECORDS", "true");
    expect(publicReleaseAction(path, "GET")).not.toBeNull();
    expect(publicReleaseAction(path, "POST")).toBe("gone");
  });

  it("does not lift the purchase and click-through pause", () => {
    vi.stubEnv("VIALGRADE_MARKET_RECORDS", "true");
    for (const path of ["/go/acme", "/api/v1/commerce/checkout", "/api/v1/commerce/cart", "/api/partner/conversion"]) {
      expect(isPausedTransactionEndpoint(path)).toBe(true);
    }
  });
});
