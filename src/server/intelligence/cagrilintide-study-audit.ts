/**
 * Narrow, source-anchored study-design audit prototype for ONE research task.
 *
 * Deliberately not a clinical conclusion, literature review, drug program
 * coverage estimate, comparison of efficacy, or marketplace recommendation.
 * Four manually pinned public NCT IDs; no user query, profile, DB, paid API,
 * model call, vendor grade, or third-party PDF/full text.
 */
import { classifyTrialAssociation, getResearchIdentityCandidate, type TrialAssociation } from "./topic-identity-candidates";

export const CAGRILINTIDE_AUDIT_SELECTION = [
  {
    nctId: "NCT03856047",
    scope: "direct-name" as const,
    whySelected: "Earlier development-code trial; helps distinguish NNC0174-0833 from unrelated codes.",
  },
  {
    nctId: "NCT04982575",
    scope: "direct-name" as const,
    whySelected: "Registers cagrilintide and semaglutide separately as interventions; comparison needs treatment-context review.",
  },
  {
    nctId: "NCT05804162",
    scope: "direct-name" as const,
    whySelected: "A different registered primary outcome and no results section in the checked source snapshot.",
  },
  {
    nctId: "NCT07564414",
    scope: "combination-name" as const,
    whySelected: "Registry names CagriSema; it cannot automatically be counted as a standalone cagrilintide intervention.",
  },
] as const;

export type RegistryDate = { date: string; precision: "ACTUAL" | "ESTIMATED" | "NOT SPECIFIED" };
export type RegistryOutcome = { measure: string; timeFrame: string | null };
export type CagrilintideStudy = {
  nctId: string;
  title: string;
  url: string;
  sponsor: string | null;
  phase: string | null;
  status: string | null;
  enrollment: { count: number; precision: "ACTUAL" | "ESTIMATED" | "NOT SPECIFIED" } | null;
  primaryCompletion: RegistryDate | null;
  lastRegistryUpdate: string | null;
  interventions: string[];
  primaryOutcomes: RegistryOutcome[];
  primaryOutcomeCount: number;
  registryResults: "present" | "not-shown" | "uncertain";
  matchLocation: TrialAssociation;
};

export type CagrilintideAuditRow =
  | { available: true; selection: (typeof CAGRILINTIDE_AUDIT_SELECTION)[number]; study: CagrilintideStudy }
  | { available: false; selection: (typeof CAGRILINTIDE_AUDIT_SELECTION)[number]; issue: "registry-unavailable" };

export type CagrilintideAudit = {
  assembledAt: string;
  cacheSeconds: number;
  rows: CagrilintideAuditRow[];
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function registryPrecision(value: unknown): RegistryDate["precision"] {
  return value === "ACTUAL" || value === "ESTIMATED" ? value : "NOT SPECIFIED";
}

function verifiedIsoDate(value: unknown): string | null {
  const text = clean(value, 10);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  const checked = new Date(Date.UTC(year, month - 1, day));
  return Number.isFinite(checked.getTime()) && checked.toISOString().slice(0, 10) === text ? text : null;
}

function parseRegistryDate(raw: unknown): RegistryDate | null {
  const value = record(raw);
  const date = verifiedIsoDate(value.date);
  return date ? { date, precision: registryPrecision(value.type) } : null;
}

export function parseCagrilintideStudy(input: unknown, requestedId: string): CagrilintideStudy | null {
  if (!/^NCT\d{8}$/.test(requestedId)) return null;
  const root = record(input);
  const protocol = record(root.protocolSection);
  const identification = record(protocol.identificationModule);
  const nctId = clean(identification.nctId, 16);
  const title = clean(identification.briefTitle, 350);
  if (nctId !== requestedId || !title) return null;

  const status = record(protocol.statusModule);
  const design = record(protocol.designModule);
  const sponsors = record(record(protocol.sponsorCollaboratorsModule).leadSponsor);
  const enrollmentSource = record(design.enrollmentInfo);
  const rawEnrollment = enrollmentSource.count;
  const enrollmentCount = typeof rawEnrollment === "number" && Number.isSafeInteger(rawEnrollment)
    && rawEnrollment >= 0 && rawEnrollment <= 50_000_000 ? rawEnrollment : null;
  const enrollment = enrollmentCount === null ? null : {
    count: enrollmentCount,
    precision: registryPrecision(enrollmentSource.type),
  };
  const phaseValues = Array.isArray(design.phases) ? design.phases : [];
  const phase = phaseValues.map(value => clean(value, 35)).filter((s): s is string => Boolean(s)).slice(0, 2).join(", ") || null;

  const namedInterventions = record(protocol.armsInterventionsModule).interventions;
  const interventions = (Array.isArray(namedInterventions) ? namedInterventions : [])
    .map(value => clean(record(value).name, 150))
    .filter((value): value is string => Boolean(value))
    .slice(0, 12);

  const allOutcomes = record(protocol.outcomesModule).primaryOutcomes;
  const outcomes = (Array.isArray(allOutcomes) ? allOutcomes : [])
    .map(raw => {
      const row = record(raw);
      const measure = clean(row.measure, 250);
      if (!measure) return null;
      return { measure, timeFrame: clean(row.timeFrame, 170) };
    }).filter((item): item is RegistryOutcome => item !== null);
  const registryResults = root.hasResults === true && Object.keys(record(root.resultsSection)).length > 0
    ? "present"
    : root.hasResults === false && Object.keys(record(root.resultsSection)).length === 0
      ? "not-shown"
      : "uncertain";

  const identity = getResearchIdentityCandidate("cagrilintide");
  if (!identity) return null;
  return {
    nctId,
    title,
    url: "https://clinicaltrials.gov/study/" + nctId,
    sponsor: clean(sponsors.name, 125),
    phase,
    status: clean(status.overallStatus, 48),
    enrollment,
    primaryCompletion: parseRegistryDate(status.primaryCompletionDateStruct),
    lastRegistryUpdate: parseRegistryDate(status.lastUpdatePostDateStruct)?.date ?? null,
    interventions,
    primaryOutcomes: outcomes.slice(0, 3),
    primaryOutcomeCount: outcomes.length,
    registryResults,
    matchLocation: classifyTrialAssociation(input, identity),
  };
}

export async function getCagrilintideAudit(): Promise<CagrilintideAudit> {
  const assembledAt = new Date().toISOString();
  const rows = await Promise.all(CAGRILINTIDE_AUDIT_SELECTION.map(async (selection): Promise<CagrilintideAuditRow> => {
    try {
      const response = await fetch("https://clinicaltrials.gov/api/v2/studies/" + selection.nctId, {
        headers: { accept: "application/json" },
        next: { revalidate: 21_600 },
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) throw new Error("Registry response was not available");
      const raw: unknown = await response.json();
      const study = parseCagrilintideStudy(raw, selection.nctId);
      if (!study) throw new Error("Registry ID or record schema did not match");
      return { available: true, selection, study };
    } catch {
      return { available: false, selection, issue: "registry-unavailable" };
    }
  }));
  return { assembledAt, cacheSeconds: 21_600, rows };
}

export function getAuditCounts(audit: CagrilintideAudit) {
  const available = audit.rows.filter(row => row.available);
  const selectedDirect = available.filter(row => row.selection.scope === "direct-name");
  const direct = selectedDirect.filter(row => row.study.matchLocation === "intervention-recorded");
  return {
    selected: audit.rows.length,
    available: available.length,
    unavailable: audit.rows.length - available.length,
    directNamed: direct.length,
    directNameUnconfirmed: selectedDirect.length - direct.length,
    directWithResultsSection: direct.filter(row => row.study.registryResults === "present").length,
    directWithoutResultsSection: direct.filter(row => row.study.registryResults === "not-shown").length,
    directUncertainResults: direct.filter(row => row.study.registryResults === "uncertain").length,
    combinationNameOnly: available.filter(row => row.selection.scope === "combination-name").length,
  };
}

/** A separate primary sponsor statement supports the combination relationship, but
 * does NOT verify every dose, treatment arm, or claim made about any given trial. */
export const CAGRILINTIDE_COMBINATION_SOURCE = {
  url: "https://www.novonordisk.com/news-and-media/news-and-ir-materials/news-details.html?id=916501",
  publisher: "Novo Nordisk (study sponsor)",
  published: "2026-02-23",
  statement: "The sponsor identifies CagriSema as a fixed-dose combination of cagrilintide and semaglutide.",
} as const;

export type AuditInsight = {
  heading: string;
  observation: string;
  interpretationLimit: string;
  sources: { title: string; url: string }[];
};

/** Strictly factual, deterministic source-audit observations; not AI clinical reasoning. */
export function getCagrilintideAuditInsights(audit: CagrilintideAudit): AuditInsight[] {
  const present = audit.rows.filter(row => row.available);
  const direct = present.filter(row => row.selection.scope === "direct-name" && row.study.matchLocation === "intervention-recorded");
  const insights: AuditInsight[] = [];
  const combination = present.find(row => row.selection.scope === "combination-name" &&
    row.study.interventions.some(name => /\bcagrisema\b/i.test(name)) && row.study.matchLocation === "search-hit-only");
  if (combination) insights.push({
    heading: "Ingredient identity differs from the registry intervention label",
    observation: "The sponsor describes CagriSema as a cagrilintide + semaglutide fixed-dose combination. " +
      combination.study.nctId + " names CagriSema in its intervention fields, not standalone cagrilintide.",
    interpretationLimit: "Sponsor-stated composition does not establish that the combination arm and a standalone cagrilintide arm are clinically interchangeable. Verify the trial-specific regimen.",
    sources: [
      { title: "Official study " + combination.study.nctId, url: combination.study.url },
      { title: "Novo Nordisk sponsor statement, 2026-02-23", url: CAGRILINTIDE_COMBINATION_SOURCE.url },
    ],
  });
  const completedWithoutRegistryResults = direct.filter(row =>
    row.study.status === "COMPLETED" && row.study.registryResults === "not-shown");
  if (completedWithoutRegistryResults.length) insights.push({
    heading: "Completed studies needing a results-source check",
    observation: completedWithoutRegistryResults.map(row => row.study.nctId).join(", ") +
      " is recorded as completed, but no registry results section was returned for this source snapshot.",
    interpretationLimit: "This does NOT prove a reporting violation, missing publications, clinical failure, or absence of external results. Check the original registry and other permitted sources.",
    sources: completedWithoutRegistryResults.map(row => ({ title: row.study.nctId, url: row.study.url })),
  });
  const distinctOutcomeRecords = direct.filter(row => Boolean(row.study.primaryOutcomes[0]?.measure));
  const measures = new Set(distinctOutcomeRecords.map(row => row.study.primaryOutcomes[0].measure.toLowerCase()));
  if (distinctOutcomeRecords.length > 1 && measures.size > 1) insights.push({
    heading: "Different primary outcome measures are being compared",
    observation: "The selected direct-name studies register different primary outcome measure texts. " +
      "Their endpoints and time frames must be inspected individually.",
    interpretationLimit: "A difference in registered endpoints is not a contradiction and does not establish relative efficacy, quality or safety.",
    sources: distinctOutcomeRecords.map(row => ({ title: row.study.nctId, url: row.study.url })),
  });
  const futureEstimate = present.find(row => row.study.status === "RECRUITING" &&
    row.study.primaryCompletion?.precision === "ESTIMATED" &&
    row.study.primaryCompletion.date > audit.assembledAt.slice(0, 10));
  if (futureEstimate) insights.push({
    heading: "A dated study milestone is still an estimate",
    observation: futureEstimate.study.nctId + " lists estimated primary completion on " +
      futureEstimate.study.primaryCompletion!.date + ".",
    interpretationLimit: "An estimated completion date is not a promised readout, publication, regulatory milestone or evidence that an outcome occurred.",
    sources: [{ title: futureEstimate.study.nctId, url: futureEstimate.study.url }],
  });
  return insights;
}

/** Source register for analyst handoff. An explanatory audit, not a clinical memo. */
export function cagrilintideAuditMarkdown(audit: CagrilintideAudit): string {
  const out = [
    "# Cagrilintide — selected study metadata audit",
    "",
    "Assembled: " + audit.assembledAt,
    "Scope: four preselected public ClinicalTrials.gov records, NOT a complete program search.",
    "Source responses may be cached up to 6 hours. Assembled time is not the upstream retrieval time.",
    "No earlier version baseline has been collected; no change-in-study claim is possible.",
    "Results-section presence does not establish clinical effectiveness, safety, or regulatory compliance.",
    "",
  ];
  for (const row of audit.rows) {
    out.push("## " + row.selection.nctId + " — " + row.selection.scope);
    if (!row.available) {
      out.push("Source unavailable or unparseable. Do not infer absence of research.", "");
      continue;
    }
    const study = row.study;
    out.push(
      "Title: " + study.title,
      "Source: " + study.url,
      "Source last-update date: " + (study.lastRegistryUpdate ?? "not reported"),
      "Registered status: " + (study.status ?? "not reported"),
      "Phase: " + (study.phase ?? "not reported"),
      "Sponsor: " + (study.sponsor ?? "not reported"),
      "Enrollment: " + (study.enrollment ? study.enrollment.count + " (" + study.enrollment.precision.toLowerCase() + ")" : "not reported"),
      "Primary completion: " + (study.primaryCompletion ? study.primaryCompletion.date + " (" + study.primaryCompletion.precision.toLowerCase() + ")" : "not reported"),
      "Results section in registry response: " + study.registryResults,
      "Recorded interventions: " + (study.interventions.join("; ") || "not reported"),
      "Name location: " + study.matchLocation,
      "Selection rationale: " + row.selection.whySelected,
    );
    if (!study.primaryOutcomeCount) out.push("Primary outcome measures: not available in this record");
    for (const outcome of study.primaryOutcomes) {
      out.push("Primary outcome: " + outcome.measure + (outcome.timeFrame ? " | Time frame: " + outcome.timeFrame : ""));
    }
    if (study.primaryOutcomeCount > study.primaryOutcomes.length) {
      out.push("Additional primary outcomes omitted from this short audit; inspect original record.");
    }
    out.push("");
  }
  out.push("## What this selected metadata flags for verification", "");
  for (const insight of getCagrilintideAuditInsights(audit)) {
    out.push("### " + insight.heading, insight.observation, "Limit: " + insight.interpretationLimit);
    for (const source of insight.sources) out.push("- " + source.title + ": " + source.url);
    out.push("");
  }
  out.push("## Open verification questions",
    "- Are these the right studies for the analyst's actual question, or are relevant trials missing?",
    "- Verify the exact study-specific CagriSema regimen; the sponsor-stated combination ingredients do not establish an identical standalone cagrilintide treatment arm.",
    "- Are the primary outcomes and populations comparable? Do not compare effects from title or enrollment counts.",
    "- Do publications or other repositories hold findings absent from a registry results section?",
    "- What changed over time? Not answerable without two dated, checked versions of the same source.",
    "",
    "The audit feature does not create a research profile or store queries. Routine hosting/security logs may still record visits.");
  return out.join("\n");
}
