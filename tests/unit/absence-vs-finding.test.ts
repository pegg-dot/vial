import { describe, expect, it } from "vitest";
import { isAbsenceOfEvidence } from "@/server/verify/absence";

// The vendor page rendered every curated redFlags string under a rose "Red flags reported" heading
// with a warning triangle. Twelve of the ninety strings are not findings about a vendor at all —
// they are notes that VIALGRADE could not find something. chameleon-peptides carried "No
// independent Reddit / MESO-Rx / forum verification found" as a red flag on a page that grades it
// A. bluum-peptides carried "No community verification at all" while graded B+.
//
// A gap in our own capture, published as a fault of a named real business, next to a grade that
// says the opposite. This is the exact failure the product exists to catch elsewhere.
//
// The line that matters is WHOSE fact it is. "We could not find it" is about us. "They do not
// publish it" is about them, and stays a finding.

describe("telling a gap in our capture from a finding about a vendor", () => {
  it("reads 'we could not find it' as our gap", () => {
    expect(isAbsenceOfEvidence("No independent Reddit / MESO-Rx / forum verification found; reputation rests on Trustpilot")).toBe(true);
    expect(isAbsenceOfEvidence("No community verification at all (no r/Peptides, MESO-Rx, or Finnrick data)")).toBe(true);
    expect(isAbsenceOfEvidence("Direct r/Peptides / MESO-Rx footprint thinner than its Trustpilot volume suggests")).toBe(true);
    expect(isAbsenceOfEvidence("Genuine Reddit/MESO-Rx thread capture is thin")).toBe(true);
  });

  // The other side of the line, and the reason this cannot just match on "no". These describe what
  // the VENDOR does or does not do, which is a fact about the vendor and belongs under red flags.
  it("keeps a fact about the vendor as a finding", () => {
    expect(isAbsenceOfEvidence("No third-party testing data or COAs published (transparency gap)")).toBe(false);
    expect(isAbsenceOfEvidence("Suspected ingredient-switching after first order")).toBe(false);
    expect(isAbsenceOfEvidence("Named in an FDA warning letter")).toBe(false);
    expect(isAbsenceOfEvidence("Reports of orders never arriving")).toBe(false);
    expect(isAbsenceOfEvidence("Self-published COA accuracy questioned")).toBe(false);
  });

  it("treats an empty or meaningless string as neither", () => {
    expect(isAbsenceOfEvidence("")).toBe(false);
    expect(isAbsenceOfEvidence("   ")).toBe(false);
  });

  // Erring toward "finding" is the safer default: mislabelling a real warning as a gap would hide
  // it, which is worse than showing a gap in the wrong column.
  it("defaults to finding when the phrasing is unclear", () => {
    expect(isAbsenceOfEvidence("Mixed signals across sources")).toBe(false);
  });
});
