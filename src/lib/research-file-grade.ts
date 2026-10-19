/**
 * VialGrade source-file audit, NOT a grade of a peptide's effectiveness,
 * safety, biological interest, material quality, or investment merit.
 *
 * Deliberately mirrors the original vendor-grade design discipline:
 * one explainable label, decomposed evidence checks and NO grade when
 * the underlying entity's precise identity cannot be resolved here.
 *
 * The entire pilot corpus is hand curated. A source LINK is not evidence
 * that the linked study or article's conclusions were independently reviewed.
 */
import type { ResearchSubject } from "@/lib/research-explorer";

export const FILE_GRADE_METHOD_VERSION = "research-file-coverage-v1";
export const FILE_GRADE_CURATION_DATE = "2026-10-19";
export const FILE_GRADE_LIMITS = "This letter describes ONLY source types individually anchored in this VialGrade starter file. It is not scientific evidence certainty, peptide effectiveness or safety, research importance, regulatory status, or suitability for purchase.";

export type FileGradeLetter = "A" | "B" | "C" | null;
export type FileCheckState = "linked" | "qualified" | "not-reviewed";
export type FileCheckKey = "molecule" | "selected-trial" | "original-experiment";

export type FileGradeCheck = {
  key: FileCheckKey;
  label: string;
  state: FileCheckState;
  finding: string;
  limitation: string;
  href: string | null;
  linkLabel: string | null;
};

export type ResearchFileGrade = {
  letter: FileGradeLetter;
  linkedCount: number;
  totalChecks: 3;
  headline: string;
  reviewQuestion: string;
  checks: readonly FileGradeCheck[];
  methodVersion: typeof FILE_GRADE_METHOD_VERSION;
  curatedAt: typeof FILE_GRADE_CURATION_DATE;
};

type OriginalPaper = {
  href: string;
  label: string;
  finding: string;
  limitation: string;
};

/** Explicitly adjudicated original experiments directly about the subject,
 * not PubMed search-result counts, cited reviews, or a related molecule's papers. */
const REVIEWED_ORIGINAL_PAPERS: Readonly<Record<string, OriginalPaper>> = {
  pexiganan: {
    href: "https://pubmed.ncbi.nlm.nih.gov/12719236/",
    label: "Original model-membrane study · PMID 12719236",
    finding: "A specific published primary experiment investigated MSI-78 (pexiganan) with model lipid bilayers.",
    limitation: "A lipid-bilayer experiment is not a clinical trial outcome or efficacy assessment.",
  },
};

/** A PubChem SID is not a CID; a generic variant-family CID is not an
 * independent match to a claimed exact natural-peptide variant. */
const IDENTITY_QUALIFICATIONS: Readonly<Record<string, string>> = {
  retatrutide: "The curated PubChem reference is a substance SID rather than an unambiguous primary compound CID. Variant and salt identity remain to be reviewed.",
  "nisin-a": "The linked compound record is generic nisin and does not establish the specific nisin A variant identity.",
};

export function gradeResearchFile(subject: ResearchSubject): ResearchFileGrade {
  const qualification = IDENTITY_QUALIFICATIONS[subject.slug];
  const identity: FileGradeCheck = {
    key: "molecule",
    label: "Molecular reference",
    state: qualification ? "qualified" : "linked",
    finding: qualification ?? "An individually selected PubChem compound identity record is linked.",
    limitation: qualification
      ? "An unresolved structure or variant identity prevents assigning a file letter."
      : "A molecular database reference does not establish experimental properties or batch identity.",
    href: subject.referenceUrl,
    linkLabel: "Open identity record",
  };

  const trial: FileGradeCheck = subject.sampleTrial
    ? {
      key: "selected-trial",
      label: "Named registry intervention",
      state: "linked",
      finding: "A selected ClinicalTrials.gov record, " + subject.sampleTrial + ", previously named " + subject.name + " in its intervention field.",
      limitation: "Only one selected study was checked. This does not establish all clinical programs, current study status, results or benefit. Open the live source to reconfirm.",
      href: "https://clinicaltrials.gov/study/" + subject.sampleTrial,
      linkLabel: "Open selected trial",
    }
    : {
      key: "selected-trial",
      label: "Named registry intervention",
      state: "not-reviewed",
      finding: "No intervention-matched trial has been individually pinned to this VialGrade starter file.",
      limitation: "Not checked here is NOT the same as no trial exists.",
      href: null,
      linkLabel: null,
    };

  const paper = REVIEWED_ORIGINAL_PAPERS[subject.slug];
  const experiment: FileGradeCheck = paper
    ? {
      key: "original-experiment",
      label: "Specific original experiment",
      state: "linked",
      finding: paper.finding,
      limitation: paper.limitation,
      href: paper.href,
      linkLabel: paper.label,
    }
    : {
      key: "original-experiment",
      label: "Specific original experiment",
      state: "not-reviewed",
      finding: "No individual primary experimental article has been linked and checked for this exact subject in this starter file.",
      limitation: "This is a gap in VialGrade's current file, not proof that original scientific literature is missing.",
      href: null,
      linkLabel: null,
    };

  const checks: FileGradeCheck[] = [identity, trial, experiment];
  const linkedCount = checks.filter(check => check.state === "linked").length;
  // No file letter when a specific molecular identity cannot yet be established.
  const letter: FileGradeLetter = qualification ? null : linkedCount === 3 ? "A" : linkedCount === 2 ? "B" : "C";
  return {
    letter,
    linkedCount,
    totalChecks: 3,
    headline: qualification
      ? "Molecular identity requires review"
      : linkedCount === 3
        ? "Three source layers linked here"
        : linkedCount === 2
          ? "Molecular identity and one trial linked"
          : "Molecular identity linked; additional original sources not yet checked here",
    reviewQuestion: subject.nextReview,
    checks,
    methodVersion: FILE_GRADE_METHOD_VERSION,
    curatedAt: FILE_GRADE_CURATION_DATE,
  };
}

/** Comparison-safe ordering about DOCUMENTATION OF THIS FILE only. */
export function sortSubjectsByFileCoverage<T extends ResearchSubject>(subjects: readonly T[]): T[] {
  return [...subjects].sort((a, b) => {
    const aa = gradeResearchFile(a), bb = gradeResearchFile(b);
    if (aa.letter === null && bb.letter !== null) return 1;
    if (bb.letter === null && aa.letter !== null) return -1;
    return bb.linkedCount - aa.linkedCount || a.name.localeCompare(b.name);
  });
}
