// The buyer's read — turns a listing's evidence state into an honest buying decision. VialGrade holds a
// vendor-specific independent test for only ~11% of listings (the tested companies and the selling
// storefronts are largely different sets). For the other 89% the old UI dead-ended at "no evidence."
// That's not useful to a consumer. This composes what we DO know — price sanity, the compound's test
// landscape (clearly scoped to OTHER makers), vendor integrity — and always ends with the one action
// that actually gets verification: ask for the batch COA and check it. Never fabricates evidence.

export type BuyerReadTone = "good" | "warn" | "bad" | "info";
export interface BuyerReadPoint {
  tone: BuyerReadTone;
  text: string;
}
export interface BuyerRead {
  verdict: "tested" | "untested" | "flagged";
  headline: string;
  points: BuyerReadPoint[];
  action: string; // the concrete "how to verify this yourself" step — always present
}

export interface BuyerReadInput {
  status: string; // the crossCheckCoa status for THIS vendor+compound
  independentPurity: number | null;
  priceFlag: "too-cheap" | "price-drop" | null;
  priceAssessable: boolean; // true only when the too-cheap detector actually RAN (readable size + enough peers) — a null priceFlag means "cleared" only when this is true; otherwise it means "couldn't evaluate"
  compoundCoas: number; // independent COAs for the compound, across ALL makers
  compoundMedianPurity: number | null;
  vendorFlagged: boolean;
  compoundName: string;
  vendorName: string;
}

const poss = (n: string) => (/s$/i.test(n) ? `${n}'` : `${n}'s`);

export function buildBuyerRead(i: BuyerReadInput): BuyerRead {
  const points: BuyerReadPoint[] = [];

  // Cheap-fake signal first — the single most useful warning for a buyer scanning the grey market.
  if (i.priceFlag === "too-cheap") {
    points.push({ tone: "bad", text: `Priced far below observed peers for ${i.compoundName}. This is a statistical outlier, not proof of underdosing, fraud or a particular product's composition.` });
  }
  if (i.vendorFlagged) {
    points.push({ tone: "bad", text: `A certificate-integrity issue is recorded for ${i.vendorName}. Review the source and any response before drawing conclusions.` });
  }

  // Independently tested for THIS seller+compound — the ~11%.
  if (i.status === "verified" || i.status === "batch-verified") {
    const p = i.independentPurity != null ? ` at ${i.independentPurity.toFixed(1)}%` : "";
    points.unshift({ tone: "good", text: `A reported independent laboratory record is associated with ${poss(i.vendorName)} ${i.compoundName}${p}. It describes a submitted sample, not a delivered vial.` });
    points.push({ tone: "info", text: "A report is limited to the submitted batch or sample; matching identifiers alone do not establish a later shipment's contents." });
    return {
      verdict: "tested",
      headline: "Laboratory report on record — scope is limited",
      points,
      action: `Inspect the available issuer, sample number and source documents in Verify. A report does not authenticate a future physical shipment.`,
    };
  }

  // The cited certificate resolves to a different maker — a counterfeit signal.
  if (i.status === "mismatch") {
    points.unshift({ tone: "bad", text: "The certificate identifies a different manufacturer from the listing. This attribution mismatch does not establish counterfeiting." });
    return {
      verdict: "flagged",
      headline: "The cited certificate doesn't check out",
      points,
      action: `Review the conflicting identifiers and issuer documents using Verify. Do not infer product identity or misconduct without additional evidence.`,
    };
  }

  if (i.status === "low-purity") {
    points.unshift({ tone: "warn", text: `An independent record for ${poss(i.vendorName)} ${i.compoundName} measured below the usual claim.` });
  }

  // The untested majority — honest, scoped context instead of a dead end.
  if (i.compoundCoas > 0) {
    const p = i.compoundMedianPurity != null ? ` around ${i.compoundMedianPurity.toFixed(1)}% purity` : "";
    points.push({ tone: "info", text: `The registry has ${i.compoundCoas} independent certificate${i.compoundCoas === 1 ? "" : "s"} for ${i.compoundName}${p}, from other makers; these are not proof of this seller's stock.` });
  } else {
    points.push({ tone: "info", text: `We hold no independent tests for ${i.compoundName} from any maker yet — unknown stays visible.` });
  }
  // Only make a price statement when the too-cheap detector actually RAN. A null priceFlag means
  // "cleared" ONLY when the price was assessable (readable size + enough peers); otherwise the price
  // was never evaluated, and asserting "within normal range" would be a fabricated clearance.
  if (i.priceFlag !== "too-cheap") {
    points.push(i.priceAssessable
      ? { tone: "info", text: `The observed price falls within the normal range for ${i.compoundName}. Price alone cannot establish authenticity, sterility or lawful sale.` }
      : { tone: "info", text: `We couldn't place this listing's price because its size is unreadable or the market has too few comparable observations.` });
  }

  const isLowPurity = i.status === "low-purity";
  return {
    // A low-purity listing HAS an independent test (it just measured below claim) — the headline must
    // not deny the very test the body reports (kept coherent with the badge / COA panel / matrix).
    verdict: isLowPurity ? "flagged" : "untested",
    headline: isLowPurity
      ? `Independently tested — but ${i.compoundName} came in below the usual purity`
      : `No independent test of ${poss(i.vendorName)} ${i.compoundName} yet`,
    points,
    action: isLowPurity
      ? `Inspect the cited laboratory document in Verify. One sample's reported purity cannot establish the contents of any later vial.`
      : `Review the available issuer and sample identifiers in Verify. VialGrade cannot certify a physical vial or a seller's inventory.`,
  };
}
