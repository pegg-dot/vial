import { DeterministicExtractor } from "./deterministic";
import type { ExtractorProvider } from "./types";

export type { ExtractionResult, ExtractorProvider } from "./types";
export { DeterministicExtractor } from "./deterministic";

// Selector for the active extractor. `model` and `shadow` modes are added in later
// parts (Part B shadow plumbing, Part C the model extractor); until then the selector
// resolves to the deterministic baseline. Fail-safe: any unrecognized value, or a
// model mode without a passing benchmark, falls back to deterministic.
export function getExtractor(): ExtractorProvider {
  return new DeterministicExtractor();
}
