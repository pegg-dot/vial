import Anthropic from "@anthropic-ai/sdk";
import type { ExtractionModelClient } from "./model";

// Structured-output schema handed to Haiku. Permissive on purpose — the ModelExtractor
// re-validates every claim against the strict zod schema and drops anything off-vocab,
// so this only needs to shape the JSON, not enforce the bounds.
const CLAIMS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["claims"],
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["predicate", "value", "confidence", "rationale", "riskLevel"],
        properties: {
          predicate: { type: "string", enum: ["price", "availability", "shipping", "batchCode", "reportDate", "reportIssuer", "reportConfirmed"] },
          value: { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] },
          confidence: { type: "number" },
          rationale: { type: "string" },
          riskLevel: { type: "string", enum: ["standard", "material", "high-impact"] },
        },
      },
    },
  },
} as const;

// Real Anthropic-backed extraction client. Returns an unavailable stub when no API key
// is configured, so the selector fails safe to the deterministic extractor rather than
// crashing. Exercised only by the live smoke script (scripts/model-extractor-smoke.mjs),
// never by the test suite — the suite uses an injected mock, exactly like Stripe.
export function createAnthropicExtractionClient(): ExtractionModelClient {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { available: false, extract: async () => ({ claims: [], usage: { inputTokens: 0, outputTokens: 0 } }) };
  }
  const client = new Anthropic({ apiKey });
  return {
    available: true,
    extract: async ({ system, user, maxOutputTokens }) => {
      const response = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: maxOutputTokens,
        system,
        output_config: { format: { type: "json_schema", schema: CLAIMS_JSON_SCHEMA } },
        messages: [{ role: "user", content: user }],
      } as Anthropic.MessageCreateParamsNonStreaming);
      const text = response.content.filter((block): block is Anthropic.TextBlock => block.type === "text").map((block) => block.text).join("");
      let claims: unknown[] = [];
      try {
        const parsed = JSON.parse(text) as { claims?: unknown };
        if (Array.isArray(parsed.claims)) claims = parsed.claims;
      } catch {
        // Malformed model output → no claims; the extractor abstains.
      }
      return { claims, usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } };
    },
  };
}
