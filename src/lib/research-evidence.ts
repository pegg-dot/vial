import type { ResearchDossier } from "@/server/intelligence/public-dossiers";

export type EvidenceItem = {
  id: string;
  kind: "trial" | "publication";
  date: string | null;
  title: string;
  url: string;
  details: string;
  retracted: boolean;
  registryMatch?: "intervention-recorded" | "named-in-title" | "search-hit-only";
};

/** A match location, not an independent study-quality or efficacy assessment. */
export function registryMatchNote(association: "intervention-recorded" | "named-in-title" | "search-hit-only" | undefined): string {
  switch (association) {
    case "intervention-recorded": return "Compound name/code appears in the registered intervention fields (possibly as a comparator)";
    case "named-in-title": return "Compound name/code appears in the study title; intervention role unconfirmed";
    case "search-hit-only": return "Keyword search hit; compound's role is not confirmed";
    default: return "Registry match location not checked";
  }
}

/** Narrow registry metadata filtering, not strength-of-evidence scoring. */
export type RegistryMatchFilter = "all" | "intervention-recorded" | "named-in-title" | "search-hit-only";

export function filterByRegistryMatch(items: EvidenceItem[], match: RegistryMatchFilter): EvidenceItem[] {
  if (match === "all") return items;
  return items.filter(item => item.kind === "trial" && item.registryMatch === match);
}

function displayStatus(text: string): string {
  return text.replaceAll("_", " ").toLowerCase();
}

export function evidenceItems(dossier: ResearchDossier): EvidenceItem[] {
  const trials: EvidenceItem[] = dossier.trials.studies.map(study => ({
    id: study.nctId,
    kind: "trial",
    date: study.lastUpdated,
    title: study.title,
    url: "https://clinicaltrials.gov/study/" + study.nctId,
    details: "Registry status: " + displayStatus(study.status) +
      (study.phase ? " | " + displayStatus(study.phase) : "") +
      (study.resultsReported ? " | registry results section available" : " | results section not reported") +
      " | " + registryMatchNote(study.association),
    retracted: false,
    registryMatch: study.association,
  }));
  const works: EvidenceItem[] = dossier.publications.works.map(work => ({
    id: work.id,
    kind: "publication",
    date: work.published,
    title: work.title,
    url: work.doiUrl ?? work.id,
    details: "Scholarly metadata: " + work.kind.replaceAll("_", " ") +
      (work.venue ? " | " + work.venue : ""),
    retracted: work.retracted,
  }));
  return [...trials, ...works].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? "") || a.id.localeCompare(b.id),
  );
}

export function evidenceCaveats(dossier: ResearchDossier): string[] {
  const list: string[] = [];
  if (dossier.trials.unavailable) list.push("ClinicalTrials.gov was unavailable; missing trial results cannot be interpreted as no studies.");
  if (dossier.publications.unavailable) list.push("OpenAlex was unavailable or rate-limited; no publication total can be inferred.");
  if (!dossier.trials.unavailable && dossier.trials.studies.length === 0) list.push("The fixed trial search returned no sampled records, but other terminology or databases may contain research.");
  if (!dossier.publications.unavailable && dossier.publications.works.length === 0) list.push("The fixed scholarly search returned no sampled records; this does not establish that no relevant papers exist.");
  if (dossier.publications.works.some(w => w.retracted)) list.push("At least one returned OpenAlex record is flagged as retracted. Check its original source and any corrections.");
  list.push("These are small search-result samples, not a systematic literature review or complete trial inventory.");
  list.push("Keyword matches can include incidental mentions, reviews, unrelated indications or other compounds; confirm relevance in the original record.");
  list.push("Intervention-field matches may identify comparators or controls, not just the main investigational treatment.");
  list.push("Trial registration, phase, paper counts and reported sample purity do not establish efficacy, safety, FDA approval or lawful supply.");
  return list;
}

export function citationPack(dossier: ResearchDossier, generatedAt = new Date().toISOString()): string {
  const out = [
    "# VialGrade source register: " + dossier.label,
    "",
    "Generated: " + generatedAt,
    "Scope: public metadata from fixed source searches; not a systematic review.",
    "No patient data, research questions or browsing histories are included.",
    "",
    "## ClinicalTrials.gov",
    dossier.trials.unavailable ? "Source temporarily unavailable; no conclusions drawn." : "Returned source records: " + dossier.trials.studies.length + " (sample, not the total).",
  ];
  for (const trial of dossier.trials.studies) {
    out.push("- " + trial.nctId + " | " + trial.title + " | " +
      (trial.lastUpdated ?? "date not provided") + " | https://clinicaltrials.gov/study/" + trial.nctId +
      " | " + registryMatchNote(trial.association));
  }
  out.push("", "## OpenAlex (scholarly metadata)");
  out.push(dossier.publications.unavailable ? "Source temporarily unavailable; no conclusions drawn." : "Returned source records: " + dossier.publications.works.length + " (sample, not the total).");
  for (const work of dossier.publications.works) {
    out.push("- " + work.title + " | " + (work.published ?? "date not provided") +
      " | " + (work.doiUrl ?? work.id) + (work.retracted ? " | RETRACTION FLAG" : ""));
  }
  out.push("", "## Interpretation limits", ...evidenceCaveats(dossier).map(s => "- " + s));
  out.push("", "This is a research source list, not purchasing, treatment, investment or regulatory advice.");
  return out.join("\n");
}
