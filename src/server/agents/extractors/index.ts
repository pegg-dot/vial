import { DeterministicExtractor } from "./deterministic";
import { ModelExtractor } from "./model";
import { createAnthropicExtractionClient } from "./anthropic-client";
import { ShadowExtractor } from "./shadow";
import type { ExtractorProvider } from "./types";

export type { ExtractionResult, ExtractorProvider } from "./types";
export { DeterministicExtractor } from "./deterministic";
export { ModelExtractor } from "./model";
export { ShadowExtractor } from "./shadow";

export type ExtractorSelection = "deterministic" | "model" | "shadow";

// The ship-gate, as a pure decision. A model extractor is selected only when it is
// actually available (a key is configured) AND explicitly approved — the latter is set
// by an operator only after a benchmark shows the model beats the deterministic
// baseline. Shadow mode runs whenever the client is available: it never publishes, so
// it needs no approval. Anything unclear falls back to the deterministic baseline.
export function resolveExtractorSelection(opts: { mode: string; clientAvailable: boolean; modelApproved: boolean }): ExtractorSelection {
  const mode = opts.mode.toLowerCase();
  if (mode === "shadow") return opts.clientAvailable ? "shadow" : "deterministic";
  if (mode === "model") return opts.clientAvailable && opts.modelApproved ? "model" : "deterministic";
  return "deterministic";
}

export function getExtractor(): ExtractorProvider {
  const deterministic = new DeterministicExtractor();
  const client = createAnthropicExtractionClient();
  const selection = resolveExtractorSelection({
    mode: process.env.VIAL_EXTRACTOR ?? "deterministic",
    clientAvailable: client.available,
    modelApproved: process.env.VIAL_MODEL_EXTRACTOR_APPROVED === "true",
  });
  if (selection === "deterministic") return deterministic;
  const model = new ModelExtractor({
    client,
    promptVersion: process.env.VIAL_EXTRACTOR_PROMPT_VERSION ?? "extract-v1",
    maxOutputTokens: Number(process.env.VIAL_EXTRACTOR_MAX_TOKENS ?? 4000),
  });
  // Shadow: deterministic stays authoritative; the model runs alongside for measurement only.
  if (selection === "shadow") return new ShadowExtractor(deterministic, model);
  return model;
}
