import { describe, expect, it } from "vitest";
import { buildBuyerRead, type BuyerReadInput } from "@/lib/buyer-read";

const base = (over: Partial<BuyerReadInput>): BuyerReadInput => ({
  status: "no-claim", independentPurity: null, priceFlag: null, priceAssessable: true, compoundCoas: 0,
  compoundMedianPurity: null, vendorFlagged: false, compoundName: "BPC-157", vendorName: "Acme Peptides", ...over,
});

describe("buildBuyerRead — an honest buying decision on every listing, not a dead 'unverified'", () => {
  it("ALWAYS ends with a concrete way to verify — even when there's no evidence", () => {
    for (const status of ["no-claim", "unbacked", "verified", "batch-verified", "low-purity", "mismatch"]) {
      const r = buildBuyerRead(base({ status }));
      expect(r.action).toMatch(/verify/i);
      expect(r.action.length).toBeGreaterThan(20);
    }
  });

  it("a tested listing reads as tested, and still nudges the batch caveat", () => {
    const r = buildBuyerRead(base({ status: "verified", independentPurity: 99.4 }));
    expect(r.verdict).toBe("tested");
    expect(r.points.some((p) => p.tone === "good" && p.text.includes("99.4%"))).toBe(true);
    expect(r.points.some((p) => /batch|every vial/i.test(p.text))).toBe(true);
  });

  it("an untested listing is NOT a dead end — it carries the compound benchmark, scoped to OTHER makers", () => {
    const r = buildBuyerRead(base({ status: "no-claim", compoundCoas: 9, compoundMedianPurity: 99 }));
    expect(r.verdict).toBe("untested");
    const bench = r.points.find((p) => p.text.includes("9 independent"));
    expect(bench).toBeTruthy();
    expect(bench!.text).toMatch(/other makers|not proof/i); // must not imply it's THIS seller's evidence
  });

  it("a too-cheap price is surfaced as the top red flag", () => {
    const r = buildBuyerRead(base({ status: "no-claim", priceFlag: "too-cheap" }));
    expect(r.points[0].tone).toBe("bad");
    expect(r.points[0].text).toMatch(/below|underdosing|fake/i);
  });

  it("a cert mismatch is flagged, not softened", () => {
    const r = buildBuyerRead(base({ status: "mismatch" }));
    expect(r.verdict).toBe("flagged");
    expect(r.points.some((p) => p.tone === "bad" && /different manufacturer|counterfeit/i.test(p.text))).toBe(true);
  });

  it("never invents evidence — a no-COA compound says so plainly", () => {
    const r = buildBuyerRead(base({ status: "no-claim", compoundCoas: 0 }));
    expect(r.points.some((p) => /no independent tests/i.test(p.text))).toBe(true);
  });

  it("does NOT clear a price it never evaluated — unreadable size / thin market fails toward unknown", () => {
    // priceFlag null + priceAssessable false = the detector couldn't run; asserting "within normal
    // range" would be a fabricated clearance (the high-severity bug the verifier caught live).
    const notAssessable = buildBuyerRead(base({ status: "no-claim", priceFlag: null, priceAssessable: false }));
    expect(notAssessable.points.some((p) => /within the normal range/i.test(p.text))).toBe(false);
    expect(notAssessable.points.some((p) => /couldn't place this listing's price/i.test(p.text))).toBe(true);
    // When it WAS assessable and cleared, the clearance is legitimate.
    const assessable = buildBuyerRead(base({ status: "no-claim", priceFlag: null, priceAssessable: true }));
    expect(assessable.points.some((p) => /within the normal range/i.test(p.text))).toBe(true);
  });

  it("a low-purity listing's headline must NOT deny the test that came back below claim", () => {
    // The headline used to read "No independent test ... yet" while the body reported a test that
    // measured low — a same-card contradiction. It must acknowledge the test exists.
    const r = buildBuyerRead(base({ status: "low-purity", independentPurity: 90.17, compoundName: "DSIP", vendorName: "STL" }));
    expect(r.verdict).toBe("flagged");
    expect(r.headline).not.toMatch(/no independent test/i);
    expect(r.headline).toMatch(/below the usual purity/i);
    expect(r.points.some((p) => /measured below the usual claim/i.test(p.text))).toBe(true);
  });
});
