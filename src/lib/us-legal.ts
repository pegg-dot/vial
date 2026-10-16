// Informational U.S. regulatory context for research listings.
// These are broad educational labels, not legal clearance determinations.
// Approval attaches to a finished drug product, not a molecule or catalog entry.

export type LegalCategory = "prescription" | "investigational" | "research-only";

export interface UsLegalStatus {
  category: LegalCategory;
  headline: string;
  detail: string;
  flags: string[];
}

// Ingredients appearing in particular FDA-approved prescription products.
// Individual third-party listings have NOT been verified or approved by FDA.
const APPROVED_PRODUCT_INGREDIENTS: Record<string, string> = {
  semaglutide: "Ozempic and Wegovy",
  tirzepatide: "Mounjaro and Zepbound",
  liraglutide: "Victoza and Saxenda",
  tesamorelin: "Egrifta",
  oxytocin: "Pitocin",
};

const INVESTIGATIONAL: Record<string, string> = {
  retatrutide: "an investigational triple-agonist",
  survodutide: "an investigational dual-agonist",
  mazdutide: "an investigational dual-agonist",
  cagrilintide: "an investigational amylin analog",
};

const FDA_REVIEW_NOTES: Record<string, string> = {
  "bpc-157": "FDA has considered BPC-157-related bulk substances during its compounding review process. A prior nomination was withdrawn. The outcome does not establish permission to market, dispense or compound any particular drug.",
};

// Do not publish sports-ban determinations from an unmaintained static set.
// Athletes must check the current WADA/USADA prohibited and monitoring lists.
export function usLegalFor(slug: string): UsLegalStatus {
  const flags = FDA_REVIEW_NOTES[slug] ? ["FDA compounding status requires review"] : [];
  if (APPROVED_PRODUCT_INGREDIENTS[slug]) {
    return {
      category: "prescription",
      headline: "An FDA-approved prescription formulation exists",
      detail: `This ingredient appears in FDA-approved prescription products, including ${APPROVED_PRODUCT_INGREDIENTS[slug]}. Approval of a finished drug product does not extend to other vials sold under the same molecular name. This listing has not been established as approved, lawful to distribute, safe, sterile or suitable for human use.`,
      flags,
    };
  }
  if (INVESTIGATIONAL[slug]) {
    return {
      category: "investigational",
      headline: "Investigational compound; human-use approval not established",
      detail: `This substance is ${INVESTIGATIONAL[slug]}. Clinical investigation does not constitute FDA marketing authorization. Statements such as “for research use only” do not by themselves exclude a product from drug requirements. This is an information record, not a product endorsement.`,
      flags,
    };
  }
  const suffix = FDA_REVIEW_NOTES[slug] ? ` ${FDA_REVIEW_NOTES[slug]}` : "";
  return {
    category: "research-only",
    headline: "Human-use approval not established for this listing",
    detail: `A laboratory-use label alone does not decide whether an article is a drug under U.S. law. FDA may examine all evidence of intended use, including website claims and marketing context. A laboratory report also cannot establish the contents or sterility of a later shipment. This site does not provide purchase or use advice.${suffix}`,
    flags,
  };
}

export const US_REGULATION_FACTS: { title: string; body: string }[] = [
  {
    title: "Research-use labeling is not a safe harbor",
    body: "FDA assesses intended use in context. A 'research use only' or 'not for human consumption' label does not automatically remove a product marketed for human use from federal drug regulation.",
  },
  {
    title: "Drug approval applies to specific products",
    body: "The presence of an active ingredient in an FDA-approved prescription product does not mean an unapproved vial containing a similarly named substance is approved, suitable or lawful to distribute.",
  },
  {
    title: "Research status does not establish purchase legality",
    body: "Legality can depend on the exact product, intended use, seller, handling, importation, distribution, and federal and state law. VialGrade does not certify any transaction as legal.",
  },
  {
    title: "Lab certificates have narrow evidentiary value",
    body: "A laboratory report may document findings for one submitted sample using identified methods. Without independently verified custody and sample-to-shipment matching, it does not prove what a future buyer receives, sterility, clinical efficacy or safety.",
  },
  {
    title: "Human drug compounding has separate requirements",
    body: "Under section 503A, applicable bulk-ingredient pathways include a qualifying USP/NF monograph, use of an ingredient present in an FDA-approved drug where no such monograph exists, or inclusion on the 503A bulks list when neither applies. Additional conditions apply, and section 503B has different rules. FDA also has interim policies; substance-specific status should be verified from current agency material.",
  },
  {
    title: "Importation and distribution can trigger drug laws",
    body: "Unapproved drugs may be detained or refused at the border. Packaging, labeling and claims can be relevant to whether an article is considered a drug; no general statement here establishes that a purchase or importation is lawful.",
  },
  {
    title: "Regulatory status can change",
    body: "FDA and state actions, advisory processes and shortage-related policies can change. Verify a specific question through official sources and qualified counsel before taking action.",
  },
  {
    title: "Sports anti-doping rules are separate",
    body: "The WADA prohibited list and monitoring program are distinct, updated instruments. Do not infer that a substance is prohibited merely because it is monitored. Consult the current official list for the substance and sport.",
  },
];
