// US legal / regulatory reality for research peptides — the "know the law before you buy" layer.
//
// Purely informational, NOT legal or medical advice, and NOT an eligibility gate. It states how
// these compounds are regulated in the United States so a buyer understands the risk they're
// taking on. VialGrade sells nothing and encourages no human use. Consult a licensed attorney and
// physician. Framing follows AGENTS.md: no dosing/use guidance, unknowns stay visible.

export type LegalCategory = "prescription" | "investigational" | "research-only";

export interface UsLegalStatus {
  category: LegalCategory;
  headline: string;   // short status line
  detail: string;     // one plain paragraph
  flags: string[];    // extra caution tags (WADA, do-not-compound, import risk…)
}

// FDA-approved prescription drugs. Buying a "research" version bypasses the prescription and the
// approved supply chain — a materially higher legal and safety exposure.
const PRESCRIPTION: Record<string, string> = {
  semaglutide: "the active drug in Ozempic and Wegovy",
  tirzepatide: "the active drug in Mounjaro and Zepbound",
  liraglutide: "the active drug in Victoza and Saxenda",
  tesamorelin: "an approved drug (Egrifta)",
  sermorelin: "a formerly FDA-approved drug",
  gonadorelin: "an approved GnRH drug",
  oxytocin: "an approved drug (Pitocin)",
};

// Not approved, under active FDA scrutiny — newer GLP-1-class agonists still in trials.
const INVESTIGATIONAL: Record<string, string> = {
  retatrutide: "an investigational triple-agonist still in clinical trials",
  survodutide: "an investigational dual-agonist still in trials",
  mazdutide: "an investigational dual-agonist still in trials",
  cagrilintide: "an investigational amylin analog still in trials",
};

// Compounds the FDA has singled out. BPC-157 was placed in Category 2 of the 503A bulk list
// (2023–2024), flagging significant safety concerns and effectively barring pharmacy compounding.
const FDA_FLAGGED: Record<string, string> = {
  "bpc-157": "The FDA placed BPC-157 in the 503A “do not compound” category (Category 2) over safety concerns — even licensed pharmacies can't compound it.",
};

// Compounds broadly prohibited in drug-tested sport (WADA / USADA). Not exhaustive.
const WADA_BANNED = new Set([
  "ipamorelin", "cjc-1295", "sermorelin", "tesamorelin", "hexarelin", "ghrp-2", "ghrp-6", "mk-677",
  "igf-1-lr3", "mgf", "peg-mgf", "tb-500", "thymosin-beta-4", "follistatin-344", "aod-9604",
  "hgh-fragment-176-191", "semaglutide", "tirzepatide", "gonadorelin", "kisspeptin-10",
]);

const RESEARCH_ONLY_DETAIL =
  "Sold “for research use only,” this compound is not FDA-approved for human use and has not been evaluated for safety, purity, or sterility in people. It is generally not a scheduled controlled substance, so buying it as a research chemical is typically not itself a drug crime — but marketing or using it as a drug is not lawful, and it is not a dietary supplement.";

export function usLegalFor(slug: string): UsLegalStatus {
  const flags: string[] = [];
  if (WADA_BANNED.has(slug)) flags.push("Banned in drug-tested sport (WADA/USADA)");
  if (FDA_FLAGGED[slug]) flags.push("FDA do-not-compound list");

  if (PRESCRIPTION[slug]) {
    return {
      category: "prescription",
      headline: "This is a prescription drug in the US",
      detail: `This is ${PRESCRIPTION[slug]} — an FDA-approved prescription medication. Buying a “research” version sidesteps the prescription requirement and the approved, quality-controlled supply chain. The FDA has warned about and acted against unapproved and compounded copies. Higher legal and safety exposure than an unapproved research peptide.`,
      flags,
    };
  }
  if (INVESTIGATIONAL[slug]) {
    return {
      category: "investigational",
      headline: "Investigational drug — not approved, under FDA scrutiny",
      detail: `This is ${INVESTIGATIONAL[slug]}. It has no FDA approval for any use, is not a supplement, and the FDA is actively watching the GLP-1-class “research” market. Sold research-use-only; marketing or using it as a drug is not lawful.`,
      flags,
    };
  }
  return {
    category: "research-only",
    headline: "Research-use-only — not FDA-approved",
    detail: FDA_FLAGGED[slug] ? `${RESEARCH_ONLY_DETAIL} ${FDA_FLAGGED[slug]}` : RESEARCH_ONLY_DETAIL,
    flags,
  };
}

// The general facts for the full US-regulation explainer page.
export const US_REGULATION_FACTS: { title: string; body: string }[] = [
  { title: "Sold “for research use only”", body: "Every vendor labels these “for laboratory research use only — not for human consumption.” That label isn't a formality; it's the line that keeps the sale outside FDA drug regulation. It also means no one is claiming the product is safe or fit to use." },
  { title: "Not FDA-approved", body: "The vast majority of research peptides (BPC-157, TB-500, epitalon, MOTS-c, and most others) are not approved by the FDA for any use in humans. They have not been evaluated for safety, efficacy, purity, or sterility for human use." },
  { title: "Generally legal to buy — but not to use as a drug", body: "Most research peptides are not DEA-scheduled controlled substances, so purchasing them as research chemicals is typically not itself a drug crime in the US. Selling or marketing an unapproved substance for human use, however, violates the federal Food, Drug & Cosmetic Act. The research-use label is how vendors stay on the legal side of that." },
  { title: "Not dietary supplements", body: "Synthetic peptides like BPC-157 are not lawful dietary ingredients. The FDA has stated they fall outside the supplement definition, so any “supplement” framing you see is not legally valid." },
  { title: "Some are prescription drugs — a different category entirely", body: "Semaglutide, tirzepatide, liraglutide, tesamorelin, sermorelin, gonadorelin and others are FDA-approved prescription medications. Buying a “research” version bypasses the prescription and the approved supply chain, and the FDA has warned about and acted against unapproved and compounded copies — most aggressively for the GLP-1 weight-loss drugs after they came off the shortage list." },
  { title: "The FDA do-not-compound flag", body: "In 2023 the FDA placed BPC-157 (among others) into Category 2 of its 503A bulk-compounding list, citing significant safety concerns — which effectively bars even licensed compounding pharmacies from making it. Research-chemical BPC-157 exists entirely outside that oversight." },
  { title: "Import can be seized", body: "The FDA can detain or refuse importation of unapproved drugs, and personal importation of unapproved drugs is generally not permitted. Orders from overseas vendors carry a real customs-seizure risk." },
  { title: "State law varies and is changing", body: "Peptide-specific rules differ by state and are evolving. Some states regulate research chemicals more tightly than others; check your own state's current law." },
  { title: "Banned in drug-tested sport", body: "Many of these — growth-hormone secretagogues, GHRPs, TB-500, IGF-1, GLP-1 drugs and more — are prohibited by WADA and USADA. Competing athletes face sanctions independent of any purchase legality." },
];
