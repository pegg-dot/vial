/**
 * "Organizations on record" for a dossier (Sources layer, step A1).
 *
 * Every row is an organization that an official public registry record names
 * as lead sponsor of one registered study, with the link to that exact record.
 * It is NOT a manufacturer, supplier, licensee or current-owner claim, and it
 * carries no price, stock or "available from" information. Originator and
 * patent-holder records are not held in this file, so none are shown.
 */
import type { ResearchSubject } from "@/lib/research-explorer";
import { PEXIGANAN_RECORDED_ORGANIZATIONS, PEXIGANAN_REVIEW_DATE } from "@/lib/pexiganan-evidence-network";
import { dossierTrialEvidence } from "@/lib/research-dossier-evidence";
import type { StudyLookup } from "@/server/intelligence/study-lookup";

export type OrganizationRow = {
  /** One row per organization per study, so each row has its own source link. */
  key: string;
  organization: string;
  role: "Lead sponsor on the registry record";
  studyId: string;
  sourceUrl: string;
  sourceLabel: string;
  /** Where the sponsor name was read from, and when. */
  basis: string;
};

export type OrganizationsView = {
  rows: OrganizationRow[];
  /** A pinned study exists but its sponsor could not be confirmed on this check. */
  unconfirmed: { studyId: string; sourceUrl: string; reason: "not-checked" | "not-reported" | "unverified" } | null;
};

export const ORGANIZATIONS_LIMITATION =
  "A lead-sponsor field records who the registry names for one study. It does not establish who originated the compound, who makes or holds rights to it today, or any quality of material.";

export function registryStudyUrl(nctId: string): string {
  return "https://clinicaltrials.gov/study/" + nctId;
}

/**
 * Pexiganan comes from the committed, hand-reviewed registry snapshot. Every
 * other subject uses its single pinned study and only shows a sponsor when the
 * same identity guard the dossier already applies has verified that study.
 */
export function organizationsForSubject(subject: ResearchSubject, lookup: StudyLookup | null): OrganizationsView {
  if (subject.slug === "pexiganan") {
    return {
      rows: PEXIGANAN_RECORDED_ORGANIZATIONS.flatMap(org => org.nctIds.map(nctId => ({
        key: org.name + "|" + nctId,
        organization: org.name,
        role: "Lead sponsor on the registry record" as const,
        studyId: nctId,
        sourceUrl: registryStudyUrl(nctId),
        sourceLabel: "ClinicalTrials.gov " + nctId,
        basis: "Registry snapshot reviewed " + PEXIGANAN_REVIEW_DATE,
      }))),
      unconfirmed: null,
    };
  }
  if (!subject.sampleTrial) return { rows: [], unconfirmed: null };
  const studyId = subject.sampleTrial;
  const sourceUrl = registryStudyUrl(studyId);
  if (!lookup) return { rows: [], unconfirmed: { studyId, sourceUrl, reason: "not-checked" } };
  const card = dossierTrialEvidence(subject, lookup);
  if (card.state !== "verified") return { rows: [], unconfirmed: { studyId, sourceUrl, reason: "unverified" } };
  if (!card.sponsor) return { rows: [], unconfirmed: { studyId, sourceUrl: card.registryUrl, reason: "not-reported" } };
  return {
    rows: [{
      key: card.sponsor + "|" + studyId,
      organization: card.sponsor,
      role: "Lead sponsor on the registry record",
      studyId,
      sourceUrl: card.registryUrl,
      sourceLabel: "ClinicalTrials.gov " + studyId,
      basis: "Registry record read " + lookup.checkedAt.slice(0, 10),
    }],
    unconfirmed: null,
  };
}
