import { describe, expect, it } from "vitest";
import { usLegalFor, US_REGULATION_FACTS } from "@/lib/us-legal";

describe("US regulatory research context", () => {
  it("distinguishes an approved ingredient from a listed product", () => {
    const s = usLegalFor("semaglutide");
    expect(s.category).toBe("prescription");
    expect(s.detail).toMatch(/does not extend to other vials/i);
  });
  it("identifies investigational research without suggesting approval", () => {
    const s = usLegalFor("retatrutide");
    expect(s.category).toBe("investigational");
    expect(s.flags).toContain("FDA: cannot be used in federal drug compounding");
    expect(s.detail).toMatch(/cannot be used in drug compounding/i);
    expect(s.detail).toMatch(/does not constitute FDA/i);
  });
  it("does not misclassify all investigated substances as having the same compounding status", () => {
    expect(usLegalFor("survodutide").flags).not.toContain("FDA: cannot be used in federal drug compounding");
    expect(usLegalFor("cagrilintide").flags).toContain("FDA: cannot be used in federal drug compounding");
  });
  it("does not call the research-use label a legal exemption", () => {
    expect(usLegalFor("tb-500").detail).toMatch(/label alone does not decide/i);
    expect(US_REGULATION_FACTS[0].body).toMatch(/does not automatically/i);
  });
  it("states compounding status is case specific", () => {
    expect(usLegalFor("bpc-157").flags).toContain("FDA compounding status requires review");
    expect(US_REGULATION_FACTS.find((f) => f.title.includes("compounding"))?.body).toMatch(/USP\/NF/i);
  });
  it("does not falsely label GLP-1 monitoring compounds as WADA-prohibited", () => {
    expect(usLegalFor("semaglutide").flags.some((f) => /WADA/.test(f))).toBe(false);
    expect(usLegalFor("tirzepatide").flags.some((f) => /WADA/.test(f))).toBe(false);
  });
});
