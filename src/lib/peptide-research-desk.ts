/**
 * Local-only, source-bound research desk. The model-facing context is built
 * exclusively from the editorially pinned, inspectable evidence register.
 * No LLM calls, arbitrary retrieval, uploaded materials, procurement or
 * clinical conclusions are made by this module.
 */
import {
  PEXIGANAN_CLAIMS, PEXIGANAN_RECORDED_ORGANIZATIONS, PEXIGANAN_REVIEW_DATE, pexSourceById,
  type PexEvidenceClaim, type PexEvidenceSource,
} from "@/lib/pexiganan-evidence-network";
import { RESEARCH_SUBJECTS } from "@/lib/research-explorer";

export type DeskAudience = "researcher" | "analyst";
export type DeskTopicId = "identity" | "clinical-trials" | "publication-matching" | "organizations";

export type DeskTopic = {
  id: DeskTopicId;
  label: string;
  question: string;
  description: string;
  claimIds: readonly string[];
  focus: Record<DeskAudience, string>;
};

export const DESK_TOPICS: readonly DeskTopic[] = [
  {
    id: "identity",
    label: "Identity & mechanism",
    question: "What evidence distinguishes pexiganan from Magainin 2?",
    description: "Trace the related molecules without transferring conclusions between them.",
    claimIds: ["identity", "original-experiment"],
    focus: {
      researcher: "Review exact sequence, experimental model and membrane conditions before comparing mechanisms.",
      analyst: "Distinguish the historical peptide family from the specific development asset and its evidence.",
    },
  },
  {
    id: "clinical-trials",
    label: "Clinical program",
    question: "Which pexiganan trials have registered results, and what remains unknown?",
    description: "See original NIH registry records without guessing that posted results mean success.",
    claimIds: ["registered-program", "early-program"],
    focus: {
      researcher: "Inspect primary outcomes, populations, comparators and numerical results for each NCT separately.",
      analyst: "Map the recorded studies and program timeline without claiming efficacy or regulatory approval.",
    },
  },
  {
    id: "publication-matching",
    label: "Paper & trial matching",
    question: "Does a cited publication report the outcome of a specific registered trial?",
    description: "Distinguish a review from an RCT and unresolved NCT-to-PMID associations.",
    claimIds: ["publication-ambiguity", "review-misreading"],
    focus: {
      researcher: "Check manuscript methods, protocol IDs and registry metadata before assigning any outcome.",
      analyst: "Avoid false program milestones caused by assuming every citation proves a clinical trial result.",
    },
  },
  {
    id: "organizations",
    label: "Sponsor history",
    question: "Which organizations are named in pexiganan registry records?",
    description: "Connect historical sponsor fields to their exact source, not to current ownership.",
    claimIds: ["registered-program", "early-program"],
    focus: {
      researcher: "Confirm the recorded lead-sponsor field for each NCT and note study-level limitations.",
      analyst: "Treat sponsor names as historical registry attributions. Verify current ownership and deals elsewhere.",
    },
  },
] as const;

export function deskTopicById(id: string): DeskTopic | undefined {
  return DESK_TOPICS.find(topic => topic.id === id);
}

export function deskClaims(topicId: DeskTopicId): PexEvidenceClaim[] {
  const topic = deskTopicById(topicId);
  if (!topic) return [];
  return topic.claimIds.flatMap(id => {
    const found = PEXIGANAN_CLAIMS.find(claim => claim.id === id);
    return found ? [found] : [];
  });
}

export function deskSources(topicId: DeskTopicId): PexEvidenceSource[] {
  const found = new Map<string, PexEvidenceSource>();
  for (const claim of deskClaims(topicId)) {
    for (const sourceId of claim.sourceIds) {
      const source = pexSourceById(sourceId);
      if (source) found.set(source.id, source);
    }
  }
  return [...found.values()];
}

/** Sponsor attributions are the one thing the Sponsor-history question adds to the clinical program. */
export function deskSponsors(topicId: DeskTopicId): typeof PEXIGANAN_RECORDED_ORGANIZATIONS | readonly [] {
  return topicId === "organizations" ? PEXIGANAN_RECORDED_ORGANIZATIONS : [];
}

export type QuestionCoverage =
  | { state: "pinned" }
  | { state: "own-wording" }
  | { state: "other-compound"; names: string[] };

const COVERED_SLUGS = new Set(["pexiganan"]);
const COVERED_TERMS = ["pexiganan", "msi-78", "msi78", "magainin"];

/**
 * The Desk cannot retrieve evidence for new wording. This reports, deterministically,
 * whether typed text is just the pinned question or a different one, and whether it
 * names a compound whose evidence is not connected here. It never scores relevance.
 */
export function questionCoverage(topicId: DeskTopicId, question: string): QuestionCoverage {
  const text = question.trim().toLowerCase();
  const topic = deskTopicById(topicId);
  if (!text || (topic && text === topic.question.toLowerCase())) return { state: "pinned" };
  const mentions = (term: string) => new RegExp("(^|[^a-z0-9])" + term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)").test(text);
  const others = RESEARCH_SUBJECTS
    .filter(subject => !COVERED_SLUGS.has(subject.slug) && [subject.name, ...subject.alternativeNames].some(mentions))
    .map(subject => subject.name);
  if (others.length > 0 && !COVERED_TERMS.some(mentions)) return { state: "other-compound", names: others };
  return { state: "own-wording" };
}

export function coverageNote(coverage: QuestionCoverage): string {
  switch (coverage.state) {
    case "pinned": return "The question is the pinned one; the observations below were written for it.";
    case "own-wording": return "Your wording is carried into the brief as written. VialGrade did not search for new evidence for it; the observations below are the fixed set for the selected question.";
    case "other-compound": return "Your wording names " + coverage.names.join(", ") + ", which has no connected evidence on the Research Desk. The observations below are about Pexiganan only and do not answer it.";
  }
}

export type DeskBriefRequest = {
  topicId: DeskTopicId;
  audience: DeskAudience;
  question?: string;
};

export function buildDeskBrief(request: DeskBriefRequest): string {
  const topic = deskTopicById(request.topicId);
  if (!topic) throw new Error("Unknown desk topic");
  const claims = deskClaims(topic.id);
  const sources = deskSources(topic.id);
  const question = (request.question ?? "").trim().slice(0, 500) || topic.question;
  return [
    "# VialGrade | Source-grounded research briefing packet",
    "",
    "Prepared from editorial source snapshot: " + PEXIGANAN_REVIEW_DATE,
    "Subject: Pexiganan (MSI-78); Magainin 2 is a separate compound.",
    "Perspective: " + request.audience,
    "Research question: " + question.replace(/\r?\n/g, " "),
    "Question coverage: " + coverageNote(questionCoverage(topic.id, request.question ?? "")),
    "Scope: Limited pinned primary identifiers, registry fields and bibliographic metadata. NOT a systematic review, efficacy judgment, verified synthesis plan, vendor recommendation or patent/FTO opinion.",
    "AI status: No model analysis was executed. The following records are fixed editorial source observations, not an AI-authenticated conclusion.",
    "Sources may have changed since the editorial snapshot. Reopen the original records.",
    "",
    "## Editorial research focus",
    topic.focus[request.audience],
    "",
    "## Direct source-linked observations",
    ...claims.flatMap(claim => [
      "",
      "### " + claim.heading,
      "Evidence status: " + claim.status,
      "Observation: " + claim.finding,
      "Does NOT establish: " + claim.whatItDoesNotShow,
      "Next original-source check: " + claim.reviewTask,
      "Source IDs: " + claim.sourceIds.map(id => pexSourceById(id)?.identifier ?? "UNKNOWN").join(", "),
    ]),
    "",
    ...(deskSponsors(topic.id).length === 0 ? [] : [
      "",
      "## Sponsors named in the registry records (historical attribution, not current ownership)",
      ...deskSponsors(topic.id).map(org => "- " + org.name + " | " + org.recordRole + " | " + org.nctIds.join(", ")),
    ]),
    "",
    "## Exact original-source register",
    ...sources.flatMap(source => [
      "- " + source.identifier + " | " + source.publisher + " | " + source.url,
      "  Role: " + source.kind + "; identity: " + source.subject + "; limitation: " + source.limitation,
    ]),
    "",
    "## Claims that require independent expert review",
    "- No outcome statistic has been adjudicated for clinical efficacy or safety.",
    "- A DERIVED trial bibliography label is not proof of NCT-to-publication equivalence.",
    "- A molecule ID is not evidence of a verified research sample, lot or laboratory COA.",
    "- Historical sponsor names are not a current ownership, patent or transaction history.",
    "",
    "## Instructions for optional AI-assisted review",
    "Act as an evidence assistant, not a drug designer. Use only the source IDs and observations above unless separately provided original material is independently verified. Distinguish direct observations from inferences. Do not invent numerical results, patent freedom-to-operate, manufacturing instructions, supplier availability or clinical advice. List uncertainties and explain which original source a qualified reviewer must open next. If the packet cannot answer the question, say so.",
  ].join("\n");
}
