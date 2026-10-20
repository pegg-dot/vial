import { describe, expect, it } from "vitest";
import {
  isOutOfScopeResearchQuestion, researchAiRequestSchema, researchAiModelOutputSchema,
  ResearchAiEvidenceError, validateAndGroundResearchAiResult,
} from "@/lib/research-ai-contract";
import { researchAiAvailability } from "@/server/intelligence/research-ai-config";

const request = {
  topicId: "publication-matching" as const,
  audience: "researcher" as const,
  question: "Does the article correspond to the exact NCT?",
  consent: true as const,
};

const raw = {
  scope: "limited" as const,
  summary: "The cited clinical paper cannot yet be unambiguously matched to one specific registered study.",
  findings: [
    { claimId: "publication-ambiguity", sourceIds: ["trial-rct-article", "msi-78-study-a"], interpretation: "The bibliographic relationship remains uncertain." },
  ],
  potentialConflicts: [
    { claimId: "publication-ambiguity", issue: "A derived citation alone is not a direct trial-to-paper mapping." },
  ],
  gaps: [{ claimId: "review-misreading", nextCheck: "Inspect whether the review is relevant to a specific reported outcome." }],
  nextSourceIds: ["msi-78-study-a", "trial-rct-article"],
};

function validated(candidate: unknown) {
  return validateAndGroundResearchAiResult({
    request,
    raw: researchAiModelOutputSchema.parse(candidate),
    model: "mock-provider/test",
    evidenceToolCalls: 1,
  });
}

describe("Local AI evidence-only contract", () => {
  it("rejects absent consent and unexpected fields before an external call", () => {
    expect(researchAiRequestSchema.safeParse({ ...request, consent: false }).success).toBe(false);
    expect(researchAiRequestSchema.safeParse({ ...request, extra: "ignored" }).success).toBe(false);
    expect(researchAiRequestSchema.safeParse({ ...request, question: "a".repeat(401) }).success).toBe(false);
    expect(researchAiRequestSchema.safeParse({ ...request, topicId: "any-peptide" }).success).toBe(false);
  });

  it("rejects medical, sourcing and molecule-design requests outside the research file", () => {
    for (const value of ["Where to buy vials?", "What dosage should I inject?", "design a new peptide", "Give me a synthesis protocol", "Tell me about retatrutide"]) {
      expect(isOutOfScopeResearchQuestion(value), value).toBe(true);
    }
    expect(isOutOfScopeResearchQuestion("Which Pexiganan trial lists results?")).toBe(false);
  });

  it("resolves only original source IDs from the same claim; model URLs never enter the reply", () => {
    const result = validated(raw);
    expect(result.kind).toBe("model-proposed-not-expert-reviewed");
    expect(result.sourceSnapshot).toBe("2026-10-19");
    expect(result.findings[0].citations.map(c => c.identifier)).toEqual(["PMID 18990064", "NCT00563394"]);
    expect(result.findings[0].citations[0].url).toBe("https://pubmed.ncbi.nlm.nih.gov/18990064/");
    expect(result.potentialConflicts[0].originalLimit).toMatch(/DERIVED/);
    expect(result.evidenceToolCalls).toBe(1);
    expect(JSON.stringify(result)).not.toContain("not-an-original-source.example");
  });

  it("fails closed for fabricated IDs, cross-topic IDs, wrong source joins and zero actual source-tool retrieval", () => {
    for (const corrupt of [
      { ...raw, findings: [{ ...raw.findings[0], claimId: "fabricated-paper" }] },
      { ...raw, findings: [{ ...raw.findings[0], sourceIds: ["pubchem-pexiganan"] }] },
      { ...raw, findings: [{ ...raw.findings[0], sourceIds: ["onestep-2"] }] },
      { ...raw, nextSourceIds: ["fake"] },
      { ...raw, potentialConflicts: [{ claimId: "review-misreading", issue: "No established contradiction." }] },
      { ...raw, findings: [raw.findings[0], raw.findings[0]] },
    ]) {
      expect(() => validated(corrupt)).toThrow(ResearchAiEvidenceError);
    }
    expect(() => validateAndGroundResearchAiResult({
      request, raw: researchAiModelOutputSchema.parse(raw), model: "mock", evidenceToolCalls: 0,
    })).toThrow(ResearchAiEvidenceError);
  });

  it("is unavailable unless the local release, owner opt-in and actual gateway key all exist", () => {
    expect(researchAiAvailability({}).enabled).toBe(false);
    expect(researchAiAvailability({ VIALGRADE_LOCAL_PREVIEW: "true", VIALGRADE_PUBLIC_EVIDENCE_ONLY: "true" }).reason).toBe("opt-in-required");
    expect(researchAiAvailability({
      VIALGRADE_LOCAL_PREVIEW: "true", VIALGRADE_PUBLIC_EVIDENCE_ONLY: "true", VIALGRADE_RESEARCH_AI_ENABLED: "true",
    }).reason).toBe("key-not-configured");
    expect(researchAiAvailability({
      VIALGRADE_LOCAL_PREVIEW: "true", VIALGRADE_PUBLIC_EVIDENCE_ONLY: "true",
      VIALGRADE_RESEARCH_AI_ENABLED: "true", AI_GATEWAY_API_KEY: "test-only-never-use",
    }).enabled).toBe(true);
    expect(researchAiAvailability({
      VIALGRADE_LOCAL_PREVIEW: "false", VIALGRADE_PUBLIC_EVIDENCE_ONLY: "true",
      VIALGRADE_RESEARCH_AI_ENABLED: "true", AI_GATEWAY_API_KEY: "test-only-never-use",
    }).enabled).toBe(false);
  });
});
