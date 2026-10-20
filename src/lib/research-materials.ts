/**
 * Research-material due diligence (read-only pilot).
 *
 * Do NOT import seller/COA data from the retired commerce database. A company
 * describing a QC process is not proof of independent accreditation, a genuine
 * certificate, an in-stock molecule, or the properties of a specific vial.
 * No report is uploaded and no material review is saved to a server.
 */
import { researchSubjectBySlug } from "@/lib/research-explorer";

export const MATERIAL_REVIEW_DATE = "2026-10-19";

export const MATERIAL_EVIDENCE_REQUIREMENTS = [
  {
    id: "identity",
    title: "Exact molecular identity",
    question: "Does the reported sequence, analog, modification and salt/form match the intended research subject?",
    detail: "A PubChem identity reference is not a test of the supplied material.",
  },
  {
    id: "lot",
    title: "One lot, one report",
    question: "Do the physical sample and original analytical report carry exactly the same lot identifier?",
    detail: "A typed match alone is not evidence that either record is genuine.",
  },
  {
    id: "issuer",
    title: "Confirm the report with its issuer",
    question: "Can the laboratory or original issuer authenticate this exact report directly?",
    detail: "A copied PDF, QR image or supplier logo cannot independently authenticate a certificate.",
  },
  {
    id: "methods",
    title: "Inspect analytical scope",
    question: "Are methods, sample preparation, instrument results, specifications and uncertainty suitable for the research question?",
    detail: "An HPLC area percentage or MS mass alone cannot establish every material quality attribute.",
  },
  {
    id: "custody",
    title: "Follow sample provenance",
    question: "Is collection, custody and the relationship between tested and received material documented?",
    detail: "Testing one sample does not establish all lots or all later products from the same company.",
  },
] as const;

export type MaterialEvidenceRequirementId = (typeof MATERIAL_EVIDENCE_REQUIREMENTS)[number]["id"];

export type ProviderSource = {
  title: string;
  url: string;
  observed: string;
  scope: "company-authored";
};

export type ResearchProvider = {
  slug: string;
  name: string;
  category: string;
  summary: string;
  publishedMethod: string;
  importantLimit: string;
  sources: readonly ProviderSource[];
};

export const RESEARCH_PROVIDER_RECORDS: readonly ResearchProvider[] = [
  {
    slug: "bachem",
    name: "Bachem",
    category: "Peptide developer and manufacturer",
    summary: "Publicly describes custom peptide synthesis, analytical testing and project documentation for research and development.",
    publishedMethod: "Bachem describes HPLC and mass-spectrometry methods and an analytical data sheet as part of its custom-synthesis documentation.",
    importantLimit: "These first-party process statements have not been independently audited by VialGrade. No Bachem sample, lot, report, accreditation scope, or availability for any indexed subject has been authenticated.",
    sources: [
      { title: "Custom peptide synthesis · QC and documentation", url: "https://www.bachem.com/custom-peptide-synthesis-services/", observed: MATERIAL_REVIEW_DATE, scope: "company-authored" },
      { title: "Analytical capabilities · techniques described by Bachem", url: "https://www.bachem.com/analytical-capabilities/", observed: MATERIAL_REVIEW_DATE, scope: "company-authored" },
      { title: "Quality and regulatory · company-published records", url: "https://www.bachem.com/quality-and-regulatory/", observed: MATERIAL_REVIEW_DATE, scope: "company-authored" },
    ],
  },
  {
    slug: "genscript",
    name: "GenScript",
    category: "Custom peptide synthesis and analysis",
    summary: "Publishes a quality-control overview describing mass-spectrometry and HPLC reporting for custom peptide synthesis.",
    publishedMethod: "GenScript describes MS, HPLC and COA documentation in its own peptide quality-control guide.",
    importantLimit: "The statements are self-published; VialGrade has not confirmed issuer authenticity, independently audited its QC performance, authenticated a specific lot or linked this provider to an indexed molecule.",
    sources: [
      { title: "Peptide quality control · reading QC reports", url: "https://www.genscript.com/peptide_quality.html", observed: MATERIAL_REVIEW_DATE, scope: "company-authored" },
      { title: "Custom peptide services · provider description", url: "https://www.genscript.com/peptide-services.html", observed: MATERIAL_REVIEW_DATE, scope: "company-authored" },
    ],
  },
] as const;

export function researchProviderBySlug(slug: string): ResearchProvider | undefined {
  return RESEARCH_PROVIDER_RECORDS.find(provider => provider.slug === slug);
}

export function researchMaterialHref(subjectSlug: string): string | null {
  return researchSubjectBySlug(subjectSlug)
    ? "/intelligence/materials?subject=" + encodeURIComponent(subjectSlug)
    : null;
}

export type LotMatch = "no-lot-data" | "report-lot-missing" | "sample-lot-missing" | "literal-match" | "conflict";

export function evaluateLotMatch(sampleLot: string, reportLot: string): LotMatch {
  const a = sampleLot.trim();
  const b = reportLot.trim();
  if (!a && !b) return "no-lot-data";
  if (!a) return "sample-lot-missing";
  if (!b) return "report-lot-missing";
  // Deliberately do not erase hyphens, spaces, prefixes or suffixes.
  // Distinct identifiers must never be merged by a loose normalization.
  return a === b ? "literal-match" : "conflict";
}

export function isSafeResearchSourceUrl(input: string): boolean {
  try {
    const value = new URL(input);
    return value.protocol === "https:" && Boolean(value.hostname) &&
      !value.username && !value.password &&
      !["localhost", "127.0.0.1", "::1"].includes(value.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export type MaterialReviewDraft = {
  subjectSlug: string;
  sampleLabel: string;
  sampleLot: string;
  reportLot: string;
  reportIssuer: string;
  reportUrl: string;
  reviewerNote: string;
};

export function materialReviewWorkpaper(draft: MaterialReviewDraft, date = MATERIAL_REVIEW_DATE): string {
  const subject = researchSubjectBySlug(draft.subjectSlug);
  if (!subject) throw new Error("Unknown research identity");
  const lot = evaluateLotMatch(draft.sampleLot, draft.reportLot);
  const rows = [
    "# VialGrade | Provisional research-material workpaper",
    "",
    "Prepared: " + date,
    "Status: UNVERIFIED — local note only; not an authentication, purity grade, product recommendation or procurement record.",
    "Research identity: " + subject.name,
    "Identity source: " + subject.referenceUrl,
    "Identity limitation: " + subject.identityCaveat,
    "",
    "## Unverified material observations",
    "Material label (entered by reviewer): " + (draft.sampleLabel.trim() || "Not provided"),
    "Sample lot as entered: " + (draft.sampleLot.trim() || "Not provided"),
    "Report lot as entered: " + (draft.reportLot.trim() || "Not provided"),
    "Literal lot comparison: " + lot,
    "Reported issuer (not authenticated): " + (draft.reportIssuer.trim() || "Not provided"),
    "Report URL provided by reviewer: " + (isSafeResearchSourceUrl(draft.reportUrl.trim()) ? draft.reportUrl.trim() : "Not provided or not valid HTTPS"),
    "Reviewer's observation (unverified): " + (draft.reviewerNote.trim() || "None"),
    "",
    "## Evidence still needed (not verified by the worksheet)",
    ...MATERIAL_EVIDENCE_REQUIREMENTS.map((check, i) => String(i + 1) + ". " + check.title + ": " + check.question),
    "",
    "A matching typed lot string alone is not confirmation of sample identity, report authenticity, laboratory accreditation, custody, experimental suitability, safety, efficacy or permitted use.",
    "The scientific research-file grade, if present elsewhere in VialGrade, does not measure this material.",
  ];
  return rows.join("\n");
}
