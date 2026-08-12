// Live smoke for the governed model extractor. Requires ANTHROPIC_API_KEY.
// Runs Haiku against the golden dataset and compares it to the deterministic baseline —
// this is the measurement the ship-gate depends on. Never runs in CI (needs a key + spends).
//   node --import tsx scripts/model-extractor-smoke.mjs
import { createAnthropicExtractionClient } from "../src/server/agents/extractors/anthropic-client.ts";
import { ModelExtractor, DeterministicExtractor } from "../src/server/agents/extractors/index.ts";
import { runExtractionBenchmark } from "../src/server/agents/benchmark-runner.ts";
import { goldenCases } from "../src/server/agents/golden.ts";

const client = createAnthropicExtractionClient();
if (!client.available) {
  console.log("ANTHROPIC_API_KEY not set — cannot run the live model. Set it in .env.local and re-run.");
  process.exit(0);
}

const baseline = await runExtractionBenchmark(new DeterministicExtractor(), goldenCases);
const model = await runExtractionBenchmark(
  new ModelExtractor({ client, promptVersion: process.env.VIALGRADE_EXTRACTOR_PROMPT_VERSION ?? "extract-v1", maxOutputTokens: Number(process.env.VIALGRADE_EXTRACTOR_MAX_TOKENS ?? 4000) }),
  goldenCases,
);

const fmt = (r) => `P=${r.score.precision.toFixed(3)} R=${r.score.recall.toFixed(3)} F1=${r.score.f1.toFixed(3)} abstain=${r.score.abstentionCorrectRate.toFixed(2)} cost=${r.totalCostCents.toFixed(3)}c`;
console.log("baseline (deterministic):", fmt(baseline));
console.log("model (haiku):           ", fmt(model));

// Ship-gate rule: the model earns promotion only if it beats the baseline on F1
// (or matches F1 while never hallucinating and abstaining correctly).
const beatsF1 = model.score.f1 > baseline.score.f1 && model.score.precision >= baseline.score.precision;
console.log(beatsF1
  ? `\n✅ Model BEATS the baseline on F1 (${model.score.f1.toFixed(3)} > ${baseline.score.f1.toFixed(3)}). It is eligible for promotion — set VIALGRADE_MODEL_EXTRACTOR_APPROVED=true to activate.`
  : `\n⛔ Model does NOT beat the baseline. Keep VIALGRADE_EXTRACTOR=deterministic. The hard cases the baseline misses:` +
    "\n  " + model.caseResults.filter((c) => c.difficulty === "hard").map((c) => `${c.name}: fn=${c.fn} fp=${c.fp}`).join("\n  "));
