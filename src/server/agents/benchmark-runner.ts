import type { ExtractorProvider } from "./extractors";
import { aggregateBenchmark, scoreCase, type BenchmarkScore, type CaseScore } from "./benchmark";
import { goldenCaseToInput, type GoldenCase } from "./golden";

export interface BenchmarkCaseResult extends CaseScore {
  name: string;
  difficulty: GoldenCase["difficulty"];
  predicted: { predicate: string; value: string | number | boolean }[];
  costCents: number;
}

export interface BenchmarkReport {
  extractorId: string;
  score: BenchmarkScore;
  totalCostCents: number;
  caseResults: BenchmarkCaseResult[];
}

// Runs an extractor over the golden dataset and returns a full report. Pure with
// respect to the DB — the persistence layer (benchmark run rows) wraps this.
export async function runExtractionBenchmark(extractor: ExtractorProvider, cases: GoldenCase[]): Promise<BenchmarkReport> {
  const caseScores: CaseScore[] = [];
  const caseResults: BenchmarkCaseResult[] = [];
  let totalCostCents = 0;
  for (const goldenCase of cases) {
    const result = await extractor.extract(goldenCaseToInput(goldenCase));
    const score = scoreCase(result.candidates, goldenCase.expected);
    caseScores.push(score);
    totalCostCents += result.costCents;
    caseResults.push({
      ...score,
      name: goldenCase.name,
      difficulty: goldenCase.difficulty,
      predicted: result.candidates.map((c) => ({ predicate: c.predicate, value: c.value })),
      costCents: result.costCents,
    });
  }
  return {
    extractorId: extractor.id,
    score: aggregateBenchmark(caseScores),
    totalCostCents,
    caseResults,
  };
}
