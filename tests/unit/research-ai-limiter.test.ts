import { describe, expect, it } from "vitest";
import {
  reserveResearchAiCall,
} from "@/server/intelligence/research-ai-limiter";
import { RESEARCH_AI_MAX_CALLS_PER_PROCESS } from "@/server/intelligence/research-ai-config";

describe("research AI local-only request limiter", () => {
  it("refuses overlapping calls and allows only a bounded number of analysis runs per process", () => {
    expect(RESEARCH_AI_MAX_CALLS_PER_PROCESS).toBe(12);
    const running = reserveResearchAiCall();
    expect(running.ok).toBe(true);
    expect(reserveResearchAiCall()).toEqual({ ok: false, reason: "concurrent" });
    if (running.ok) {
      running.release();
      running.release();
    }

    for (let i = 1; i < RESEARCH_AI_MAX_CALLS_PER_PROCESS; i++) {
      const lease = reserveResearchAiCall();
      expect(lease.ok, "slot " + i).toBe(true);
      if (lease.ok) lease.release();
    }
    expect(reserveResearchAiCall()).toEqual({ ok: false, reason: "budget-reached" });
  });
});
