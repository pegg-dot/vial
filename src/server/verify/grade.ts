// The VialGrade letter. This is a PROJECTION of the composed verdict, never a second opinion:
// it reads the seams `composeVerdict` already weighed and maps them onto a letter with fixed,
// stateable rules. There are no weights, no tunable coefficients, and no hidden arithmetic —
// if you can read the verdict you can predict the letter.
//
// The doctrine constraint the name has to survive: a grade must never manufacture confidence
// the evidence doesn't support. So "unproven" has NO letter. Unknown stays unknown.
import type { Signal } from "./index";
import type { ComposedVerdict } from "./trust-graph";

export type GradeLetter = "A" | "A-" | "B+" | "B" | "C+" | "C" | "C-" | "D" | "F";
export type GradeBand = "strong" | "mixed" | "adverse" | "insufficient";
export type DimensionKey = "testing" | "regulatory" | "reputation" | "operations";
// `clear` and `supported` are deliberately different answers. The trust graph records "we looked
// and found no enforcement record" as an UNTAGGED positive, precisely so an absence never earns a
// verified chip. Collapsing that into `supported` would show a gap as though it were evidence.
export type DimensionState = "supported" | "clear" | "adverse" | "conflicting" | "absent";

export interface GradeDimension {
  key: DimensionKey;
  label: string;
  state: DimensionState;
  factors: Signal[];
}

export interface VialGradeResult {
  letter: GradeLetter | null; // null is a real answer: not enough evidence to grade
  band: GradeBand;
  headline: string;
  rationale: string;
  dimensions: GradeDimension[];
  weighed: number;
  verifiedCount: number;
}

// Every label `composeVerdict` can emit, routed to exactly one dimension. A new seam over
// there must be added here too — the routing test fails loudly if one goes unrouted.
const DIMENSION_OF: Record<string, DimensionKey> = {
  "Independent testing": "testing",
  "COA integrity": "testing",
  "Government enforcement": "regulatory",
  "Operator network": "regulatory",
  "Scam & red flags": "reputation",
  "Conflicting evidence": "reputation",
  "Third-party trackers": "reputation",
  "Buyer reviews": "reputation",
  "Community": "reputation",
  "Domain age": "operations",
  "Storefront signal": "operations",
  "Research-use notice": "operations",
  "Site status": "operations",
};

const DIMENSION_LABEL: Record<DimensionKey, string> = {
  testing: "Independent testing",
  regulatory: "Regulatory & network",
  reputation: "Reputation",
  operations: "Business signals",
};

const DIMENSION_ORDER: DimensionKey[] = ["testing", "regulatory", "reputation", "operations"];

// An absence is recorded by the trust graph as `ok:false` with NO confidence tag, precisely so a
// gap earns no verified chip. Reading that as evidence against a vendor would invent an accusation
// out of missing data — the exact failure this product exists to prevent.
function isAdverse(signal: Signal): boolean {
  return signal.ok === false && signal.confidence != null;
}

function stateOf(factors: Signal[]): DimensionState {
  if (factors.length === 0) return "absent";
  if (factors.some(isAdverse)) return "adverse";
  if (factors.some(f => f.ok === null)) return "conflicting";
  if (factors.some(f => f.ok === true && f.confidence != null)) return "supported";
  if (factors.some(f => f.ok === true)) return "clear";
  return "absent";
}

function buildDimensions(factors: Signal[]): GradeDimension[] {
  return DIMENSION_ORDER.map(key => {
    const members = factors.filter(f => DIMENSION_OF[f.label] === key);
    return { key, label: DIMENSION_LABEL[key], state: stateOf(members), factors: members };
  });
}

/**
 * Projects a composed verdict onto a letter grade.
 *
 * The bands are fixed by the verdict; the only modulation inside a band is how much
 * independently-verified evidence backs it. `coaCount` is passed separately because an
 * independent lab test is the one seam that can lift a vendor to the top of the scale.
 */
export function gradeFromVerdict(composed: ComposedVerdict, input: { coaCount: number }): VialGradeResult {
  const dimensions = buildDimensions(composed.factors);
  const base = {
    dimensions,
    weighed: composed.weighed,
    verifiedCount: composed.verifiedCount,
  };
  const hasVerifiedNegative = composed.factors.some(f => f.ok === false && f.confidence === "verified");
  const tested = input.coaCount > 0;

  switch (composed.verdict) {
    case "unproven":
    case "info": {
      return {
        ...base,
        letter: null,
        band: "insufficient",
        headline: "Not enough evidence to grade",
        rationale: tested
          ? "We hold some records for this vendor, but not enough independent evidence to place it on the scale. Unknown is not the same as safe."
          : "No independent lab tests and too little corroborated evidence to place this vendor on the scale. Unknown is not the same as safe.",
      };
    }

    case "avoid":
    case "high-risk": {
      const letter: GradeLetter = hasVerifiedNegative ? "F" : "D";
      return {
        ...base,
        letter,
        band: "adverse",
        headline: `${letter} — avoid`,
        rationale: hasVerifiedNegative
          ? "An adverse finding is backed by a document, government record, or shared hard identifier — the strongest evidence tier we hold."
          : "The adverse findings come from third-party accounts rather than records we can point at, so this is graded D rather than F.",
      };
    }

    case "caution": {
      const letter: GradeLetter = hasVerifiedNegative ? "C-" : tested ? "C+" : "C";
      return {
        ...base,
        letter,
        band: "mixed",
        headline: `${letter} — proceed with caution`,
        rationale: hasVerifiedNegative
          ? "Something on the record cuts against this vendor and is backed by a document or hard identifier, which holds the grade at the bottom of the caution band."
          : tested
            ? "There are real reasons for caution, offset by independent lab tests on record."
            : "There are real reasons for caution and no independent lab tests to offset them.",
      };
    }

    // A clean record is the ENTRY condition for this band, not a differentiator — most tracked
    // vendors have no adverse finding. What separates them is how much independent testing backs
    // them, which is the seam the trust graph itself treats as the core physical evidence. Grading
    // on `verifiedCount` instead collapses the whole band onto one letter, because a clean vendor
    // scores exactly one verified signal whether it holds 1 lab test or 19.
    case "trusted": {
      const coa = input.coaCount;
      const letter: GradeLetter = coa >= 10 ? "A" : coa >= 3 ? "A-" : coa >= 1 ? "B+" : "B";
      const tests = `${coa} independent lab test${coa === 1 ? "" : "s"}`;
      return {
        ...base,
        letter,
        band: "strong",
        headline: `${letter} — generally trusted`,
        rationale: coa === 0
          ? "No red flags on record — but nothing here has been independently tested, so this is the ceiling without lab evidence."
          : `No red flags on record, and ${tests} on file. A grade reflects the evidence we hold, not the safety of any vial you receive.`,
      };
    }
  }
}
