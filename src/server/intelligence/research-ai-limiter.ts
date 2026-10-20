/**
 * Single-machine localhost safeguard ONLY. Not a distributed rate limiter.
 * Production work would require authenticated users and durable quotas.
 * No identities, IPs, prompts, queries or model outputs are recorded.
 */
import { RESEARCH_AI_MAX_CALLS_PER_PROCESS } from "@/server/intelligence/research-ai-config";

let active = 0;
let attempted = 0;

export type ResearchAiLease =
  | { ok: true; release(): void }
  | { ok: false; reason: "concurrent" | "budget-reached" };

export function reserveResearchAiCall(): ResearchAiLease {
  if (active > 0) return { ok: false, reason: "concurrent" };
  if (attempted >= RESEARCH_AI_MAX_CALLS_PER_PROCESS) return { ok: false, reason: "budget-reached" };
  active += 1;
  attempted += 1;
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
    },
  };
}
