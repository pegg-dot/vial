import { describe, expect, it } from "vitest";
import { scoreCase, aggregateBenchmark } from "@/server/agents/benchmark";
import type { ClaimCandidate } from "@/server/agents/schemas";

function claim(predicate: ClaimCandidate["predicate"], value: string | number | boolean): ClaimCandidate {
  return { predicate, value, confidence: 0.9, rationale: "test", riskLevel: "standard" };
}

describe("extraction benchmark scorer", () => {
  it("counts a perfect extraction as all true positives", () => {
    const s = scoreCase([claim("price", 54), claim("availability", "In stock")], [{ predicate: "price", value: 54 }, { predicate: "availability", value: "In stock" }]);
    expect(s).toMatchObject({ tp: 2, fp: 0, fn: 0, correctAbstention: false });
  });

  it("matches values across type (number vs string) and case", () => {
    const s = scoreCase([claim("price", 54), claim("availability", "in stock")], [{ predicate: "price", value: "54" }, { predicate: "availability", value: "In Stock" }]);
    expect(s.tp).toBe(2);
    expect(s.fp).toBe(0);
  });

  it("counts a hallucinated claim as a false positive", () => {
    const s = scoreCase([claim("price", 54)], []);
    expect(s).toMatchObject({ tp: 0, fp: 1, fn: 0, correctAbstention: false });
  });

  it("counts a missed claim as a false negative", () => {
    const s = scoreCase([], [{ predicate: "price", value: 54 }]);
    expect(s).toMatchObject({ tp: 0, fp: 0, fn: 1 });
  });

  it("counts a wrong value on the right predicate as both a false positive and false negative", () => {
    const s = scoreCase([claim("price", 99)], [{ predicate: "price", value: 54 }]);
    expect(s).toMatchObject({ tp: 0, fp: 1, fn: 1 });
  });

  it("credits a correct abstention when nothing was extractable", () => {
    const s = scoreCase([], []);
    expect(s).toMatchObject({ tp: 0, fp: 0, fn: 0, correctAbstention: true });
  });

  it("aggregates precision, recall, F1 and abstention-correctness across cases", () => {
    const agg = aggregateBenchmark([
      { tp: 2, fp: 0, fn: 0, correctAbstention: false, expectedEmpty: false },
      { tp: 0, fp: 1, fn: 1, correctAbstention: false, expectedEmpty: false },
      { tp: 0, fp: 0, fn: 0, correctAbstention: true, expectedEmpty: true },
    ]);
    // tp=2 fp=1 fn=1 -> precision 2/3, recall 2/3, f1 2/3
    expect(agg.precision).toBeCloseTo(2 / 3, 5);
    expect(agg.recall).toBeCloseTo(2 / 3, 5);
    expect(agg.f1).toBeCloseTo(2 / 3, 5);
    // 1 of 1 abstention cases correct
    expect(agg.abstentionCorrectRate).toBe(1);
    expect(agg.caseCount).toBe(3);
  });
});
