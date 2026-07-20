import { describe, expect, it } from "vitest";
import { runExtractionBenchmark } from "@/server/agents/benchmark-runner";
import { DeterministicExtractor } from "@/server/agents/extractors";
import { goldenCases } from "@/server/agents/golden";

describe("deterministic baseline benchmark", () => {
  it("scores the deterministic extractor across the full golden dataset at zero cost", async () => {
    const report = await runExtractionBenchmark(new DeterministicExtractor(), goldenCases);
    expect(report.extractorId).toBe("deterministic-v2");
    expect(report.score.caseCount).toBe(goldenCases.length);
    expect(report.totalCostCents).toBe(0);
    // The baseline never hallucinates (precision 1.0) and correctly abstains on the
    // injection and empty pages.
    expect(report.score.precision).toBe(1);
    expect(report.score.abstentionCorrectRate).toBe(1);
    // It is strong but not perfect: the discriminative hard cases (price-in-words,
    // implied availability, batch-in-prose) are genuine recall gaps a model must close.
    expect(report.score.recall).toBeGreaterThanOrEqual(0.75);
    expect(report.score.recall).toBeLessThan(1);
    const hardMisses = report.caseResults.filter((c) => c.difficulty === "hard" && c.fn > 0).map((c) => c.name);
    expect(hardMisses).toEqual(expect.arrayContaining(["price-in-words", "implied-availability", "batch-in-prose"]));
  });
});
