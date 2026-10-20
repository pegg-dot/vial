/**
 * A presentation-only, fail-closed projection of official NCT source fields.
 * The server fetcher remains study-lookup.ts: only one pinned, validated NCT
 * record and up to eight registry-cited PubMed identifiers are inspected.
 *
 * This is NOT an evidence-of-benefit rating, a full literature review,
 * a drug supply listing, or a clinical interpretation.
 */
import type { ResearchSubject } from "@/lib/research-explorer";
import type { StudyLookup } from "@/server/intelligence/study-lookup";
import type { RegistryReferenceRole } from "@/server/intelligence/pubmed-source-check";

export type TrialEvidenceCard = {
  state: "verified";
  subject: string;
  nctId: string;
  registryUrl: string;
  studyTitle: string;
  checkedAt: string;
  recordUpdatedAt: string | null;
  status: string | null;
  phase: string | null;
  sponsor: string | null;
  enrollment: { count: number; kind: "ACTUAL" | "ESTIMATED" | "NOT SPECIFIED" } | null;
  outcomeMeasures: readonly string[];
  totalOutcomeMeasures: number;
  hasRegistryResults: "present" | "not-shown" | "uncertain";
  citations: readonly {
    pmid: string;
    registryRole: RegistryReferenceRole;
    pubmedTitle: string | null;
    exactNct: "confirmed" | "not-corroborated" | "unavailable";
    url: string;
  }[];
  confirmedPubmedLinks: number;
};

export type TrialEvidencePreview =
  | TrialEvidenceCard
  | { state: "unavailable"; subject: string; nctId: string; registryUrl: string; checkedAt: string }
  | { state: "identity-not-verified"; subject: string; nctId: string; registryUrl: string; checkedAt: string };

function tokenMatch(label: string, term: string): boolean {
  const normalizedLabel = label.toLowerCase();
  const normalizedTerm = term.toLowerCase();
  const position = normalizedLabel.indexOf(normalizedTerm);
  if (position < 0) return false;
  const left = position === 0 || !/[a-z0-9]/.test(normalizedLabel[position - 1] ?? "");
  const after = position + normalizedTerm.length;
  const right = after >= normalizedLabel.length || !/[a-z0-9]/.test(normalizedLabel[after] ?? "");
  return left && right;
}

export function dossierTrialEvidence(
  subject: ResearchSubject,
  lookup: StudyLookup,
): TrialEvidencePreview {
  if (!subject.sampleTrial) throw new Error("A dossier source preview must use a pinned example study");
  const nctId = subject.sampleTrial;
  const base = {
    subject: subject.name,
    nctId,
    registryUrl: "https://clinicaltrials.gov/study/" + nctId,
    checkedAt: lookup.checkedAt,
  };
  if (lookup.state !== "available") return { ...base, state: "unavailable" };

  if (lookup.nctId !== nctId || lookup.study.nctId !== nctId ||
    !lookup.study.interventions.some(label => tokenMatch(label, subject.name))) {
    // An amended trial record could remove an intervention, or a
    // provider record could mismatch an expected compound. Never silently
    // show it as verified evidence belonging to this compound.
    return { ...base, state: "identity-not-verified" };
  }

  const citations = lookup.study.registryReferences.map(reference => {
    const indexed = lookup.study.pubmedChecks.find(check => check.nctId === nctId && check.reference.pmid === reference.pmid);
    return {
      pmid: reference.pmid,
      registryRole: reference.role,
      pubmedTitle: indexed?.article?.title ?? null,
      exactNct: indexed?.secondaryIdMatch ?? "unavailable" as const,
      url: "https://pubmed.ncbi.nlm.nih.gov/" + reference.pmid + "/",
    };
  });

  return {
    ...base,
    state: "verified",
    registryUrl: lookup.study.url,
    studyTitle: lookup.study.title,
    recordUpdatedAt: lookup.study.lastRegistryUpdate,
    status: lookup.study.status,
    phase: lookup.study.phase,
    sponsor: lookup.study.sponsor,
    enrollment: lookup.study.enrollment ? {
      count: lookup.study.enrollment.count,
      kind: lookup.study.enrollment.precision,
    } : null,
    outcomeMeasures: lookup.study.primaryOutcomes.map(item => item.measure).slice(0, 3),
    totalOutcomeMeasures: lookup.study.primaryOutcomeCount,
    hasRegistryResults: lookup.study.registryResults,
    citations,
    confirmedPubmedLinks: citations.filter(item => item.exactNct === "confirmed").length,
  };
}

/** Export raw field observations and source relationships without conclusions. */
export function dossierTrialWorkpaper(card: TrialEvidenceCard): string {
  const lines = [
    "# " + card.subject + " — Selected clinical-trial source workpaper",
    "",
    "Study: " + card.nctId + " — " + card.studyTitle,
    "Original registry: " + card.registryUrl,
    "Registered status: " + (card.status ?? "not reported"),
    "Phase: " + (card.phase ?? "not reported"),
    "Sponsor: " + (card.sponsor ?? "not reported"),
    "Registry results section: " + card.hasRegistryResults,
    "Registered primary outcomes (excerpt of fields):",
    ...card.outcomeMeasures.map(x => "- " + x),
    "Total registered primary outcome measures: " + card.totalOutcomeMeasures,
    "Source record posted update: " + (card.recordUpdatedAt ?? "unavailable"),
    "Checked by VialGrade: " + card.checkedAt + " (source responses may be cached up to six hours)",
    "",
    "## PubMed identifiers cited in registry",
  ];
  if (card.citations.length === 0) lines.push("No PMIDs were in the inspected reference fields. This does NOT establish that no papers exist.");
  for (const ref of card.citations) {
    lines.push("- PMID " + ref.pmid + ", registry role " + ref.registryRole +
      ", exact NCT indexing: " + ref.exactNct,
      "  " + ref.url,
      "  " + (ref.pubmedTitle ?? "Paper title not independently retrieved"));
  }
  lines.push("",
    "## Interpretation limits",
    "This is one selected registry record, not an exhaustive compound study index.",
    "An intervention-name match is not chemical structure verification or human-use approval.",
    "A registry results section is not proof of a favorable finding.",
    "A paper cited under BACKGROUND or DERIVED does not necessarily report primary trial results.",
    "Exact PubMed NCT linkage is a bibliographic relationship, not an independent review of the article's findings.",
    "Different studies may have incompatible populations, endpoints or designs and must not be compared as if randomized head-to-head.",
    "No clinical efficacy, safety, sourcing, investment, or regulatory-compliance conclusion is generated.",
  );
  return lines.join("\n");
}
