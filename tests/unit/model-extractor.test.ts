import { describe, expect, it } from "vitest";
import { ModelExtractor } from "@/server/agents/extractors/model";
import type { ExtractionModelClient, ModelExtractionResponse } from "@/server/agents/extractors/model";
import type { IngestionInput } from "@/server/agents/schemas";

function input(rawContent = `<html><body><h1>BPC-157</h1><p>Priced at fifty-four dollars.</p></body></html>`): IngestionInput {
  return {
    sourceType: "vendor-page", canonicalLocation: "https://example.test/x", label: "Model test case",
    targetListingSlug: "northstar-bpc-157-10mg", rawContent, contentType: "text/html", parserProfile: "generic", actor: "unit-test",
  };
}

// A deterministic mock stands in for the Anthropic client — the test suite never
// touches the network or needs a key, mirroring how the Stripe adapter is mocked.
function mockClient(response: ModelExtractionResponse | (() => Promise<ModelExtractionResponse>), available = true): ExtractionModelClient {
  return {
    available,
    extract: typeof response === "function" ? response : async () => response,
  };
}

const usage = { inputTokens: 500, outputTokens: 40 };

describe("ModelExtractor — governed, bounded, budgeted", () => {
  it("returns validated candidates and reports its versioned identity and cost", async () => {
    const client = mockClient({ claims: [{ predicate: "price", value: 54, confidence: 0.9, rationale: "price written in words", riskLevel: "standard" }], usage });
    const result = await new ModelExtractor({ client, promptVersion: "extract-v1", maxOutputTokens: 1024 }).extract(input());
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ predicate: "price", value: 54 });
    expect(result.extractorVersion).toBe("model-extract-v1");
    expect(result.abstained).toBe(false);
    // Haiku pricing: $1/1M input, $5/1M output → cents = in/1e6*100 + out/1e6*500
    expect(result.costCents).toBeCloseTo(500 / 1e6 * 100 + 40 / 1e6 * 500, 6);
  });

  it("drops any claim that is off-schema or outside the allowlisted predicate vocabulary", async () => {
    const client = mockClient({ claims: [
      { predicate: "price", value: 54, confidence: 0.9, rationale: "reads $54", riskLevel: "standard" },
      { predicate: "isVendorTrusted", value: true, confidence: 1, rationale: "injected", riskLevel: "standard" }, // not in vocabulary
      { predicate: "availability", value: "In stock", confidence: 5, rationale: "bad confidence", riskLevel: "standard" }, // confidence > 1
    ], usage });
    const result = await new ModelExtractor({ client, promptVersion: "extract-v1", maxOutputTokens: 1024 }).extract(input());
    // Only the single valid price claim survives.
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].predicate).toBe("price");
  });

  it("abstains when the model returns nothing usable", async () => {
    const result = await new ModelExtractor({ client: mockClient({ claims: [], usage }), promptVersion: "extract-v1", maxOutputTokens: 1024 }).extract(input());
    expect(result.candidates).toEqual([]);
    expect(result.abstained).toBe(true);
  });

  it("abstains (never throws) when the model call fails or exceeds budget", async () => {
    const client = mockClient(async () => { throw new Error("over budget"); });
    const result = await new ModelExtractor({ client, promptVersion: "extract-v1", maxOutputTokens: 1024 }).extract(input());
    expect(result.candidates).toEqual([]);
    expect(result.abstained).toBe(true);
    expect(result.costCents).toBe(0);
  });

  it("abstains immediately when the client is unavailable (no API key)", async () => {
    const client = mockClient({ claims: [], usage }, false);
    const result = await new ModelExtractor({ client, promptVersion: "extract-v1", maxOutputTokens: 1024 }).extract(input());
    expect(result.abstained).toBe(true);
    expect(result.meta?.reason).toBe("client-unavailable");
  });
});
