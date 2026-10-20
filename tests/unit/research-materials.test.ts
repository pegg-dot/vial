import { describe, expect, it } from "vitest";
import {
  evaluateLotMatch, isSafeResearchSourceUrl, materialReviewWorkpaper,
  MATERIAL_EVIDENCE_REQUIREMENTS, RESEARCH_PROVIDER_RECORDS, researchMaterialHref,
  researchProviderBySlug,
} from "@/lib/research-materials";

describe("read-only research material evidence", () => {
  it("requires an exact lot identifier before even reporting a textual match", () => {
    expect(evaluateLotMatch("", "")).toBe("no-lot-data");
    expect(evaluateLotMatch("", "ABC-12")).toBe("sample-lot-missing");
    expect(evaluateLotMatch("ABC-12", "")).toBe("report-lot-missing");
    expect(evaluateLotMatch("ABC-12", "ABC-12")).toBe("literal-match");
    expect(evaluateLotMatch("ABC12", "ABC-12")).toBe("conflict");
    expect(evaluateLotMatch("batch-A", "batch-B")).toBe("conflict");
    expect(evaluateLotMatch("a", "A")).toBe("conflict");
  });

  it("never turns an apparent match into laboratory or physical-sample authentication", () => {
    const report = materialReviewWorkpaper({
      subjectSlug: "pexiganan", sampleLabel: "Unverified demo note",
      sampleLot: "LOT-Z", reportLot: "LOT-Z", reportIssuer: "Unconfirmed",
      reportUrl: "https://example.com/report.pdf", reviewerNote: "Need independent issuer contact",
    });
    expect(report).toContain("Status: UNVERIFIED");
    expect(report).toContain("literal-match");
    expect(report).toContain("A matching typed lot string alone is not confirmation");
    expect(report).toContain("Need independent issuer contact");
    for (const item of MATERIAL_EVIDENCE_REQUIREMENTS) expect(report).toContain(item.title);
  });

  it("keeps supplier process claims separated from evidence and grades", () => {
    expect(RESEARCH_PROVIDER_RECORDS.length).toBeGreaterThanOrEqual(2);
    for (const item of RESEARCH_PROVIDER_RECORDS) {
      expect(item.sources.length).toBeGreaterThan(0);
      expect(researchProviderBySlug(item.slug)).toBe(item);
      expect(item.importantLimit).toMatch(/not|no|unverified|has not/i);
      expect(JSON.stringify(item)).not.toMatch(/checkout|buy now|purchase|price|\$[0-9]/i);
      for (const source of item.sources) {
        expect(source.scope).toBe("company-authored");
        expect(isSafeResearchSourceUrl(source.url)).toBe(true);
      }
    }
    expect(researchProviderBySlug("toString")).toBeUndefined();
    expect(researchMaterialHref("pexiganan")).toBe("/intelligence/materials?subject=pexiganan");
    expect(researchMaterialHref("__proto__")).toBeNull();
  });

  it("accepts public https documentation references only", () => {
    expect(isSafeResearchSourceUrl("https://example.com/report.pdf")).toBe(true);
    for (const url of ["http://example.com", "file:///etc/passwd", "javascript:alert(1)", "https://localhost/doc", "https://user:pass@example.com/"]) {
      expect(isSafeResearchSourceUrl(url)).toBe(false);
    }
    expect(() => materialReviewWorkpaper({
      subjectSlug: "nonexistent", sampleLabel: "", sampleLot: "", reportLot: "",
      reportIssuer: "", reportUrl: "", reviewerNote: "",
    })).toThrow("Unknown research identity");
  });
});
