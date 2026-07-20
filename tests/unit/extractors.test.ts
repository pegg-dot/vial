import { describe, expect, it } from "vitest";
import { extractClaimCandidates } from "@/server/agents/extract";
import { DeterministicExtractor, getExtractor } from "@/server/agents/extractors";
import type { IngestionInput } from "@/server/agents/schemas";

function input(overrides: Partial<IngestionInput> = {}): IngestionInput {
  return {
    sourceType: "vendor-page",
    canonicalLocation: "https://example.test/bpc-157",
    label: "Example BPC-157 product page",
    targetListingSlug: "northstar-bpc-157-10mg",
    rawContent: `<html><body><h1>BPC-157 10 mg</h1><p>Price: $54</p><p>In stock</p></body></html>`,
    contentType: "text/html",
    parserProfile: "generic",
    actor: "unit-test",
    ...overrides,
  };
}

describe("extractor provider seam", () => {
  it("wraps the deterministic extractor and reports it as zero-cost", async () => {
    const extractor = new DeterministicExtractor();
    const result = await extractor.extract(input());
    // Regression: the wrapper must return exactly what the underlying extractor produces.
    expect(result.candidates).toEqual(extractClaimCandidates(input()));
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.extractorVersion).toBe("deterministic-v2");
    expect(result.costCents).toBe(0);
    expect(result.abstained).toBe(false);
  });

  it("marks abstention when nothing is extractable", async () => {
    const result = await new DeterministicExtractor().extract(input({ rawContent: "nothing useful here at all, just prose without any claims" }));
    expect(result.candidates).toEqual([]);
    expect(result.abstained).toBe(true);
  });

  it("selects the deterministic extractor by default", () => {
    const prev = process.env.VIAL_EXTRACTOR;
    delete process.env.VIAL_EXTRACTOR;
    expect(getExtractor().id).toBe("deterministic-v2");
    if (prev !== undefined) process.env.VIAL_EXTRACTOR = prev;
  });
});
