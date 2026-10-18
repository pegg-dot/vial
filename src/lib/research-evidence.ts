import type { ResearchDossier } from "@/server/intelligence/public-dossiers";

export type EvidenceItem = {
  id: string;
  kind: "trial" | "publication";
  date: string | null;
  title: string;
  url: string;
  details: string;
  retracted: boolean;
};

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
      (study.resultsReported ? " | registry results section available" : " | results section not reported"),
    retracted: false,
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
      (trial.lastUpdated ?? "date not provided") + " | https://clinicaltrials.gov/study/" + trial.nctId);
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
