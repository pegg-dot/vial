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
export type DimensionState = "supported" | "clear" | "adverse" | "conflicting" | "noted" | "absent";

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

// The trust graph emits `ok: null` for genuinely neutral observations too — "no research-use-only
// disclaimer found", a middling tracker score. Painting those amber as "Conflicting" invents an
// alarm out of a note. Only the seam that actually reports contradictory evidence is a conflict.
const CONFLICT_LABELS = new Set(["Conflicting evidence"]);

function stateOf(factors: Signal[]): DimensionState {
  if (factors.length === 0) return "absent";
  if (factors.some(isAdverse)) return "adverse";
  if (factors.some(f => f.ok === null && CONFLICT_LABELS.has(f.label))) return "conflicting";
  if (factors.some(f => f.ok === null)) return "noted";
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
  // `inferred` is the trust graph's weakest tier: a regex read off a storefront, or a SINGLE
  // unretried HTTP probe that calls a vendor "offline" on any timeout or 404. Publishing
  // "D — avoid" about a real, named business on that alone is not defensible, so an adverse
  // verdict with no evidence above `inferred` is reported as ungradeable instead.
  const adverseTiers = composed.factors.filter(f => f.ok === false).map(f => f.confidence);
  const adverseIsInferredOnly = adverseTiers.length > 0 && adverseTiers.every(t => t == null || t === "inferred");
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
      if (adverseIsInferredOnly) {
        return {
          ...base,
          letter: null,
          band: "insufficient",
          headline: "Not enough evidence to grade",
          rationale: "The only findings against this vendor come from our own heuristics — a storefront read or a single unretried site probe. That is not a strong enough basis to publish a grade about a named business. The specific findings are listed below.",
        };
      }
      const letter: GradeLetter = hasVerifiedNegative ? "F" : "D";
      return {
        ...base,
        letter,
        band: "adverse",
        headline: `${letter} — avoid`,
        rationale: hasVerifiedNegative
          ? "An adverse finding is backed by a document, government record, or shared hard identifier — the strongest evidence tier we hold."
          : "The adverse findings are third-party accounts (buyer or community reports) rather than records we can point at, so this is graded D rather than F.",
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
          ? composed.verifiedCount === 0
            ? "No red flags on record — but nothing here is independently verified and nothing has been lab-tested. This rests on third-party accounts, which is the ceiling without hard evidence."
            : "No red flags on record — but nothing here has been independently tested, so this is the ceiling without lab evidence."
          : `No red flags on record, and ${tests} on file. A grade reflects the evidence we hold, not the safety of any vial you receive.`,
      };
    }
  }
}
