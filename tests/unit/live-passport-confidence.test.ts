import { describe, expect, it } from "vitest";
import { computeLivePassportConfidence, type LiveCoa } from "@/server/evidence-network/live-passports";

const coa = (over: Partial<LiveCoa> = {}): LiveCoa => ({
  id: "labtest:1", lab: "Janoshik Analytical", purityPct: 99.2, isBlind: false,
  testedAt: "2026-06-01", testType: "purity", measuredContent: null, ...over,
});

describe("computeLivePassportConfidence", () => {
  it("is a decomposed, explainable basis — never a black box", () => {
    const b = computeLivePassportConfidence([coa()]);
    expect(b.headline).toBeGreaterThan(0);
    expect(b.headline).toBeLessThanOrEqual(0.93);
    expect(b.sampleCount).toBe(1);
    expect(b.factors).toHaveProperty("volume");
    expect(b.factors).toHaveProperty("blind");
  });

  it("rewards a blind test — the strongest independence signal", () => {
    const plain = computeLivePassportConfidence([coa({ testedAt: "2026-06-01" })]);
    const blind = computeLivePassportConfidence([coa({ isBlind: true, testedAt: "2026-06-01" })]);
    expect(blind.headline).toBeGreaterThan(plain.headline);
    expect(blind.hasBlind).toBe(true);
  });

  it("rewards corroboration across multiple independent labs", () => {
    const one = computeLivePassportConfidence([coa({ lab: "Janoshik Analytical" })]);
    const two = computeLivePassportConfidence([
      coa({ id: "a", lab: "Janoshik Analytical" }),
      coa({ id: "b", lab: "MZ Biolabs" }),
    ]);
    expect(two.independentLabCount).toBe(2);
    expect(two.headline).toBeGreaterThan(one.headline);
  });

  it("penalizes and flags materially disagreeing purities", () => {
    const agree = computeLivePassportConfidence([coa({ id: "a", purityPct: 99.1 }), coa({ id: "b", purityPct: 99.4 })]);
    const conflict = computeLivePassportConfidence([coa({ id: "a", purityPct: 99.4 }), coa({ id: "b", purityPct: 88.0 })]);
    expect(agree.purity.agreement).toBe("agree");
    expect(conflict.purity.agreement).toBe("conflict");
    expect(conflict.headline).toBeLessThan(agree.headline);
  });

  it("decays confidence for stale evidence and never exceeds the external-COA ceiling", () => {
    const fresh = computeLivePassportConfidence([coa({ testedAt: "2026-06-01" })]);
    const stale = computeLivePassportConfidence([coa({ testedAt: "2019-01-01" })]);
    expect(stale.headline).toBeLessThan(fresh.headline);
    // Even a large, blind, multi-lab, agreeing set stays below regulatory-grade certainty.
    const strong = computeLivePassportConfidence([
      coa({ id: "a", lab: "Janoshik Analytical", isBlind: true, purityPct: 99.5, testedAt: "2026-06-01" }),
      coa({ id: "b", lab: "MZ Biolabs", isBlind: true, purityPct: 99.6, testedAt: "2026-06-01" }),
      coa({ id: "c", lab: "Colmaric Analyticals", purityPct: 99.4, testedAt: "2026-06-01" }),
      coa({ id: "d", lab: "Vanguard Laboratory", purityPct: 99.5, testedAt: "2026-06-01" }),
    ]);
    expect(strong.headline).toBeLessThanOrEqual(0.93);
  });

  it("marks safety dimensions established only when a matching test exists, unknown otherwise", () => {
    const purityOnly = computeLivePassportConfidence([coa({ testType: "purity" })]);
    expect(purityOnly.dimensions.sterility).toBe("unknown");
    expect(purityOnly.dimensions.purity).toBe("established");
    const withSterility = computeLivePassportConfidence([coa({ id: "a", testType: "purity" }), coa({ id: "b", testType: "sterility" })]);
    expect(withSterility.dimensions.sterility).toBe("established");
    expect(purityOnly.limitations).toContain("Sterility not tested");
  });

  it("always records that this is external evidence VIAL did not observe in custody", () => {
    const b = computeLivePassportConfidence([coa()]);
    expect(b.limitations.some((l) => /custody|external/i.test(l))).toBe(true);
  });
});
