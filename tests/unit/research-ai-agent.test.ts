import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { runResearchAiAgent } from "@/server/intelligence/research-ai-agent";

const usage = {
  inputTokens: { total: 35, noCache: 35, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 50, text: 50, reasoning: undefined },
};
const request = {
  topicId: "publication-matching" as const,
  audience: "analyst" as const,
  question: "Which exact study does the 2008 trial paper report?",
  consent: true as const,
};
const answer = JSON.stringify({
  scope: "limited",
  summary: "The source record does not conclusively assign the 2008 randomized trial paper to exactly one NCT.",
  findings: [{
    claimId: "publication-ambiguity",
    sourceIds: ["trial-rct-article", "msi-78-study-a"],
    interpretation: "The exact mapping still needs original protocol reconciliation.",
  }],
  potentialConflicts: [{
    claimId: "publication-ambiguity",
    issue: "The DERIVED citation relationship does not establish a one-to-one trial match.",
  }],
  gaps: [{
    claimId: "publication-ambiguity",
    nextCheck: "Compare the full article methods with both NCT registration protocols.",
  }],
  nextSourceIds: ["trial-rct-article", "msi-78-study-a"],
});

describe("Real AI SDK tool-loop with a zero-cost mock provider", () => {
  it("forces an evidence tool lookup before accepting a model-proposed interpretation", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [
        {
          content: [{
            type: "tool-call", toolCallId: "source-tool-1",
            toolName: "loadDeskEvidence", input: '{"topicId":"publication-matching"}',
          }],
          finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [],
        },
        {
          content: [{ type: "text", text: answer }],
          finishReason: { unified: "stop", raw: undefined }, usage, warnings: [],
        },
      ],
    });
    const data = await runResearchAiAgent(request, { model });
    expect(data.model).toBe("test-model");
    expect(data.evidenceToolCalls).toBe(1);
    expect(data.findings[0].citations.map(item => item.identifier)).toContain("PMID 18990064");
    expect(data.potentialConflicts).toHaveLength(1);
    expect(data.kind).toBe("model-proposed-not-expert-reviewed");
  });

  it("refuses a fluent AI answer that skipped its required evidence lookup", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: answer }],
        finishReason: { unified: "stop", raw: undefined }, usage, warnings: [],
      }),
    });
    await expect(runResearchAiAgent(request, { model })).rejects.toThrow();
  });
});
