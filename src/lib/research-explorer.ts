/**
 * VialGrade Research Explorer: hand-reviewed editorial starter set.
 *
 * This is NOT the legacy retailer/vendor compound catalog. None of these
 * records contains availability, grade, price, supplier, sourcing advice,
 * human-consumption guidance, or an efficacy ranking.
 *
 * Molecular links were checked against PubChem's public records on
 * 2026-10-18. The PubMed and registry links are search ENTRY POINTS, not
 * assertions that any specific search result proves a claim. Trial examples
 * were checked against official ClinicalTrials.gov intervention fields.
 *
 * No material from legacy person-linked searches or vendor claims is imported.
 */
export type ResearchThemeId = "metabolic" | "host-defense" | "neuropeptides" | "constrained";
export type ExplorerAudience = "researcher" | "analyst";

export type ResearchTheme = {
  id: ResearchThemeId;
  name: string;
  short: string;
  description: string;
  color: string;
  tint: string;
  symbol: string;
};

export type ResearchSubject = {
  slug: string;
  name: string;
  alternativeNames: readonly string[];
  theme: ResearchThemeId;
  family: string;
  identity: string;
  identityCaveat: string;
  referenceLabel: string;
  referenceUrl: string;
  pubmedTerm: string;
  registryTerm: string;
  mechanism: string;
  studyQuestion: string;
  scientistAngle: string;
  analystAngle: string;
  nextReview: string;
  sampleTrial?: string;
  legacyTopic?: "cagrilintide" | "retatrutide" | "tirzepatide";
};

export const RESEARCH_THEMES: readonly ResearchTheme[] = [
  {
    id: "metabolic", name: "Metabolic signaling", short: "Metabolic",
    description: "Peptide analogs studied for interactions with GLP-1, GIP, glucagon and amylin pathways.",
    color: "#4f46a2", tint: "#f0edff", symbol: "◌",
  },
  {
    id: "host-defense", name: "Host defense & antimicrobials", short: "Host defense",
    description: "Peptide–membrane interactions, microbial growth and sequence-dependent experimental behavior.",
    color: "#187c77", tint: "#e7f6f0", symbol: "✳",
  },
  {
    id: "neuropeptides", name: "Neuropeptide signaling", short: "Neuropeptides",
    description: "Endogenous peptide signaling, receptor selectivity and physiological feedback mechanisms.",
    color: "#9d5a2b", tint: "#fff3e8", symbol: "≈",
  },
  {
    id: "constrained", name: "Constrained peptides & structure", short: "Constrained",
    description: "Macrocycles, disulfide-rich scaffolds and molecular recognition.",
    color: "#2d6caa", tint: "#eaf4ff", symbol: "⌬",
  },
] as const;

export const RESEARCH_SUBJECTS: readonly ResearchSubject[] = [
  {
    slug: "semaglutide", name: "Semaglutide", alternativeNames: ["GLP-1 analog"],
    theme: "metabolic", family: "GLP-1 receptor peptide analog",
    identity: "Acylated GLP-1 receptor agonist peptide analog.",
    identityCaveat: "Study designs, formulation names and registered endpoints must be kept separate; a named intervention does not establish a particular outcome.",
    referenceLabel: "PubChem compound · CID 56843331", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/56843331",
    pubmedTerm: "semaglutide", registryTerm: "semaglutide",
    mechanism: "GLP-1 receptor signaling",
    studyQuestion: "How do endpoint definitions and recruited populations differ across registered semaglutide programs?",
    scientistAngle: "Compare receptor mechanism, study eligibility and prespecified outcomes across original trial records.",
    analystAngle: "Trace which trial and population supports a specific public development claim; avoid cross-program comparisons without matching endpoints.",
    nextReview: "Check trial NCT03548935 and its original protocol and posted results separately.",
    sampleTrial: "NCT03548935",
  },
  {
    slug: "tirzepatide", name: "Tirzepatide", alternativeNames: ["LY3298176", "GIP/GLP-1 analog"],
    theme: "metabolic", family: "Dual GIP and GLP-1 receptor agonist",
    identity: "Synthetic peptide developed to engage both GIP and GLP-1 receptors.",
    identityCaveat: "Name-based PubChem searches can return several structures or forms. The cited canonical record is CID 156588324; do not automatically merge alternate CIDs.",
    referenceLabel: "PubChem compound · CID 156588324", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/156588324",
    pubmedTerm: "tirzepatide", registryTerm: "tirzepatide",
    mechanism: "GIP and GLP-1 receptor signaling",
    studyQuestion: "What changes when two incretin receptors are investigated instead of one?",
    scientistAngle: "Review target selection and trial comparator arms without assuming reported endpoints are equivalent.",
    analystAngle: "Trace the sponsor program and original trial evidence behind differentiated dual-receptor claims.",
    nextReview: "Use NCT02759107 to inspect the recorded interventions and compare protocol references with actual papers.",
    sampleTrial: "NCT02759107", legacyTopic: "tirzepatide",
  },
  {
    slug: "retatrutide", name: "Retatrutide", alternativeNames: ["LY3437943", "LY-3437943"],
    theme: "metabolic", family: "Investigational multi-receptor peptide analog",
    identity: "Investigational peptide studied for GIP, GLP-1 and glucagon receptor activity.",
    identityCaveat: "PubChem's retatrutide name currently has a reference collection SID, not a main compound CID. Do not substitute its sodium salt structure or an impurity as an identical record.",
    referenceLabel: "PubChem reference · SID 528343961 (no CID)", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/substance/528343961",
    pubmedTerm: "retatrutide", registryTerm: "retatrutide",
    mechanism: "GIP, GLP-1 and glucagon receptor pathways",
    studyQuestion: "Which results support each proposed contribution of multi-receptor engagement?",
    scientistAngle: "Distinguish mechanism hypotheses from direct trial outcomes and confirm each studied molecular form.",
    analystAngle: "Map public program claims to the exact registered study, its comparator and outcome definitions.",
    nextReview: "Start with trial NCT05929079 and compare the primary outcome fields with any linked publications.",
    sampleTrial: "NCT05929079", legacyTopic: "retatrutide",
  },
  {
    slug: "cagrilintide", name: "Cagrilintide", alternativeNames: ["NNC0174-0833", "amylin analog"],
    theme: "metabolic", family: "Long-acting amylin analog",
    identity: "Amylin-pathway peptide analog investigated in clinical research.",
    identityCaveat: "Standalone cagrilintide and CagriSema combination studies cannot be treated as identical interventions. Registry alias and comparator fields require review.",
    referenceLabel: "PubChem compound · CID 171397054", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/171397054",
    pubmedTerm: "cagrilintide", registryTerm: "cagrilintide",
    mechanism: "Amylin receptor signaling",
    studyQuestion: "How does registered study context differ between a standalone peptide and a combination program?",
    scientistAngle: "Compare interventions, comparator arms, and registered physiological endpoints.",
    analystAngle: "Avoid merging the timelines or findings of standalone and combination clinical programs.",
    nextReview: "Study NCT05804162 shows why a registry results section and a trial-linked published paper should be checked separately.",
    sampleTrial: "NCT05804162", legacyTopic: "cagrilintide",
  },
  {
    slug: "ll-37", name: "LL-37", alternativeNames: ["cathelicidin LL-37", "ropocamptide"],
    theme: "host-defense", family: "Human cathelicidin-derived peptide",
    identity: "A 37-residue peptide associated with human cathelicidin host-defense biology.",
    identityCaveat: "The free peptide, parent protein, synthetic analogs and different salt forms are not interchangeable research materials.",
    referenceLabel: "PubChem compound · CID 16198951", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/16198951",
    pubmedTerm: "\"LL-37\" cathelicidin", registryTerm: "LL-37",
    mechanism: "Host-defense peptide and membrane interactions",
    studyQuestion: "How do experimental conditions influence reported antimicrobial or host-response findings?",
    scientistAngle: "Check strain, assay type and membrane model before comparing experimental claims.",
    analystAngle: "Distinguish fundamental host-defense research from a defined translational drug program.",
    nextReview: "Inspect source-specific activity assays and exact peptide identity before drawing comparisons.",
  },
  {
    slug: "magainin-2", name: "Magainin 2", alternativeNames: ["magainin II"],
    theme: "host-defense", family: "Amphibian-derived antimicrobial peptide",
    identity: "Antimicrobial peptide originally studied in amphibian host-defense systems.",
    identityCaveat: "Magainin 1, magainin 2 and designed analogs such as pexiganan are distinct sequences.",
    referenceLabel: "PubChem compound · CID 16130189", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/16130189",
    pubmedTerm: "\"magainin 2\"", registryTerm: "magainin",
    mechanism: "Peptide–membrane interactions",
    studyQuestion: "What can different membrane systems reveal about selectivity and assay limitations?",
    scientistAngle: "Compare sequence, model membrane and microbial species before interpreting reported activity.",
    analystAngle: "Use the historical research lineage to understand which findings apply to a derivative rather than the original peptide.",
    nextReview: "Compare the molecular references for magainin 2 and pexiganan before assigning shared findings.",
  },
  {
    slug: "pexiganan", name: "Pexiganan", alternativeNames: ["MSI-78"],
    theme: "host-defense", family: "Synthetic magainin-derived peptide",
    identity: "Synthetic antimicrobial peptide analog related to magainin research.",
    identityCaveat: "Pexiganan is not identical to natural magainin 2. Clinical intervention records may describe formulations whose results should not transfer across materials.",
    referenceLabel: "PubChem compound · CID 16132253", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/16132253",
    pubmedTerm: "pexiganan", registryTerm: "pexiganan",
    mechanism: "Membrane-associated antimicrobial peptide activity",
    studyQuestion: "Which features of a designed analog alter experimental behavior relative to its source peptide?",
    scientistAngle: "Verify exact analog identity, comparator conditions and the study design before generalizing laboratory data.",
    analystAngle: "Review program history and trial evidence separately from preclinical claims about magainin.",
    nextReview: "Official trial NCT01594762 names pexiganan in the intervention field; examine design and results separately.",
    sampleTrial: "NCT01594762",
  },
  {
    slug: "nisin-a", name: "Nisin A", alternativeNames: ["nisin", "lantibiotic"],
    theme: "host-defense", family: "Lantibiotic bacteriocin",
    identity: "A ribosomally produced antimicrobial peptide studied for its modified residues and lipid-II interactions.",
    identityCaveat: "Nisin A, other nisin variants and commercial nisin preparations may differ. The linked PubChem entry is a nisin identity reference, not a purity or variant certificate.",
    referenceLabel: "PubChem Nisin reference · CID 16129667 (variant not resolved)", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/16129667",
    pubmedTerm: "\"nisin A\" bacteriocin", registryTerm: "nisin",
    mechanism: "Lantibiotic membrane and lipid-II interactions",
    studyQuestion: "How do sequence modifications and growth conditions affect antimicrobial mechanism observations?",
    scientistAngle: "Check the named variant, organism, assay and model system for each comparison.",
    analystAngle: "Distinguish a research peptide platform from formulation or commercial food-preservation applications.",
    nextReview: "Use the exact variant stated in a source instead of inferring it from the generic nisin name.",
  },
  {
    slug: "oxytocin", name: "Oxytocin", alternativeNames: ["OXT"],
    theme: "neuropeptides", family: "Endogenous cyclic neuropeptide hormone",
    identity: "Peptide ligand associated with oxytocin receptor signaling.",
    identityCaveat: "Oxytocin and vasopressin share structural features but have different receptor affinity patterns; analog and species context matters.",
    referenceLabel: "PubChem compound · CID 439302", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/439302",
    pubmedTerm: "oxytocin receptor peptide", registryTerm: "oxytocin",
    mechanism: "Oxytocin receptor (OXTR) signaling",
    studyQuestion: "What determines receptor selectivity between closely related endogenous peptides?",
    scientistAngle: "Study receptor interaction context, species, assay and the original peptide sequence.",
    analystAngle: "Separate a basic receptor biology result from a defined clinical-development asset or claim.",
    nextReview: "Compare the official oxytocin and arginine-vasopressin ligand identities before interpreting selectivity.",
  },
  {
    slug: "arginine-vasopressin", name: "Arginine vasopressin", alternativeNames: ["argipressin", "AVP"],
    theme: "neuropeptides", family: "Endogenous nonapeptide hormone",
    identity: "Arginine-containing vasopressin form associated with vasopressin-receptor pathways.",
    identityCaveat: "Arginine vasopressin, lysine vasopressin and synthetic analogs are distinct. The linked CID is argipressin.",
    referenceLabel: "PubChem compound · CID 644077 (argipressin)", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/644077",
    pubmedTerm: "\"arginine vasopressin\" receptor", registryTerm: "vasopressin",
    mechanism: "V1A, V1B and V2 receptor signaling",
    studyQuestion: "How do peptide identity and receptor subtype alter downstream signaling observations?",
    scientistAngle: "Review receptor subtype, test species and sequence identity in primary experiments.",
    analystAngle: "Do not conflate endocrine mechanism evidence with an unrelated formulation or drug-development program.",
    nextReview: "Use the argipressin reference to distinguish peptide identity from the broader vasopressin family.",
  },
  {
    slug: "somatostatin-14", name: "Somatostatin-14", alternativeNames: ["SST-14", "somatostatin"],
    theme: "neuropeptides", family: "Endogenous cyclic inhibitory neuropeptide",
    identity: "Fourteen-residue cyclic peptide form associated with somatostatin receptor biology.",
    identityCaveat: "Somatostatin-14 and somatostatin-28 are not the same peptide form. Synthetic receptor agonists have different pharmacological profiles.",
    referenceLabel: "PubChem compound · CID 16129706", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/16129706",
    pubmedTerm: "\"somatostatin-14\" receptor", registryTerm: "somatostatin",
    mechanism: "Somatostatin receptor pathways",
    studyQuestion: "How do endogenous peptide forms differ from constrained synthetic receptor analogs?",
    scientistAngle: "Compare peptide length, receptor subtype and model context before combining functional findings.",
    analystAngle: "Trace which findings concern the native peptide versus a program-specific somatostatin analog.",
    nextReview: "Compare this native peptide with octreotide and lanreotide as separate molecular entities.",
  },
  {
    slug: "neurotensin", name: "Neurotensin", alternativeNames: ["NTS"],
    theme: "neuropeptides", family: "Endogenous neuropeptide",
    identity: "Peptide ligand associated with neurotensin receptor signaling.",
    identityCaveat: "Neurotensin precursor proteins, peptide fragments, and receptor-selective analogs require separate identity checks.",
    referenceLabel: "PubChem compound · CID 25077406", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/25077406",
    pubmedTerm: "neurotensin NTSR", registryTerm: "neurotensin",
    mechanism: "Neurotensin receptor signaling",
    studyQuestion: "Which receptor and signaling context underlie reported peptide effects?",
    scientistAngle: "Inspect receptor subtype, tissue model and the peptide form used in an experiment.",
    analystAngle: "Identify whether a cited study tests the endogenous peptide, a synthetic analog or a separate therapeutic target.",
    nextReview: "Use molecular identity and target-reference databases before treating different neurotensin analogs as equivalent.",
  },
  {
    slug: "cyclosporin-a", name: "Cyclosporin A", alternativeNames: ["cyclosporine A", "ciclosporin"],
    theme: "constrained", family: "Macrocyclic undecapeptide",
    identity: "Naturally derived cyclic peptide noted for its constrained conformation and intracellular protein interactions.",
    identityCaveat: "The core cyclosporin A compound must be distinguished from related cyclosporins, metabolites and formulations.",
    referenceLabel: "PubChem compound · CID 5284373", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/5284373",
    pubmedTerm: "\"cyclosporin A\" conformation", registryTerm: "cyclosporine",
    mechanism: "Conformational control and cyclophilin binding",
    studyQuestion: "How does macrocyclization change molecular recognition and properties?",
    scientistAngle: "Review structural conformation, target binding and assay conditions using the exact named compound.",
    analystAngle: "Use as a constrained-peptide reference; do not infer development status of unrelated cyclic molecules.",
    nextReview: "Compare its macrocyclic scaffold with disulfide-stabilized peptide examples.",
  },
  {
    slug: "octreotide", name: "Octreotide", alternativeNames: ["somatostatin analog"],
    theme: "constrained", family: "Cyclic somatostatin analog",
    identity: "Synthetic constrained peptide that interacts with somatostatin receptor subtypes.",
    identityCaveat: "A long-acting formulation is not a new peptide identity, and other somatostatin analogs are not equivalent molecular species.",
    referenceLabel: "PubChem compound · CID 448601", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/448601",
    pubmedTerm: "octreotide somatostatin receptor", registryTerm: "octreotide",
    mechanism: "Somatostatin receptor agonism",
    studyQuestion: "What does a constrained analog change relative to endogenous somatostatin?",
    scientistAngle: "Compare receptor subtype interaction and structural constraints with the original peptide.",
    analystAngle: "Keep specific trial formulations and indications distinct when reviewing public product claims.",
    nextReview: "Compare octreotide with somatostatin-14 without assigning both an identical biological effect.",
  },
  {
    slug: "lanreotide", name: "Lanreotide", alternativeNames: ["somatostatin analog"],
    theme: "constrained", family: "Cyclic somatostatin analog",
    identity: "Constrained synthetic peptide studied for somatostatin receptor activity.",
    identityCaveat: "Lanreotide, octreotide and native somatostatin are separate identities; depot formulations must not be mistaken for a different active moiety.",
    referenceLabel: "PubChem compound · CID 6918011", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/6918011",
    pubmedTerm: "lanreotide somatostatin receptor", registryTerm: "lanreotide",
    mechanism: "Somatostatin receptor agonism",
    studyQuestion: "How do two constrained analogs differ in scaffold and receptor-context studies?",
    scientistAngle: "Inspect receptor subtype assays and active-moiety identity before comparing papers.",
    analystAngle: "Track program-specific formulations and their trials without pooling unrelated trial populations.",
    nextReview: "Compare lanreotide with octreotide, then inspect original receptor and trial sources.",
  },
  {
    slug: "ziconotide", name: "Ziconotide", alternativeNames: ["omega-conotoxin MVIIA", "ω-conotoxin MVIIA"],
    theme: "constrained", family: "Disulfide-constrained conotoxin peptide",
    identity: "Synthetic conotoxin-derived peptide studied for neuronal voltage-gated calcium channel interactions.",
    identityCaveat: "Individual conotoxin species, derivatives and synthetic analogs have different sequences and channel interactions; do not transfer results across them.",
    referenceLabel: "PubChem compound · CID 16135415", referenceUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/16135415",
    pubmedTerm: "ziconotide conotoxin calcium channel", registryTerm: "ziconotide",
    mechanism: "N-type voltage-gated calcium channel interactions",
    studyQuestion: "How does disulfide-stabilized structure contribute to channel target selectivity?",
    scientistAngle: "Review disulfide connectivity, channel subtype and original functional data.",
    analystAngle: "Use as a case study in translating constrained peptide structure into a defined development asset.",
    nextReview: "Compare this disulfide-rich scaffold against macrocyclic peptides, without treating them as the same structural class.",
  },
] as const;

export function researchSubjectBySlug(slug: string): ResearchSubject | undefined {
  // A strict array search also rejects inherited object property names such
  // as "constructor" or "__proto__" in public URL parameters.
  return RESEARCH_SUBJECTS.find(subject => subject.slug === slug);
}
export function researchThemeById(id: ResearchThemeId): ResearchTheme {
  return RESEARCH_THEMES.find(theme => theme.id === id)!;
}
export function verifiedPubmedSearchUrl(subject: ResearchSubject): string {
  return "https://pubmed.ncbi.nlm.nih.gov/?term=" + encodeURIComponent(subject.pubmedTerm);
}
export function registryDiscoveryUrl(subject: ResearchSubject): string {
  return "https://clinicaltrials.gov/search?term=" + encodeURIComponent(subject.registryTerm);
}
export function compareExplorerHref(slugs: readonly string[], audience: ExplorerAudience): string {
  const approved = Array.from(new Set(slugs.filter(slug => Boolean(researchSubjectBySlug(slug))))).slice(0, 3);
  return "/intelligence/compare?subjects=" + encodeURIComponent(approved.join(",")) + "&audience=" + audience;
}
