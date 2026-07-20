import type { IngestionInput } from "../schemas";
import type { ExtractionResult, ExtractorProvider } from "./types";

// Shadow mode: the deterministic extractor stays authoritative — its candidates are the
// only ones that flow to the review queue. The model runs in parallel purely for
// measurement; its output and the agreement with the deterministic result are recorded
// under meta.shadow for a logger to persist, but never published. A model failure is
// swallowed so the authoritative path is never at risk. The model's token cost is still
// accounted, because shadow mode really does spend it.
export class ShadowExtractor implements ExtractorProvider {
  readonly id: string;

  constructor(private readonly authoritative: ExtractorProvider, private readonly model: ExtractorProvider) {
    this.id = authoritative.id;
  }

  async extract(input: IngestionInput): Promise<ExtractionResult> {
    const primary = await this.authoritative.extract(input);
    let shadow: Record<string, unknown>;
    let modelCost = 0;
    try {
      const modelResult = await this.model.extract(input);
      modelCost = modelResult.costCents;
      shadow = {
        modelExtractorVersion: modelResult.extractorVersion,
        modelCandidates: modelResult.candidates,
        modelAbstained: modelResult.abstained,
        agreement: agreementRate(primary, modelResult),
        modelCostCents: modelResult.costCents,
      };
    } catch (error) {
      shadow = { error: error instanceof Error ? error.message : "model-error" };
    }
    return {
      ...primary,
      costCents: primary.costCents + modelCost,
      meta: { ...primary.meta, shadow },
    };
  }
}

// Fraction of predicates on which the two extractors agree on the exact value.
function agreementRate(a: ExtractionResult, b: ExtractionResult): number {
  const map = new Map(a.candidates.map((c) => [c.predicate, c.value]));
  const predicates = new Set([...a.candidates.map((c) => c.predicate), ...b.candidates.map((c) => c.predicate)]);
  if (predicates.size === 0) return 1;
  let agree = 0;
  for (const candidate of b.candidates) {
    if (map.has(candidate.predicate) && String(map.get(candidate.predicate)) === String(candidate.value)) agree += 1;
  }
  return agree / predicates.size;
}
