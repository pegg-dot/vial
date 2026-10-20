/**
 * Pexiganan evidence-network PILOT: explicitly selected original identifiers.
 *
 * Editorial snapshot obtained from public NIH/PubChem APIs on 2026-10-19.
 * Source records are not articles' full text. These connections do NOT
 * establish study results, material safety, batch provenance, or a purchase
 * recommendation. Never merge a related analog into this molecule's claims.
 */

export const PEXIGANAN_NETWORK_VERSION = "pexiganan-evidence-passport-v1";
export const PEXIGANAN_REVIEW_DATE = "2026-10-19";

export type PexSourceKind = "compound" | "registry" | "original-experiment" | "secondary-review" | "clinical-paper";

export type PexEvidenceSource = {
  id: string;
  identifier: string;
  label: string;
  publisher: string;
  url: string;
  kind: PexSourceKind;
  observation: string;
  limitation: string;
  subject: "pexiganan" | "magainin-2" | "both";
};

export const PEXIGANAN_SOURCES: readonly PexEvidenceSource[] = [
  {
    id: "pubchem-pexiganan",
    identifier: "CID 16132253",
    label: "Pexiganan · distinct compound identity",
    publisher: "PubChem / NIH",
    url: "https://pubchem.ncbi.nlm.nih.gov/compound/16132253",
    kind: "compound",
    observation: "PubChem lists Pexiganan as compound CID 16132253.",
    limitation: "A compound ID says nothing about clinical efficacy, lawful distribution or quality of an actual sample.",
    subject: "pexiganan",
  },
  {
    id: "pubchem-magainin",
    identifier: "CID 16130189",
    label: "Magainin 2 · related but different molecule",
    publisher: "PubChem / NIH",
    url: "https://pubchem.ncbi.nlm.nih.gov/compound/16130189",
    kind: "compound",
    observation: "PubChem lists the source-family peptide Magainin 2 separately under CID 16130189.",
    limitation: "Results for pexiganan should not be inherited by Magainin 2, or vice versa.",
    subject: "magainin-2",
  },
  {
    id: "primary-bilayer",
    identifier: "PMID 12719236",
    label: "MSI-78 membrane experiment · 2003",
    publisher: "PubMed / Biophysical Journal",
    url: "https://pubmed.ncbi.nlm.nih.gov/12719236/",
    kind: "original-experiment",
    observation: "The original 2003 research article investigates MSI-78 (pexiganan) and model lipid bilayer structure.",
    limitation: "Laboratory membrane-model findings are not outcomes from a clinical study.",
    subject: "pexiganan",
  },
  {
    id: "mechanism-review",
    identifier: "PMID 19010301",
    label: "Pexiganan and magainin relationship · 2009",
    publisher: "PubMed / Biochimica et Biophysica Acta",
    url: "https://pubmed.ncbi.nlm.nih.gov/19010301/",
    kind: "secondary-review",
    observation: "PubMed categorizes the article connecting pexiganan, MSI-78 and magainin as a review.",
    limitation: "This is a secondary discussion of experimental work, not an additional independent experiment or trial result.",
    subject: "both",
  },
  {
    id: "trial-rct-article",
    identifier: "PMID 18990064",
    label: "Topical pexiganan vs systemic therapy · 2008 article",
    publisher: "PubMed / Clinical Infectious Diseases",
    url: "https://pubmed.ncbi.nlm.nih.gov/18990064/",
    kind: "clinical-paper",
    observation: "PubMed classifies this article as a randomized controlled trial. The two older MSI-78 registry records cite this PMID as DERIVED.",
    limitation: "The checked PubMed identifier list did not supply an exact NCT association. Registry citation and topical similarity do not alone establish which registered study's outcomes the paper reports.",
    subject: "pexiganan",
  },
  {
    id: "later-review",
    identifier: "PMID 36781451",
    label: "Antimicrobial peptide design review · 2023",
    publisher: "PubMed / Amino Acids",
    url: "https://pubmed.ncbi.nlm.nih.gov/36781451/",
    kind: "secondary-review",
    observation: "NCT01594762 lists this PMID with role DERIVED; PubMed classifies it as a review.",
    limitation: "DERIVED is the registry's bibliography label. A review article is not the study's primary clinical results report.",
    subject: "pexiganan",
  },
  {
    id: "onestep-2",
    identifier: "NCT01594762",
    label: "Pexiganan trial · OneStep-2",
    publisher: "ClinicalTrials.gov / NIH",
    url: "https://clinicaltrials.gov/study/NCT01594762",
    kind: "registry",
    observation: "Phase 3 registry record names topical pexiganan cream 0.8%, has a posted results section, and lists Dipexium Pharmaceuticals, Inc. as lead sponsor.",
    limitation: "A posted results section is not a conclusion that treatment succeeded; interpretation requires detailed outcome review.",
    subject: "pexiganan",
  },
  {
    id: "onestep-1",
    identifier: "NCT01590758",
    label: "Pexiganan trial · OneStep companion registry",
    publisher: "ClinicalTrials.gov / NIH",
    url: "https://clinicaltrials.gov/study/NCT01590758",
    kind: "registry",
    observation: "Phase 3 registry record names topical pexiganan cream 0.8%, has a posted results section, and lists Dipexium Pharmaceuticals, Inc. as lead sponsor.",
    limitation: "Similar titles do not make two NCT numbers duplicate studies or justify combining results.",
    subject: "pexiganan",
  },
  {
    id: "msi-78-study-a",
    identifier: "NCT00563394",
    label: "MSI-78 vs ofloxacin · first selected registry",
    publisher: "ClinicalTrials.gov / NIH",
    url: "https://clinicaltrials.gov/study/NCT00563394",
    kind: "registry",
    observation: "Registry names MSI-78 as an intervention and Abeona Therapeutics, Inc as the recorded lead sponsor; no registry results section is posted in the checked record.",
    limitation: "No posted results does not mean no outcomes exist or establish missing legally required reporting.",
    subject: "pexiganan",
  },
  {
    id: "msi-78-study-b",
    identifier: "NCT00563433",
    label: "MSI-78 vs ofloxacin · second selected registry",
    publisher: "ClinicalTrials.gov / NIH",
    url: "https://clinicaltrials.gov/study/NCT00563433",
    kind: "registry",
    observation: "Registry names MSI-78 and ofloxacin as interventions and Abeona Therapeutics, Inc as recorded lead sponsor; no registry results section is posted in the checked record.",
    limitation: "The historical sponsor label is a registry attribution, not proof of current ownership or marketing authorization.",
    subject: "pexiganan",
  },
] as const;

export type EvidenceAssessment = "directly-recorded" | "cross-source-checked" | "needs-interpretation";

export type PexEvidenceClaim = {
  id: string;
  heading: string;
  finding: string;
  status: EvidenceAssessment;
  whatItDoesNotShow: string;
  sourceIds: readonly string[];
  reviewTask: string;
};

export const PEXIGANAN_CLAIMS: readonly PexEvidenceClaim[] = [
  {
    id: "identity",
    heading: "Pexiganan and Magainin 2 are distinct molecular entries",
    finding: "PubChem returns different compound identifiers. The relationship review describes pexiganan as a designed magainin-family analog.",
    status: "cross-source-checked",
    whatItDoesNotShow: "The biological results of one molecule do not automatically transfer to the other.",
    sourceIds: ["pubchem-pexiganan", "pubchem-magainin", "mechanism-review"],
    reviewTask: "Confirm the precise molecular analog or preparation named in any new study.",
  },
  {
    id: "original-experiment",
    heading: "An original MSI-78 experiment studied artificial membranes",
    finding: "The original 2003 paper investigates MSI-78 interactions with a model lipid-bilayer system.",
    status: "directly-recorded",
    whatItDoesNotShow: "It does not directly establish efficacy or safety in people.",
    sourceIds: ["primary-bilayer"],
    reviewTask: "Read the paper methods and decide whether its physical model is relevant to your research question.",
  },
  {
    id: "registered-program",
    heading: "Two named pexiganan cream registry records report results sections",
    finding: "NCT01594762 and NCT01590758 name pexiganan cream in their intervention fields; each currently has a posted registry results section in the checked source snapshot.",
    status: "directly-recorded",
    whatItDoesNotShow: "Registration and posted results are not an independent assessment of outcome statistics or a regulatory authorization.",
    sourceIds: ["onestep-2", "onestep-1"],
    reviewTask: "Inspect each trial's actual numerical primary outcome, population, comparator and analysis plan separately.",
  },
  {
    id: "early-program",
    heading: "Two older registry records name MSI-78 and ofloxacin",
    finding: "NCT00563394 and NCT00563433 list MSI-78 as a named intervention; both list ofloxacin and do not have a posted results section in the checked registry response.",
    status: "directly-recorded",
    whatItDoesNotShow: "A missing results section alone cannot prove that there are no scientific findings or that any reporting law was broken.",
    sourceIds: ["msi-78-study-a", "msi-78-study-b"],
    reviewTask: "Check whether a publication reports results from either exact NCT; do not match by subject alone.",
  },
  {
    id: "publication-ambiguity",
    heading: "A cited RCT article is not automatically matched to one NCT",
    finding: "The older registries cite PMID 18990064 with bibliography role DERIVED. PubMed calls it a randomized controlled trial, but the inspected PubMed record has no exact NCT identifier.",
    status: "needs-interpretation",
    whatItDoesNotShow: "A DERIVED label and similar paper topic are not enough to assign an article's outcomes to a specific trial.",
    sourceIds: ["msi-78-study-a", "msi-78-study-b", "trial-rct-article"],
    reviewTask: "Manually reconcile trial protocol, publication methods, dates and population before claiming exact registry-to-paper equivalence.",
  },
  {
    id: "review-misreading",
    heading: "The later DERIVED citation is a review, not a results paper",
    finding: "NCT01594762 cites PMID 36781451 as DERIVED; PubMed classifies that 2023 paper as a review of peptide design.",
    status: "cross-source-checked",
    whatItDoesNotShow: "A DERIVED bibliography link does not demonstrate the study's results, nor prove a discrepancy or misconduct.",
    sourceIds: ["onestep-2", "later-review"],
    reviewTask: "Use the actual posted trial results and a methodologically relevant primary paper rather than treating this review as the trial's outcome.",
  },
] as const;

export type PexTrialSelection = { nctId: string; sourceId: string; relationship: string };
export const PEXIGANAN_TRIAL_SELECTION: readonly PexTrialSelection[] = [
  { nctId: "NCT01594762", sourceId: "onestep-2", relationship: "Pexiganan cream named in intervention field" },
  { nctId: "NCT01590758", sourceId: "onestep-1", relationship: "Pexiganan cream named in intervention field" },
  { nctId: "NCT00563394", sourceId: "msi-78-study-a", relationship: "MSI-78 named in intervention field" },
  { nctId: "NCT00563433", sourceId: "msi-78-study-b", relationship: "MSI-78 named in intervention field" },
] as const;

export const PEXIGANAN_RECORDED_ORGANIZATIONS = [
  {
    name: "Dipexium Pharmaceuticals, Inc.",
    recordRole: "Lead sponsor recorded in two pexiganan-cream registries",
    nctIds: ["NCT01594762", "NCT01590758"],
  },
  {
    name: "Abeona Therapeutics, Inc",
    recordRole: "Lead sponsor recorded in two older MSI-78 registries",
    nctIds: ["NCT00563394", "NCT00563433"],
  },
] as const;

export function pexSourceById(id: string): PexEvidenceSource | undefined {
  return PEXIGANAN_SOURCES.find(source => source.id === id);
}

export function pexSourceByIdentifier(input: string): PexEvidenceSource | null {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, " ");
  if (cleaned.length > 80 || cleaned.length < 5) return null;
  const canonical = cleaned.match(/^(?:NCT\d{8}|(?:PMID|CID)\s?\d{1,10}|\d{5,10})$/)
    ? cleaned.replace(/\s/g, "")
    : null;
  if (!canonical) return null;
  return PEXIGANAN_SOURCES.find(source => source.identifier.toUpperCase().replace(/\s/g, "") === canonical
    || source.identifier.replace(/\D/g, "") === canonical) ?? null;
}

export function pexEvidencePassportMarkdown(): string {
  const lines = [
    "# VialGrade · Pexiganan research evidence passport",
    "",
    "Method: " + PEXIGANAN_NETWORK_VERSION,
    "Editorial source check: " + PEXIGANAN_REVIEW_DATE,
    "Scope: original source records and evidence relationships, not a quality/purity, medical, clinical-effectiveness, purchasing or investment score.",
    "Sources can change; open the links before using an observation.",
  ];
  for (const claim of PEXIGANAN_CLAIMS) {
    lines.push("", "## " + claim.heading, "",
      "Source relationship: " + claim.status, "",
      claim.finding, "",
      "Does not establish: " + claim.whatItDoesNotShow, "",
      "Next check: " + claim.reviewTask, "",
      "Original records:");
    for (const id of claim.sourceIds) {
      const source = pexSourceById(id);
      if (source) lines.push("- " + source.identifier + " | " + source.label + " | " + source.url,
        "  Limitation: " + source.limitation);
    }
  }
  lines.push("", "## Verification boundaries",
    "Record dates and named sponsors come from the official registry, not independently verified current corporate affiliations.",
    "No batch, COA, testing laboratory, vendor, procurement availability or human-use status has been verified here.",
    "No protected article text has been reproduced; bibliography/metadata alone do not validate clinical conclusions.",
    "Editorial review is provisional, not independently reviewed by a qualified clinical methodologist.");
  return lines.join("\n");
}
