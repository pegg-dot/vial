import { describe, expect, it } from "vitest";
import { extractDomain, looksLikeCoaCode, findKnownVendor, vendorVerdict } from "@/server/verify";
import { composeVerdict, type VerdictInput } from "@/server/verify/trust-graph";

// A vendor with nothing on record — every seam empty. The base against which each seam is toggled.
const EMPTY: VerdictInput = {
  vendorName: "Test Vendor", coaCount: 0, medianPurity: null, blindCount: 0,
  enforcement: [], reputationDimensions: [], aggregators: [], signals: null,
  review: null, community: null, links: [], status: null, flagCount: 0,
};

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

describe("trust graph — composeVerdict folds every seam into ONE verdict (no black-box score)", () => {
  it("an empty record is unproven, not safe — unknown is a loud answer", () => {
    const r = composeVerdict(EMPTY);
    expect(r.verdict).toBe("unproven");
    // Even with nothing on record, it names the empty seams (enforcement + testing) as factors.
    expect(r.factors.some((f) => f.label === "Government enforcement" && f.ok === true)).toBe(true);
    expect(r.factors.some((f) => f.label === "Independent testing" && f.ok === false)).toBe(true);
  });

  it("severe enforcement OR buyer scam reports force AVOID and outrank everything else", () => {
    expect(composeVerdict({ ...EMPTY, enforcement: [{ severity: "severe" }] }).verdict).toBe("avoid");
    expect(composeVerdict({ ...EMPTY, review: { sentiment: "scam" } }).verdict).toBe("avoid");
    // Real testing evidence does NOT launder a proven enforcement action.
    const withTests = composeVerdict({ ...EMPTY, coaCount: 5, medianPurity: 99, enforcement: [{ severity: "severe" }] });
    expect(withTests.verdict).toBe("avoid");
  });

  it("open_risk_flags semantics: 'established' means NONE on record (good), 'disputed' means flags present (bad)", () => {
    // The bug this locks in: an established/None-on-record dimension must NOT read as a red flag.
    const clean = composeVerdict({ ...EMPTY, coaCount: 2,
      reputationDimensions: [{ key: "open_risk_flags", status: "established", value: "None on record" }] });
    expect(clean.factors.some((f) => f.label === "Scam & red flags")).toBe(false);
    expect(clean.verdict).not.toBe("avoid");
    expect(clean.verdict).not.toBe("caution");

    const flagged = composeVerdict({ ...EMPTY,
      reputationDimensions: [{ key: "open_risk_flags", status: "disputed", value: "1 enforcement record" }] });
    expect(flagged.factors.some((f) => f.label === "Scam & red flags" && f.ok === false)).toBe(true);
    expect(flagged.verdict).toBe("caution");
  });

  it("only evidence_corroboration carries 'conflicting evidence' — mixed community sentiment does not", () => {
    // community_signal 'disputed' (mixed reviews) must not be mislabeled as evidence conflicting with itself.
    const mixedCommunity = composeVerdict({ ...EMPTY, coaCount: 2,
      reputationDimensions: [{ key: "community_signal", status: "disputed", value: "Mixed reports" }] });
    expect(mixedCommunity.factors.some((f) => f.label === "Conflicting evidence")).toBe(false);

    const realConflict = composeVerdict({ ...EMPTY, coaCount: 2,
      reputationDimensions: [{ key: "evidence_corroboration", status: "disputed", value: "2 tests · 1 open conflict" }] });
    expect(realConflict.factors.some((f) => f.label === "Conflicting evidence")).toBe(true);
    expect(realConflict.verdict).toBe("caution");
  });

  it("real independent testing + corroboration earns TRUSTED, and counts the weighed signals", () => {
    const r = composeVerdict({ ...EMPTY, coaCount: 3, medianPurity: 99.2, blindCount: 1,
      reputationDimensions: [{ key: "evidence_corroboration", status: "established", value: "3 tests" }] });
    expect(r.verdict).toBe("trusted");
    expect(r.weighed).toBe(r.factors.length);
    expect(r.weighed).toBeGreaterThanOrEqual(2);
  });
});
