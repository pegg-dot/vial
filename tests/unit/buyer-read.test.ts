import { describe, expect, it } from "vitest";
import { buildBuyerRead, type BuyerReadInput } from "@/lib/buyer-read";

const base = (over: Partial<BuyerReadInput>): BuyerReadInput => ({
  status: "no-claim", independentPurity: null, priceFlag: null, compoundCoas: 0,
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
});
