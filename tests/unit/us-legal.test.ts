import { describe, expect, it } from "vitest";
import { usLegalFor, US_REGULATION_FACTS } from "@/lib/us-legal";

describe("US legal status", () => {
  it("flags FDA-approved prescription drugs", () => {
    const s = usLegalFor("semaglutide");
    expect(s.category).toBe("prescription");
    expect(s.headline).toMatch(/prescription/i);
  });
  it("flags investigational GLP-1-class agonists", () => {
    expect(usLegalFor("retatrutide").category).toBe("investigational");
  });
  it("treats a typical peptide as research-use-only", () => {
    expect(usLegalFor("tb-500").category).toBe("research-only");
  });
  it("surfaces the FDA do-not-compound flag for BPC-157", () => {
    const s = usLegalFor("bpc-157");
    expect(s.category).toBe("research-only");
    expect(s.flags).toContain("FDA safety flag — no pharmacy may compound it");
    // Guards the FACT, not the phrasing. BPC-157 sits in the FDA's "nominated but withdrawn"
    // table, NOT category 2 — we shipped the wrong mechanism once, and this is what caught it.
    expect(s.detail).toMatch(/not on the FDA's 503A list/i);
    expect(s.detail).toMatch(/withdrawn/i);
    expect(s.detail).not.toMatch(/category 2/i);
  });
  it("marks WADA-banned compounds", () => {
    expect(usLegalFor("cjc-1295").flags.some((f) => /WADA/i.test(f))).toBe(true);
  });
  it("has a non-empty regulation explainer", () => {
    expect(US_REGULATION_FACTS.length).toBeGreaterThan(5);
  });
});
