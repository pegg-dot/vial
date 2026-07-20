import type { IngestionInput } from "../schemas";
import { extractClaimCandidates } from "../extract";
import type { ExtractionResult, ExtractorProvider } from "./types";

// Wraps the existing hand-written deterministic extractor unchanged. It is the
// authoritative baseline the benchmark scores every other extractor against, and it
// remains the default in the pipeline.
export class DeterministicExtractor implements ExtractorProvider {
  readonly id = "deterministic-v2";

  async extract(input: IngestionInput): Promise<ExtractionResult> {
    const candidates = extractClaimCandidates(input);
    return {
      candidates,
      extractorVersion: this.id,
      costCents: 0,
      abstained: candidates.length === 0,
    };
  }
}
