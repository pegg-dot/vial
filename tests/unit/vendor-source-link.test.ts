import { afterEach, describe, expect, it, vi } from "vitest";
import { vendorLinkAllowed, vendorLinksReleased, vendorSourceUrl } from "@/lib/vendor-source-link";

describe("vendor source link", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless exactly true, and reads the environment by default", () => {
    expect(vendorLinksReleased("")).toBe(false);
    expect(vendorLinksReleased("TRUE")).toBe(false);
    expect(vendorLinksReleased("true")).toBe(true);
    vi.stubEnv("VIALGRADE_VENDOR_LINKS", "true");
    expect(vendorLinksReleased()).toBe(true);
    vi.stubEnv("VIALGRADE_VENDOR_LINKS", "");
    expect(vendorLinksReleased()).toBe(false);
  });

  it("turns a plain domain into one https URL", () => {
    expect(vendorSourceUrl("Example-Peptides.com")).toBe("https://example-peptides.com/");
    expect(vendorSourceUrl("www.acme.co.uk")).toBe("https://acme.co.uk/");
  });

  it.each([null, undefined, "", "http://acme.com", "https://acme.com/path", "acme.com/path", "user@acme.com", "acme.com:8080",
    "javascript:alert(1)", "acme.com?x=1", "127.0.0.1", "10.0.0.5", "[::1]", "localhost", "intranet.local", "a b.com", "acme", "-acme.com",
    "a".repeat(260) + ".com",
  ])("never links data that is not a bare public hostname: %s", value => {
    expect(vendorSourceUrl(value as string | null | undefined)).toBeNull();
  });

  it("offers no link for avoid verdicts or dead storefronts", () => {
    expect(vendorLinkAllowed({ verdict: "trusted", status: null })).toBe(true);
    expect(vendorLinkAllowed({ verdict: "caution", status: "operating" })).toBe(true);
    expect(vendorLinkAllowed({ verdict: "avoid", status: null })).toBe(false);
    expect(vendorLinkAllowed({ verdict: "high-risk", status: null })).toBe(false);
    expect(vendorLinkAllowed({ verdict: "unproven", status: null })).toBe(true);
    expect(vendorLinkAllowed({ verdict: "caution", status: "blocked" })).toBe(true);
    for (const status of ["offline", "parked", "closed", "redirected", "some-new-status"]) expect(vendorLinkAllowed({ verdict: "trusted", status })).toBe(false);
  });
});
