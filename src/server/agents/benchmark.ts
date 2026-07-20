import type { ClaimCandidate } from "./schemas";

// Scores an extractor against a hand-labeled golden dataset. Per case we count claim
// matches by (predicate, value); across cases we compute precision / recall / F1, plus
// abstention-correctness — did the extractor correctly emit nothing when the page held
// nothing extractable. This is the measurement gate a model must pass before it can be
// promoted past the deterministic baseline.

export interface ExpectedClaim {
  predicate: ClaimCandidate["predicate"];
  value: string | number | boolean;
}

export interface CaseScore {
  tp: number;
  fp: number;
  fn: number;
  correctAbstention: boolean;
  expectedEmpty: boolean;
}

export interface BenchmarkScore {
  precision: number;
  recall: number;
  f1: number;
  abstentionCorrectRate: number;
  caseCount: number;
  tp: number;
  fp: number;
  fn: number;
}

// Same value equivalence the pipeline uses: numeric-tolerant, boolean-tolerant,
// otherwise a trimmed case-insensitive string compare.
function sameValue(left: unknown, right: unknown): boolean {
  if (typeof left === "number" || typeof right === "number") return Number(left) === Number(right);
  if (typeof left === "boolean" || typeof right === "boolean") return Boolean(left) === Boolean(right);
  return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}

export function scoreCase(predicted: ClaimCandidate[], expected: ExpectedClaim[]): CaseScore {
  const expectedByPredicate = new Map(expected.map((e) => [e.predicate, e.value]));
  const predictedByPredicate = new Map(predicted.map((p) => [p.predicate, p.value]));
  let tp = 0;
  let fp = 0;
  let fn = 0;
  const predicates = new Set([...expectedByPredicate.keys(), ...predictedByPredicate.keys()]);
  for (const predicate of predicates) {
    const hasExpected = expectedByPredicate.has(predicate);
    const hasPredicted = predictedByPredicate.has(predicate);
    if (hasExpected && hasPredicted && sameValue(predictedByPredicate.get(predicate), expectedByPredicate.get(predicate))) {
      tp += 1;
    } else {
      if (hasPredicted) fp += 1; // predicted a wrong/unexpected claim
      if (hasExpected) fn += 1; // missed an expected claim
    }
  }
  const expectedEmpty = expected.length === 0;
  return { tp, fp, fn, correctAbstention: expectedEmpty && predicted.length === 0, expectedEmpty };
}

export function aggregateBenchmark(cases: CaseScore[]): BenchmarkScore {
  const tp = cases.reduce((sum, c) => sum + c.tp, 0);
  const fp = cases.reduce((sum, c) => sum + c.fp, 0);
  const fn = cases.reduce((sum, c) => sum + c.fn, 0);
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const abstentionCases = cases.filter((c) => c.expectedEmpty);
  const abstentionCorrectRate = abstentionCases.length === 0
    ? 1
    : abstentionCases.filter((c) => c.correctAbstention).length / abstentionCases.length;
  return { precision, recall, f1, abstentionCorrectRate, caseCount: cases.length, tp, fp, fn };
}
