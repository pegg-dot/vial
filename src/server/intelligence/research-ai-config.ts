import { createHmac, randomBytes } from "node:crypto";

/**
 * The model route must remain unavailable on the public production site.
 * An operator must explicitly opt into the localhost pilot AND supply a
 * budgeted Vercel AI Gateway API key. No automatic credential creation.
 */
export const RESEARCH_AI_MODEL = "openai/gpt-5.4-mini";
export const RESEARCH_AI_MAX_CALLS_PER_PROCESS = 12;

export type ResearchAiAvailability = {
  enabled: boolean;
  reason: "ready" | "not-local" | "opt-in-required" | "key-not-configured";
  model: string;
};

type ResearchAiEnvironment = Partial<Record<
  "VIALGRADE_LOCAL_PREVIEW" | "VIALGRADE_PUBLIC_EVIDENCE_ONLY" |
  "VIALGRADE_RESEARCH_AI_ENABLED" | "AI_GATEWAY_API_KEY",
  string | undefined
>>;
export function researchAiAvailability(env: ResearchAiEnvironment = {
  VIALGRADE_LOCAL_PREVIEW: process.env.VIALGRADE_LOCAL_PREVIEW,
  VIALGRADE_PUBLIC_EVIDENCE_ONLY: process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY,
  VIALGRADE_RESEARCH_AI_ENABLED: process.env.VIALGRADE_RESEARCH_AI_ENABLED,
  AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
}): ResearchAiAvailability {
  const reason =
    env.VIALGRADE_LOCAL_PREVIEW !== "true" || env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true" ? "not-local" :
    env.VIALGRADE_RESEARCH_AI_ENABLED !== "true" ? "opt-in-required" :
    !env.AI_GATEWAY_API_KEY?.trim() ? "key-not-configured" :
    "ready";
  return { enabled: reason === "ready", reason, model: RESEARCH_AI_MODEL };
}


// Short-lived, unguessable proof minted only from an explicitly enabled local
// server page. A distinct one-time nonce helps prevent token guessing. Tokens
// are NOT gateway API keys and cannot be used with the model provider directly.
export function issueResearchAiPilotToken(): string | null {
  if (!researchAiAvailability().enabled) return null;
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!key) return null;
  const payload = String(Math.floor(Date.now() / 1000)) + "." + randomBytes(12).toString("hex");
  const signature = createHmac("sha256", key)
    .update("vialgrade-ai-local-v1:" + payload).digest("hex");
  return payload + "." + signature;
}
