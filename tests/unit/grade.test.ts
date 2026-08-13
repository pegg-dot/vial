import { describe, expect, it } from "vitest";
import { gradeFromVerdict } from "@/server/verify/grade";
import { composeVerdict as composeVerdictReal, type ComposedVerdict } from "@/server/verify/trust-graph";
import type { Signal } from "@/server/verify/index";

function composed(over: Partial<ComposedVerdict> & { factors?: Signal[] } = {}): ComposedVerdict {
  const factors = over.factors ?? [];
  return {
    verdict: "trusted",
    headline: "Acme — generally trusted",
    summary: "summary",
    factors,
    weighed: factors.length,
    verifiedCount: factors.filter(f => f.confidence === "verified").length,
    ...over,
  };
}

const verifiedOk = (label: string): Signal => ({ ok: true, label, detail: "d", confidence: "verified" });
const verifiedBad = (label: string): Signal => ({ ok: false, label, detail: "d", confidence: "verified" });
const reportedBad = (label: string): Signal => ({ ok: false, label, detail: "d", confidence: "reported" });
// The trust graph records an ABSENCE as ok:false with no confidence tag — deliberately, so a gap
// earns no "verified" chip. A grade must read that as "nothing on record", never as evidence against.
const absence = (label: string): Signal => ({ ok: false, label, detail: "none on record" });

describe("VialGrade letter", () => {
  it("refuses to grade an unproven vendor", () => {
    const grade = gradeFromVerdict(composed({ verdict: "unproven" }), { coaCount: 0 });
    expect(grade.letter).toBeNull();
    expect(grade.band).toBe("insufficient");
    expect(grade.headline.toLowerCase()).toContain("not enough evidence");
  });

  // Thin data must never be laundered into a confident letter — that is the failure mode the
  // whole product exists to prevent.
  it("refuses to grade even when a thin positive signal exists", () => {
    const grade = gradeFromVerdict(
      composed({ verdict: "unproven", factors: [verifiedOk("Independent testing")] }),
      { coaCount: 0 },
    );
    expect(grade.letter).toBeNull();
  });

  it("grades a well-evidenced trusted vendor an A", () => {
    const factors = [verifiedOk("Independent testing"), verifiedOk("Government enforcement"), verifiedOk("Operator network")];
    const grade = gradeFromVerdict(composed({ verdict: "trusted", factors }), { coaCount: 12 });
    expect(grade.letter).toBe("A");
    expect(grade.band).toBe("strong");
  });

  it("caps a trusted vendor with no lab tests at B, however many other signals it has", () => {
    const factors = [verifiedOk("Government enforcement"), verifiedOk("Operator network"), verifiedOk("Third-party trackers")];
    const grade = gradeFromVerdict(composed({ verdict: "trusted", factors }), { coaCount: 0 });
    expect(grade.letter).toBe("B");
  });

  // A clean record is the entry condition for the band, not a differentiator. Testing depth is
  // what actually separates one trusted vendor from another, so the band must spread across it.
  it("spreads the trusted band across independent testing depth", () => {
    const letters = [0, 1, 2, 3, 9, 10, 19].map(
      coaCount => gradeFromVerdict(composed({ verdict: "trusted" }), { coaCount }).letter,
    );
    expect(letters).toEqual(["B", "B+", "B+", "A-", "A-", "A", "A"]);
  });

  it("does not collapse the trusted band onto one letter for real-shaped inputs", () => {
    // Every clean vendor scores exactly one verified signal (its lab-test seam), which is the
    // shape that previously made 70% of live vendors share a grade.
    const oneVerified = [verifiedOk("Independent testing")];
    const distinct = new Set(
      [1, 4, 12].map(coaCount => gradeFromVerdict(composed({ verdict: "trusted", factors: oneVerified }), { coaCount }).letter),
    );
    expect(distinct.size).toBe(3);
  });

  it("grades caution in the C band and names the reason", () => {
    const grade = gradeFromVerdict(
      composed({ verdict: "caution", factors: [reportedBad("Buyer reviews")] }),
      { coaCount: 3 },
    );
    expect(grade.letter).toBe("C+");
    expect(grade.rationale).toBeTruthy();
  });

  it("drops caution to C- when a verified negative is on record", () => {
    const grade = gradeFromVerdict(
      composed({ verdict: "caution", factors: [verifiedBad("COA integrity")] }),
      { coaCount: 3 },
    );
    expect(grade.letter).toBe("C-");
  });

  it("grades avoid an F when backed by a verified record", () => {
    const grade = gradeFromVerdict(
      composed({ verdict: "avoid", factors: [verifiedBad("Government enforcement")] }),
      { coaCount: 0 },
    );
    expect(grade.letter).toBe("F");
    expect(grade.band).toBe("adverse");
  });

  it("grades avoid a D when it rests only on reported accounts", () => {
    const grade = gradeFromVerdict(
      composed({ verdict: "avoid", factors: [reportedBad("Buyer reviews")] }),
      { coaCount: 0 },
    );
    expect(grade.letter).toBe("D");
  });
});

describe("VialGrade dimensions", () => {
  it("reads an untagged absence as nothing-on-record, not as evidence against", () => {
    const grade = gradeFromVerdict(
      composed({ verdict: "caution", factors: [absence("Independent testing")] }),
      { coaCount: 0 },
    );
    const testing = grade.dimensions.find(d => d.key === "testing")!;
    expect(testing.state).toBe("absent");
  });

  // The trust graph records "we looked and found no enforcement record" as an UNTAGGED positive
  // so a gap never earns a verified chip. Showing that as evidence FOR a vendor oversells it.
  it("separates checked-and-clear from evidence-on-file", () => {
    const clear = gradeFromVerdict(
      composed({ verdict: "caution", factors: [{ ok: true, label: "Government enforcement", detail: "none on file" }] }),
      { coaCount: 0 },
    );
    expect(clear.dimensions.find(d => d.key === "regulatory")!.state).toBe("clear");

    const supported = gradeFromVerdict(
      composed({ verdict: "caution", factors: [verifiedOk("Government enforcement")] }),
      { coaCount: 0 },
    );
    expect(supported.dimensions.find(d => d.key === "regulatory")!.state).toBe("supported");
  });

  it("marks a dimension adverse only for a confidence-tagged negative", () => {
    const grade = gradeFromVerdict(
      composed({ verdict: "caution", factors: [verifiedBad("COA integrity")] }),
      { coaCount: 1 },
    );
    expect(grade.dimensions.find(d => d.key === "testing")!.state).toBe("adverse");
  });

  it("surfaces conflicting evidence as its own state rather than averaging it away", () => {
    const grade = gradeFromVerdict(
      composed({ verdict: "caution", factors: [{ ok: null, label: "Conflicting evidence", detail: "d", confidence: "verified" }] }),
      { coaCount: 2 },
    );
    expect(grade.dimensions.find(d => d.key === "reputation")!.state).toBe("conflicting");
  });

  // Derived from a REAL composeVerdict run, not a hand-copied list. A hand-copied list can never
  // fail when a new seam is added to the trust graph — and an unrouted seam is silently dropped
  // from every dimension, so a factor the verdict weighed vanishes from the breakdown.
  it("routes every factor a real composeVerdict emits into exactly one dimension", () => {
    // Inputs chosen to light up as many seams as possible in one composition.
    const real = composeVerdictReal({
      vendorName: "Seam Co", coaCount: 2, medianPurity: 97, blindCount: 1,
      enforcement: [{ severity: "caution" }],
      reputationDimensions: [
        { key: "open_risk_flags", status: "disputed", value: "flagged" },
        { key: "evidence_corroboration", status: "disputed", value: "conflict" },
      ],
      aggregators: [{ source: "tracker", score: 9, max_score: 10 }],
      signals: { domain_age_note: "3 months old", research_disclaimer: false, notable_copy: "back online", payment_methods: ["crypto"] },
      review: { sentiment: "mixed", reviewVolume: "heavy", confidence: "high" },
      community: { classification: "vouch", positiveCount: 3, mentionCount: 4, negativeCount: 0 },
      links: [], status: { status: "offline" }, flagCount: 1,
    });
    expect(real.factors.length).toBeGreaterThan(6);

    const grade = gradeFromVerdict(real, { coaCount: 2 });
    const routed = grade.dimensions.flatMap(d => d.factors.map(f => f.label)).sort();
    expect(routed).toEqual(real.factors.map(f => f.label).sort());
  });
});

// 57 of 62 top grades belonged to vendors with nothing listed for sale — raw-material makers known
// only from a self-declared name on one certificate. They outranked real storefronts in the
// directory whose headline question is "which one won't scam me?". A letter answers "should I buy
// from them", which is a question a maker's record cannot answer.
describe("VialGrade — makers are not shops", () => {
  it("refuses a buyer letter for a vendor with nothing listed", () => {
    const factors = [verifiedOk("Independent testing"), verifiedOk("Government enforcement"), verifiedOk("Operator network")];
    const grade = gradeFromVerdict(composed({ verdict: "trusted", factors }), { coaCount: 19, listingCount: 0 });
    expect(grade.letter).toBeNull();
    expect(grade.band).toBe("reference");
    expect(grade.headline.toLowerCase()).toContain("maker");
  });

  it("says why, and credits the tests it does hold", () => {
    const grade = gradeFromVerdict(composed({ verdict: "trusted" }), { coaCount: 19, listingCount: 0 });
    expect(grade.rationale).toContain("19 independent lab tests");
    expect(grade.rationale.toLowerCase()).toContain("nothing to rate");
  });

  it("still grades a real storefront normally", () => {
    const grade = gradeFromVerdict(composed({ verdict: "trusted" }), { coaCount: 12, listingCount: 34 });
    expect(grade.letter).toBe("A");
    expect(grade.band).toBe("strong");
  });

  // Unknown listing count must not silently reclassify every vendor as a maker.
  it("treats an unknown listing count as a storefront", () => {
    const grade = gradeFromVerdict(composed({ verdict: "trusted" }), { coaCount: 12 });
    expect(grade.letter).toBe("A");
  });
});
