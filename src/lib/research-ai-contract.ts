/**
 * A deliberately narrow shared API contract for the local VialGrade AI analyst.
 *
 * Model-proposed prose is NEVER certified research evidence. Only the server
 * may resolve claim and source IDs into factual, linkable original records.
 */
import { z } from "zod";
import {
  DESK_TOPICS, deskClaims, deskSources,
  type DeskAudience, type DeskTopicId,
} from "@/lib/peptide-research-desk";
import { PEXIGANAN_REVIEW_DATE } from "@/lib/pexiganan-evidence-network";

const deskTopics = ["identity", "clinical-trials", "publication-matching", "organizations"] as const;

export const researchAiRequestSchema = z.strictObject({
  topicId: z.enum(deskTopics),
  audience: z.enum(["researcher", "analyst"]),
  question: z.string().trim().max(400),
  consent: z.literal(true),
});

export type ResearchAiRequest = z.infer<typeof researchAiRequestSchema>;

export const researchAiModelOutputSchema = z.strictObject({
  scope: z.enum(["limited", "insufficient"]).describe(
    "limited if the pinned evidence addresses some part of the question, otherwise insufficient",
  ),
  summary: z.string().min(18).max(640).describe(
    "Cautious short AI interpretation using ONLY the chosen evidence packet. No new experimental outcomes.",
  ),
  findings: z.array(z.strictObject({
    claimId: z.string().min(2).max(80),
    sourceIds: z.array(z.string().min(2).max(80)).min(1).max(4),
    interpretation: z.string().min(12).max(380),
  })).min(1).max(3),
  potentialConflicts: z.array(z.strictObject({
    claimId: z.string().min(2).max(80),
    issue: z.string().min(12).max(340),
  })).max(2).describe(
    "Only for a claim already labeled needs-interpretation. Never invent contradicting outcome data.",
  ),
  gaps: z.array(z.strictObject({
    claimId: z.string().min(2).max(80),
    nextCheck: z.string().min(12).max(320),
  })).max(4),
  nextSourceIds: z.array(z.string().min(2).max(80)).max(6),
});

export type ResearchAiModelOutput = z.infer<typeof researchAiModelOutputSchema>;

export type ResearchAiSource = {
  id: string;
  identifier: string;
  url: string;
  publisher: string;
  kind: string;
  limitation: string;
};
export type ResearchAiFinding = {
  claimId: string;
  heading: string;
  originalObservation: string;
  originalLimit: string;
  originalStatus: string;
  aiInterpretation: string;
  citations: ResearchAiSource[];
};
export type ResearchAiIssue = { claimId: string; originalLimit: string; aiNote: string };

export type ResearchAiResult = {
  kind: "model-proposed-not-expert-reviewed";
  subject: "pexiganan";
  topicId: DeskTopicId;
  audience: DeskAudience;
  model: string;
  sourceSnapshot: string;
  scope: "limited" | "insufficient";
  modelSummary: string;
  findings: ResearchAiFinding[];
  potentialConflicts: ResearchAiIssue[];
  gaps: ResearchAiIssue[];
  nextSources: ResearchAiSource[];
  evidenceToolCalls: number;
  boundaries: string[];
};

export class ResearchAiEvidenceError extends Error {
  constructor() {
    super("Model references did not match VialGrade's selected evidence record.");
    this.name = "ResearchAiEvidenceError";
  }
}

const prohibitedTask = /\b(?:dosage|dose\s+(?:me|my)|inject(?:ion|ing)?|self.administ(?:er|ration)|purchase|buy\s+(?:peptides?|vials?)|where\s+(?:can\s+i\s+)?buy\b|where\s+to\s+buy|synthesis\s+(?:steps|protocol|instructions)|manufactur(?:ing|e)\s+(?:recipe|instructions)|design\s+(?:a|me)\s+(?:new\s+)?peptide|modify\s+the\s+sequence)\b/i;

export function isOutOfScopeResearchQuestion(question: string): boolean {
  if (prohibitedTask.test(question)) return true;
  // Do not pretend this one-subject pilot covers a different compound's study history.
  const differentSubjects = /\b(?:semaglutide|tirzepatide|retatrutide|cagrilintide|bpc[-\s]?157|tb[-\s]?500|ipamorelin|tesamorelin)\b/i;
  return differentSubjects.test(question);
}

function sourceToPublic(source: ReturnType<typeof deskSources>[number]): ResearchAiSource {
  return {
    id: source.id,
    identifier: source.identifier,
    url: source.url,
    publisher: source.publisher,
    kind: source.kind,
    limitation: source.limitation,
  };
}

/** Fails closed on every wrong or cross-topic citation, not only bad syntax. */
export function validateAndGroundResearchAiResult(input: {
  request: ResearchAiRequest;
  raw: ResearchAiModelOutput;
  model: string;
  evidenceToolCalls: number;
}): ResearchAiResult {
  const request = researchAiRequestSchema.parse(input.request);
  const raw = researchAiModelOutputSchema.parse(input.raw);
  if (!DESK_TOPICS.some(item => item.id === request.topicId) || input.evidenceToolCalls < 1) {
    throw new ResearchAiEvidenceError();
  }
  const claims = new Map(deskClaims(request.topicId).map(claim => [claim.id, claim]));
  const sources = new Map(deskSources(request.topicId).map(source => [source.id, source]));
  const seen = new Set<string>();

  const findings: ResearchAiFinding[] = raw.findings.map(proposed => {
    const claim = claims.get(proposed.claimId);
    if (!claim || seen.has(proposed.claimId) || new Set(proposed.sourceIds).size !== proposed.sourceIds.length) {
      throw new ResearchAiEvidenceError();
    }
    seen.add(proposed.claimId);
    const citations = proposed.sourceIds.map(sourceId => {
      if (!claim.sourceIds.includes(sourceId) || !sources.has(sourceId)) throw new ResearchAiEvidenceError();
      return sourceToPublic(sources.get(sourceId)!);
    });
    return {
      claimId: claim.id,
      heading: claim.heading,
      originalObservation: claim.finding,
      originalLimit: claim.whatItDoesNotShow,
      originalStatus: claim.status,
      aiInterpretation: proposed.interpretation,
      citations,
    };
  });

  const issues = (items: { claimId: string; [k: string]: string }[], field: "issue" | "nextCheck", requireUnresolved: boolean) =>
    items.map(item => {
      const claim = claims.get(item.claimId);
      if (!claim || (requireUnresolved && claim.status !== "needs-interpretation")) {
        throw new ResearchAiEvidenceError();
      }
      return { claimId: claim.id, originalLimit: claim.whatItDoesNotShow, aiNote: item[field] };
    });

  const nextSources = raw.nextSourceIds.map(id => {
    const source = sources.get(id);
    if (!source) throw new ResearchAiEvidenceError();
    return sourceToPublic(source);
  });
  if (new Set(raw.nextSourceIds).size !== raw.nextSourceIds.length) throw new ResearchAiEvidenceError();

  return {
    kind: "model-proposed-not-expert-reviewed",
    subject: "pexiganan",
    topicId: request.topicId,
    audience: request.audience,
    model: input.model,
    sourceSnapshot: PEXIGANAN_REVIEW_DATE,
    scope: raw.scope,
    modelSummary: raw.summary,
    findings,
    potentialConflicts: issues(raw.potentialConflicts, "issue", true),
    gaps: issues(raw.gaps, "nextCheck", false),
    nextSources,
    evidenceToolCalls: input.evidenceToolCalls,
    boundaries: [
      "AI interpretation is NOT scientifically or clinically verified. Open the exact original records.",
      "These source pointers are a curated October 19, 2026 snapshot, not a live full-paper review.",
      "A citation to a source record does not validate unsupported claims about outcomes, safety, supply, patents or manufacturing.",
    ],
  };
}
