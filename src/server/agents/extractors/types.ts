import type { ClaimCandidate, IngestionInput } from "../schemas";

// The extraction seam. Every extractor — deterministic or model-backed — produces the
// same bounded claim shape, so nothing downstream (Resolver / Verifier / Auditor /
// review / cascade) needs to know which one ran. Mirrors the commerce provider pattern
// (one interface, an env selector, a mock for tests).
export interface ExtractionResult {
  candidates: ClaimCandidate[];
  extractorVersion: string;
  costCents: number;
  abstained: boolean;
  meta?: Record<string, unknown>;
}

export interface ExtractorProvider {
  readonly id: string;
  extract(input: IngestionInput): Promise<ExtractionResult>;
}
