import { describe, expect, it } from "vitest";
import { extractDomain, looksLikeCoaCode, findKnownVendor, vendorVerdict } from "@/server/verify";

describe("verify — query classification", () => {
  it("extracts domains from raw input and URLs", () => {
    expect(extractDomain("bluumpeptides.com")).toBe("bluumpeptides.com");
    expect(extractDomain("https://www.eternalpeptides.com/product/x")).toBe("eternalpeptides.com");
    expect(extractDomain("BPC-157")).toBeNull();
    expect(extractDomain("just some words")).toBeNull();
  });
  it("recognizes Janoshik COA codes", () => {
    expect(looksLikeCoaCode("F8IKXANLGX1R")).toBe(true);
    expect(looksLikeCoaCode("bpc-157")).toBe(false);
    expect(looksLikeCoaCode("short")).toBe(false);
  });
});

describe("verify — the critical scam-detection behavior", () => {
  it("returns AVOID for known defunct/scam vendors (the coverage-gap fix)", () => {
    const ps = findKnownVendor("Peptide Sciences", null);
    expect(ps).not.toBeNull();
    expect(vendorVerdict(ps!).verdict).toBe("avoid");

    const aa = findKnownVendor("aminoasylum.com", "aminoasylum.com");
    expect(aa).not.toBeNull();
    expect(vendorVerdict(aa!).verdict).toBe("avoid");
    expect(vendorVerdict(aa!).link).toBeUndefined(); // never links a buyer to a scam
  });

  it("returns TRUSTED for a well-regarded vendor, matched by name or domain", () => {
    const byDomain = findKnownVendor("bluumpeptides.com", "bluumpeptides.com");
    expect(byDomain?.slug).toBe("bluum-peptides");
    expect(vendorVerdict(byDomain!).verdict).toBe("trusted");

    const byName = findKnownVendor("Ascension Peptides", null);
    expect(vendorVerdict(byName!).verdict).toBe("trusted");
  });
});
