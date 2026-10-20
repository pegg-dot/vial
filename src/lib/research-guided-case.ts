/**
 * A bounded, source-specific editorial workpaper that answers one legitimate
 * scientific lineage question. Sources are cited by original URL and role,
 * never copied wholesale. No ranking, safety/efficacy endorsement, sourcing
 * or human-use instructions. Independent SME signoff is still required.
 */
export type GuidedResearchSource = {
  id: string;
  label: string;
  type: "molecular-identity" | "original-experiment" | "registered-study" | "secondary-review";
  url: string;
  detail: string;
  limitation: string;
};

export type GuidedResearchObservation = {
  id: string;
  short: string;
  observation: string;
  notEstablished: string;
  sourceIds: readonly string[];
};

export const MAGAININ_PEXIGANAN_CASE = {
  id: "magainin-pexiganan",
  title: "When related peptides are not the same evidence",
  question: "Does a magainin experiment also tell us what happened in a pexiganan clinical trial?",
  shortAnswer: "No. Pexiganan (MSI-78) was designed from the magainin peptide family, but they are separate molecular entities. Original membrane-model experiments and a later registered pexiganan trial answer different questions.",
  subjectSlugs: ["magainin-2", "pexiganan"] as const,
  updatedAt: "2026-10-19",
  sources: [
    {
      id: "magainin-identity",
      label: "Magainin 2 · PubChem CID 16130189",
      type: "molecular-identity",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/16130189",
      detail: "Molecular identity record for magainin 2.",
      limitation: "A compound database entry is not an experiment or an approval.",
    },
    {
      id: "pexiganan-identity",
      label: "Pexiganan · PubChem CID 16132253",
      type: "molecular-identity",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/16132253",
      detail: "Distinct molecular identity record for the synthetic analog.",
      limitation: "The record does not establish batch purity or experimental behavior.",
    },
    {
      id: "bilayer-paper",
      label: "Hallock et al. · Biophysical Journal (2003), PMID 12719236",
      type: "original-experiment",
      url: "https://pubmed.ncbi.nlm.nih.gov/12719236/",
      detail: "Original NMR and calorimetry experiments investigating MSI-78 interactions with model lipid bilayers.",
      limitation: "Experimental membrane behavior is not a clinical effectiveness finding.",
    },
    {
      id: "relationship-review",
      label: "Gottler & Ramamoorthy · Biochimica et Biophysica Acta (2009), PMID 19010301",
      type: "secondary-review",
      url: "https://pubmed.ncbi.nlm.nih.gov/19010301/",
      detail: "Review describes pexiganan as MSI-78, a designed analog of magainin-2.",
      limitation: "The review summarizes earlier literature; it is not an independent clinical result for magainin.",
    },
    {
      id: "registered-trial",
      label: "Pexiganan clinical study · ClinicalTrials.gov NCT01594762",
      type: "registered-study",
      url: "https://clinicaltrials.gov/study/NCT01594762",
      detail: "Registry names topical pexiganan cream as an intervention and clinical response as a primary outcome.",
      limitation: "A study registration does not itself establish treatment success, safety or regulatory approval.",
    },
  ] as const satisfies readonly GuidedResearchSource[],
  observations: [
    {
      id: "molecular-lineage",
      short: "The molecular identities differ",
      observation: "Magainin 2 and pexiganan/MSI-78 have separate PubChem identifiers. The original experimental article and later review describe MSI-78 as a designed magainin-family analog, not as interchangeable natural magainin 2.",
      notEstablished: "Related molecular ancestry does not prove their structures, experimental results or biological behavior are identical.",
      sourceIds: ["magainin-identity", "pexiganan-identity", "bilayer-paper", "relationship-review"],
    },
    {
      id: "experimental-source",
      short: "A primary paper investigated a model membrane",
      observation: "The 2003 paper uses physical measurements on laboratory lipid-bilayer models to study MSI-78 membrane interactions.",
      notEstablished: "Lipid-bilayer experiments do not determine how the molecule performs in human clinical studies.",
      sourceIds: ["bilayer-paper"],
    },
    {
      id: "clinical-context",
      short: "A later trial registered a specific pexiganan formulation",
      observation: "NCT01594762 records topical pexiganan cream as one tested intervention and clinical response as a registered outcome. It does not list natural magainin 2 as that intervention.",
      notEstablished: "The record's existence and outcome definitions alone do not establish the trial's clinical findings or their interpretation.",
      sourceIds: ["registered-trial", "pexiganan-identity"],
    },
  ] as const satisfies readonly GuidedResearchObservation[],
  followUps: [
    "Check exact chemical identity and peptide variant for every experimental report.",
    "Separate original lipid-model experiments from secondary review articles.",
    "Open NCT01594762 and inspect the registered design and posted result section before evaluating the clinical program.",
    "Locate and appraise primary trial publications, compare population and endpoints, and do not transfer evidence across peptide analogs.",
  ] as const,
} as const;

export function guidedCaseSource(id: string): GuidedResearchSource | undefined {
  return MAGAININ_PEXIGANAN_CASE.sources.find(source => source.id === id);
}

export function guidedCaseMarkdown(): string {
  const workpaper = MAGAININ_PEXIGANAN_CASE;
  const lines: string[] = [
    "# VialGrade source workpaper — " + workpaper.title,
    "",
    "Question: " + workpaper.question,
    "Short answer: " + workpaper.shortAnswer,
    "Editorial research review date: " + workpaper.updatedAt,
    "Status: provisional, not independently expert-reviewed.",
    "",
    "## What the evidence actually establishes",
  ];
  for (const observation of workpaper.observations) {
    lines.push("", "### " + observation.short, observation.observation,
      "What it does not establish: " + observation.notEstablished,
      "Sources:");
    for (const id of observation.sourceIds) {
      const source = guidedCaseSource(id);
      if (source) lines.push("- " + source.label + " (" + source.type + "): " + source.url,
        "  Source limitation: " + source.limitation);
    }
  }
  lines.push("", "## Independent follow-up",
    ...workpaper.followUps.map((item, i) => (i + 1) + ". " + item),
    "",
    "## Important limitations",
    "Sources verify separate identities and source-specific research context, not clinical effectiveness.",
    "The presence of registered trial outcomes does not show whether they were achieved.",
    "This workpaper does not reproduce publisher article text or offer experiment protocols, treatment advice, sourcing or purchasing.",
    "No completed expert signoff or user-demand validation is implied.",
  );
  return lines.join("\n");
}
