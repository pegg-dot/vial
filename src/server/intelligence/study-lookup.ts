/**
 * A single study/source-reconciliation workflow, not a general literature
 * search or a clinical evaluation. This does not ingest a visitor's research
 * history, vendor data or any protected paper body. Only the validated NCT ID
 * is sent to the official NIH APIs, with a six-hour Next data cache.
 */
import { normalizeNctId } from "@/lib/nct-identifier";
import { parsePublicRegistryStudy, type PublicRegistryStudy } from "./cagrilintide-study-audit";
import { crossCheckRegistryPublications } from "./pubmed-source-check";

export type StudyLookup =
  | { state: "invalid" | "not-found" | "unavailable"; nctId: string | null; checkedAt: string }
  | { state: "available"; nctId: string; checkedAt: string; study: PublicRegistryStudy };

export async function lookupStudy(value: string): Promise<StudyLookup> {
  const nctId = normalizeNctId(value);
  const checkedAt = new Date().toISOString();
  if (!nctId) return { state: "invalid", nctId: null, checkedAt };
  try {
    const response = await fetch("https://clinicaltrials.gov/api/v2/studies/" + nctId, {
      headers: { accept: "application/json" },
      next: { revalidate: 21_600 },
      signal: AbortSignal.timeout(7_000),
    });
    if (response.status === 404) return { state: "not-found", nctId, checkedAt };
    if (!response.ok) throw new Error("Study service unavailable");
    const size = Number(response.headers.get("content-length"));
    if (Number.isFinite(size) && size > 600_000) throw new Error("Oversized record");
    const raw: unknown = await response.json();
    const study = parsePublicRegistryStudy(raw, nctId);
    if (!study) throw new Error("Registry record did not match the study ID");
    const checks = await crossCheckRegistryPublications(
      study.registryReferences.map(reference => ({ nctId, reference })),
    );
    return { state: "available", nctId, checkedAt, study: { ...study, pubmedChecks: checks } };
  } catch {
    // Errors are not evidence of an absent trial, study result or publication.
    return { state: "unavailable", nctId, checkedAt };
  }
}

export type EvidenceSummary = {
  headline: string;
  detail: string;
  nextQuestion: string;
  linkedPapers: number;
  confirmedLinks: number;
  unverifiedLinks: number;
};

export function summarizeStudyEvidence(study: PublicRegistryStudy): EvidenceSummary {
  const links = study.pubmedChecks;
  const confirmed = links.filter(link => link.secondaryIdMatch === "confirmed" && link.article !== null);
  const unverified = links.filter(link => link.secondaryIdMatch === "unavailable");
  const resultLinked = confirmed.some(link => link.reference.role === "RESULT");
  const info = {
    linkedPapers: study.registryReferences.length,
    confirmedLinks: confirmed.length,
    unverifiedLinks: unverified.length,
  };
  if (study.registryResults === "not-shown" && resultLinked) {
    return {
      ...info,
      headline: "The registry cites a paper labeled RESULT, but has no posted results section.",
      detail: "PubMed independently indexes the cited paper under this exact trial ID. We have confirmed the citation relationship, not independently reviewed the article's findings.",
      nextQuestion: "Read the original publication and compare what it reports against registered outcomes. This is not a finding about legal reporting compliance.",
    };
  }
  if (confirmed.length > 0) {
    return {
      ...info,
      headline: "PubMed indexes " + confirmed.length + " cited publication" + (confirmed.length === 1 ? "" : "s") + " under this trial ID.",
      detail: "The registry and PubMed reference the same NCT ID. A linked publication may be background context rather than a report of trial results.",
      nextQuestion: "Review each paper's original text and its registry citation label before treating it as a result from this study.",
    };
  }
  if (study.registryReferences.length && unverified.length) {
    return {
      ...info,
      headline: "The registry cites a paper, but its PubMed link could not be confirmed right now.",
      detail: "The source may be unavailable or incomplete. We do not count this as a verified match or as an absent paper.",
      nextQuestion: "Open the original source links and verify the NCT identifier manually.",
    };
  }
  if (study.registryReferences.length) {
    return {
      ...info,
      headline: "This trial cites publications, but the exact PubMed study links were not corroborated.",
      detail: "A registry citation may still be relevant even if PubMed does not index this NCT in its trial accession fields.",
      nextQuestion: "Check the paper itself and search other permitted sources for additional studies or publications.",
    };
  }
  return {
    ...info,
    headline: "No PubMed identifiers appear in this trial's inspected registry reference fields.",
    detail: study.registryResults === "present"
      ? "The registry has a results section, but the selected protocol fields do not list a PMID. Papers may exist elsewhere."
      : "This does not mean there are no published papers or results. Only source IDs attached to this registry record were inspected.",
    nextQuestion: "Try the original PubMed or ClinicalTrials.gov searches for publications missing from the registry links.",
  };
}

export function studySourceBrief(lookup: Extract<StudyLookup, { state: "available" }>): string {
  const { study, checkedAt } = lookup;
  const summary = summarizeStudyEvidence(study);
  const lines = [
    "# " + study.nctId + " — VialGrade source check",
    "",
    "Study: " + study.title,
    "Registry: " + study.url,
    "Status: " + (study.status ?? "Not reported"),
    "Registry results section: " + study.registryResults,
    "Last registry update: " + (study.lastRegistryUpdate ?? "Not reported"),
    "Checked by VialGrade: " + checkedAt + " (source responses may be cached up to six hours)",
    "",
    "## What was found",
    summary.headline,
    summary.detail,
    "",
    "## Publications referenced in the official registry",
  ];
  for (const reference of study.registryReferences) {
    const link = study.pubmedChecks.find(item => item.reference.pmid === reference.pmid);
    lines.push("- PMID " + reference.pmid + " | Registry label: " + reference.role +
      " | Exact-NCT crosscheck: " + (link?.secondaryIdMatch ?? "unavailable"),
      "  https://pubmed.ncbi.nlm.nih.gov/" + reference.pmid + "/",
      "  " + (link?.article?.title ?? reference.citation ?? "Publication metadata unavailable"));
  }
  if (!study.registryReferences.length) lines.push("No PMIDs in inspected protocol reference fields; this does not establish that no publications exist.");
  lines.push("", "## Follow-up", summary.nextQuestion,
    "", "## Important scope",
    "Only exact PMIDs already cited in this registry record were cross-checked against PubMed.",
    "A publication link is not proof of efficacy, safety, clinical results, regulatory compliance or permission to sell.",
    "No historical record-version comparison or comprehensive literature search was performed.",
    "No research profile or personal account record was created. Routine hosting/security logs may still record visits.",
  );
  return lines.join("\n");
}
