import { afterEach, describe, expect, it } from "vitest";
import { buildOutboundUrl, AFFILIATE_RULES } from "@/server/outbound/affiliate";

describe("buildOutboundUrl — the monetization seam", () => {
  afterEach(() => { for (const k of Object.keys(AFFILIATE_RULES)) delete AFFILIATE_RULES[k]; });

  it("passes the vendor URL through untouched when there is no deal", () => {
    const r = buildOutboundUrl("acme", "https://acme.com/product/bpc-157?x=1");
    expect(r).toEqual({ url: "https://acme.com/product/bpc-157?x=1", affiliateApplied: false });
  });

  it("appends per-vendor tracking params for a program/coupon deal", () => {
    AFFILIATE_RULES["acme"] = { kind: "params", params: { ref: "vial", aff: "42" } };
    const r = buildOutboundUrl("acme", "https://acme.com/p/bpc?size=5mg");
    expect(r.affiliateApplied).toBe(true);
    const u = new URL(r.url);
    expect(u.searchParams.get("ref")).toBe("vial");
    expect(u.searchParams.get("aff")).toBe("42");
    expect(u.searchParams.get("size")).toBe("5mg"); // preserves the vendor's own params
  });

  it("wraps the destination in a universal network via a template rule", () => {
    AFFILIATE_RULES["acme"] = { kind: "template", template: "https://net.co/click?u={dest}&id=VIAL" };
    const r = buildOutboundUrl("acme", "https://acme.com/p/bpc?a=1");
    expect(r.affiliateApplied).toBe(true);
    expect(r.url).toBe(`https://net.co/click?u=${encodeURIComponent("https://acme.com/p/bpc?a=1")}&id=VIAL`);
  });

  it("lets a universal '*' rule monetize the whole long tail, with per-vendor overrides", () => {
    AFFILIATE_RULES["*"] = { kind: "template", template: "https://net.co/?u={dest}" };
    AFFILIATE_RULES["special"] = { kind: "params", params: { ref: "vial" } };
    expect(buildOutboundUrl("random-vendor", "https://r.com/x").url).toContain("net.co");
    expect(buildOutboundUrl("special", "https://s.com/x").url).toContain("ref=vial"); // override wins
  });

  it("never breaks the handoff on a malformed rule or URL — degrades to plain", () => {
    AFFILIATE_RULES["acme"] = { kind: "template", template: "no-dest-placeholder" };
    expect(buildOutboundUrl("acme", "https://acme.com/p")).toEqual({ url: "https://acme.com/p", affiliateApplied: false });
    AFFILIATE_RULES["b"] = { kind: "params", params: { ref: "x" } };
    expect(buildOutboundUrl("b", "not-a-url").affiliateApplied).toBe(false);
  });
});
