import { describe, expect, it } from "vitest";
import { resolveExtractorSelection } from "@/server/agents/extractors";

// The ship-gate: a model extractor is only selected when it is actually available AND
// explicitly approved. Anything unclear falls back to the deterministic baseline.
describe("extractor selection ship-gate", () => {
  it("defaults to deterministic", () => {
    expect(resolveExtractorSelection({ mode: "deterministic", clientAvailable: true, modelApproved: true })).toBe("deterministic");
    expect(resolveExtractorSelection({ mode: "", clientAvailable: true, modelApproved: true })).toBe("deterministic");
  });

  it("falls back to deterministic when the model is requested but the client is unavailable (no key)", () => {
    expect(resolveExtractorSelection({ mode: "model", clientAvailable: false, modelApproved: true })).toBe("deterministic");
    expect(resolveExtractorSelection({ mode: "shadow", clientAvailable: false, modelApproved: true })).toBe("deterministic");
  });

  it("blocks live model use until it is explicitly approved (benchmark-gated)", () => {
    expect(resolveExtractorSelection({ mode: "model", clientAvailable: true, modelApproved: false })).toBe("deterministic");
    expect(resolveExtractorSelection({ mode: "model", clientAvailable: true, modelApproved: true })).toBe("model");
  });

  it("runs shadow mode whenever the client is available — no approval needed (it never publishes)", () => {
    expect(resolveExtractorSelection({ mode: "shadow", clientAvailable: true, modelApproved: false })).toBe("shadow");
  });
});
