import { describe, expect, it } from "vitest";
import { ShadowExtractor } from "@/server/agents/extractors/shadow";
import type { ExtractionResult, ExtractorProvider } from "@/server/agents/extractors/types";
import type { IngestionInput } from "@/server/agents/schemas";

function stub(id: string, result: Partial<ExtractionResult>): ExtractorProvider {
  return { id, extract: async () => ({ candidates: [], extractorVersion: id, costCents: 0, abstained: true, ...result }) };
}
function input(): IngestionInput {
  return { sourceType: "vendor-page", canonicalLocation: "https://x.test/a", label: "shadow case", targetListingSlug: "x", rawContent: "<html><body>enough content here to pass</body></html>", contentType: "text/html", parserProfile: "generic", actor: "test" };
}
const claim = (predicate: string, value: string | number) => ({ predicate: predicate as never, value, confidence: 0.9, rationale: "test", riskLevel: "standard" as const });

describe("ShadowExtractor", () => {
  it("returns ONLY the deterministic result; the model's claims never reach review", async () => {
    const deterministic = stub("deterministic-v2", { candidates: [claim("price", 54)], abstained: false });
    const model = stub("model-extract-v1", { candidates: [claim("price", 54), claim("availability", "In stock")], abstained: false, costCents: 0.05 });
    const result = await new ShadowExtractor(deterministic, model).extract(input());
    expect(result.candidates).toEqual([claim("price", 54)]);
    expect(result.extractorVersion).toBe("deterministic-v2");
    // The model's extra availability claim is recorded for measurement, never published.
    expect((result.meta?.shadow as { modelCandidates: unknown[] }).modelCandidates).toHaveLength(2);
    // Shadow spends real model tokens — that cost is accounted even though nothing publishes.
    expect(result.costCents).toBeCloseTo(0.05, 6);
  });

  it("never lets a model failure break the authoritative deterministic path", async () => {
    const deterministic = stub("deterministic-v2", { candidates: [claim("price", 41)], abstained: false });
    const model: ExtractorProvider = { id: "model-extract-v1", extract: async () => { throw new Error("model down"); } };
    const result = await new ShadowExtractor(deterministic, model).extract(input());
    expect(result.candidates).toEqual([claim("price", 41)]);
    expect((result.meta?.shadow as { error?: string }).error).toBeTruthy();
  });
});
