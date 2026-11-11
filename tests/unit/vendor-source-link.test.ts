import { afterEach, describe, expect, it, vi } from "vitest";
import { listingSourceUrl, storefrontUrlFor, vendorLinkAllowed, vendorLinksReleased, vendorSourceUrl } from "@/lib/vendor-source-link";

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

  it("storefrontUrlFor: every condition must hold, and the result is the validated https URL", () => {
    const ok = { verdict: "trusted", status: "operating", domain: "Acme-Peptides.com" };
    expect(storefrontUrlFor(ok, true)).toBe("https://acme-peptides.com/");
    expect(storefrontUrlFor(ok, false)).toBeNull();
    expect(storefrontUrlFor({ ...ok, verdict: "avoid" }, true)).toBeNull();
    expect(storefrontUrlFor({ ...ok, verdict: "high-risk" }, true)).toBeNull();
    expect(storefrontUrlFor({ ...ok, status: "redirected" }, true)).toBeNull();
    expect(storefrontUrlFor({ ...ok, status: "offline" }, true)).toBeNull();
    expect(storefrontUrlFor({ ...ok, status: null }, true)).toBe("https://acme-peptides.com/");
    expect(storefrontUrlFor({ ...ok, domain: "https://acme.com/shop?ref=1" }, true)).toBeNull();
    expect(storefrontUrlFor({ ...ok, domain: null }, true)).toBeNull();
  });
});

describe("listing source link", () => {
  const site = "https://acme-peptides.com/";

  it("cites the listing on the vendor's own site, as host and path only", () => {
    expect(listingSourceUrl("https://acme-peptides.com/products/bpc-157-5mg", site)).toBe("https://acme-peptides.com/products/bpc-157-5mg");
    expect(listingSourceUrl("https://www.acme-peptides.com/products/bpc-157-5mg/", site)).toBe("https://www.acme-peptides.com/products/bpc-157-5mg/");
    expect(listingSourceUrl("https://shop.acme-peptides.com/p/1", site)).toBe("https://shop.acme-peptides.com/p/1");
    expect(listingSourceUrl("https://ACME-Peptides.com", site)).toBe("https://acme-peptides.com/");
  });

  it("drops every query string and fragment, so no referral, affiliate or campaign tag can ride along", () => {
    const out = listingSourceUrl("https://acme-peptides.com/products/bpc?ref=vialgrade&utm_source=vialgrade&aff=77&variant=5#buy", site);
    expect(out).toBe("https://acme-peptides.com/products/bpc");
    expect(out).not.toMatch(/[?#]|ref=|utm_|aff=/);
  });

  it("is null without the vendor's released website link: the listing link never outruns the vendor-link rule", () => {
    expect(listingSourceUrl("https://acme-peptides.com/products/bpc", null)).toBeNull();
    expect(listingSourceUrl("https://acme-peptides.com/products/bpc", undefined)).toBeNull();
    // storefrontUrlFor is what supplies the website: off, an avoid verdict or a dead site all end here.
    const ok = { verdict: "trusted", status: "operating", domain: "acme-peptides.com" };
    expect(listingSourceUrl("https://acme-peptides.com/p", storefrontUrlFor(ok, false))).toBeNull();
    expect(listingSourceUrl("https://acme-peptides.com/p", storefrontUrlFor({ ...ok, verdict: "avoid" }, true))).toBeNull();
    expect(listingSourceUrl("https://acme-peptides.com/p", storefrontUrlFor({ ...ok, status: "parked" }, true))).toBeNull();
    expect(listingSourceUrl("https://acme-peptides.com/p", storefrontUrlFor(ok, true))).toBe("https://acme-peptides.com/p");
  });

  it.each([null, undefined, "", "not a url", "/products/bpc", "http://acme-peptides.com/p", "javascript:alert(1)", "data:text/html,x",
    "https://evil.example/acme-peptides.com", "https://acme-peptides.com.evil.example/p", "https://notacme-peptides.com/p",
    "https://user:pw@acme-peptides.com/p", "https://acme-peptides.com:8443/p", "https://acme-peptides.com@evil.example/p",
  ])("never links a stored URL that is not an https page on that vendor's site: %s", value => {
    expect(listingSourceUrl(value as string | null | undefined, site)).toBeNull();
  });

  it("re-encodes the path, so stored markup cannot reach an attribute", () => {
    const out = listingSourceUrl('https://acme-peptides.com/p/"><script>x</script>', site)!;
    expect(out).not.toMatch(/[<>"]/);
    expect(out.startsWith("https://acme-peptides.com/p/")).toBe(true);
  });
});
