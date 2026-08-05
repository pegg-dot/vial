// The buyer's read — turns a listing's evidence state into an honest buying decision. VIAL holds a
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
    points.push({ tone: "bad", text: `Priced far below the typical rate for ${i.compoundName} — a common sign of underdosing or a fake, not a deal.` });
  }
  if (i.vendorFlagged) {
    points.push({ tone: "bad", text: `${i.vendorName} carries a certificate-integrity flag on record — treat its claims with extra caution.` });
  }

  // Independently tested for THIS seller+compound — the ~11%.
  if (i.status === "verified" || i.status === "batch-verified") {
    const p = i.independentPurity != null ? ` at ${i.independentPurity.toFixed(1)}%` : "";
    points.unshift({ tone: "good", text: `An independent lab record backs ${poss(i.vendorName)} ${i.compoundName}${p} — the exact evidence most listings lack.` });
    points.push({ tone: "info", text: "A certificate covers one submitted batch, not every vial — confirm it matches the batch you receive." });
    return {
      verdict: "tested",
      headline: "Independently tested — with one caveat",
      points,
      action: `Check the seller's COA is for YOUR batch number, then paste it into Verify to confirm it's a real, unedited Janoshik record.`,
    };
  }

  // The cited certificate resolves to a different maker — a counterfeit signal.
  if (i.status === "mismatch") {
    points.unshift({ tone: "bad", text: "The certificate this listing points to resolves to a different manufacturer — a counterfeit signal." });
    return {
      verdict: "flagged",
      headline: "The cited certificate doesn't check out",
      points,
      action: `Don't rely on the cited certificate. Ask ${i.vendorName} for a Janoshik COA tied to this product and your batch, then verify it here.`,
    };
  }

  if (i.status === "low-purity") {
    points.unshift({ tone: "warn", text: `An independent record for ${poss(i.vendorName)} ${i.compoundName} measured below the usual claim.` });
  }

  // The untested majority — honest, scoped context instead of a dead end.
  if (i.compoundCoas > 0) {
    const p = i.compoundMedianPurity != null ? ` around ${i.compoundMedianPurity.toFixed(1)}% purity` : "";
    points.push({ tone: "info", text: `${i.compoundName} generally tests${p} across ${i.compoundCoas} independent certificate${i.compoundCoas === 1 ? "" : "s"} — but from other makers, so treat it as a benchmark, not proof of this seller's stock.` });
  } else {
    points.push({ tone: "info", text: `We hold no independent tests for ${i.compoundName} from any maker yet — unknown stays visible.` });
  }
  if (i.priceFlag !== "too-cheap") {
    points.push({ tone: "info", text: `Price sits within the normal range for ${i.compoundName} — no cheap-fake red flag.` });
  }

  return {
    verdict: i.status === "low-purity" ? "flagged" : "untested",
    headline: `No independent test of ${poss(i.vendorName)} ${i.compoundName} yet`,
    points,
    action: `To verify before you buy: ask ${i.vendorName} for the Janoshik COA for your batch number, then paste it into Verify — VIAL confirms it's a real, unedited lab record.`,
  };
}
