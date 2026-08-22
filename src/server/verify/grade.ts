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
// `reference` is not a rank — it means "this is a maker we hold lab records for, not a shop you
// can buy from". Grading those on the buyer scale put 57 zero-listing manufacturers above real US
// storefronts in the directory whose headline question is "which one won't scam me?".
export type GradeBand = "strong" | "mixed" | "adverse" | "insufficient" | "reference";
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
export function gradeFromVerdict(composed: ComposedVerdict, input: { coaCount: number; listingCount?: number; vendorKind?: string | null }): VialGradeResult {
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

  // A vendor with nothing listed is usually a MAKER, not a storefront. The letter answers "should I
  // buy from them", which is a question their record cannot answer — they sell nothing here. Rating
  // them anyway inverted the whole scale: a Chinese raw-material supplier known only from a
  // self-declared name on one certificate outranked storefronts with 40+ real listings.
  //
  // ⚠️ BUT THIS SHORTCUT MUST NEVER SWALLOW A WARNING. As first written it returned before the
  // verdict switch, so an adverse conclusion the trust graph had already reached was discarded:
  // Paradigm Peptides — a DOJ action with a recorded guilty plea, plus an FDA warning letter —
  // rendered the same neutral "Maker — not a shop" chip as an anonymous contract manufacturer on
  // every listing card and directory row. The detail page showed the enforcement banner; the
  // summary surfaces everyone actually browses did not. Suppressing a criminal record because a
  // vendor has no listings inverts the purpose of the site.
  //
  // So the shortcut now applies only when there is nothing adverse to say. An `avoid`, `high-risk`
  // or `caution` verdict falls through to the switch and keeps its letter and its adverse band.
  const adverseVerdict = composed.verdict === "avoid" || composed.verdict === "high-risk" || composed.verdict === "caution";
  const nothingListed = input.listingCount === 0;
  // ...but the fall-through belongs to findings someone actually RECORDED. An adverse verdict
  // resting only on inference — a registry date, a regex over page copy — is not grounds to put a
  // maker who sells nothing onto the buyer scale. Collecting operational signals for the first
  // time would otherwise have handed a buyer-facing C+ to 26 zero-listing manufacturers whose
  // sole offence was a new domain, which is precisely the inversion this shortcut prevents.
  // An absence is `ok:false` with NO confidence tag and correctly counts for nothing here.
  const adverseIsSubstantiated = composed.factors.some(
    (f) => f.ok === false && (f.confidence === "verified" || f.confidence === "reported"),
  );

  if (nothingListed && (!adverseVerdict || !adverseIsSubstantiated)) {
    const tests = `${input.coaCount} independent lab test${input.coaCount === 1 ? "" : "s"}`;
    // A second bug lived in this wording. `vendor_kind` is curated: when it says `storefront`, the
    // system KNOWS the vendor sells direct, and 18 rows — Chemyo and Core Peptides among them —
    // carried a rationale flatly asserting "they don't sell direct". That is a false statement of
    // fact about a real business, published by a site whose product is checking such statements.
    // Zero listings there means we captured none, which is a fact about US, not about them.
    const isKnownStorefront = input.vendorKind === "storefront";
    return {
      ...base,
      letter: null,
      band: "reference",
      headline: isKnownStorefront ? "No listings on record" : "Maker — not a shop",
      rationale: isKnownStorefront
        ? (input.coaCount > 0
            ? `This is a storefront, but we have not captured any current listings for it, so there is nothing here to rate. We do hold ${tests} naming them.`
            : "This is a storefront, but we have not captured any current listings or lab tests for it yet, so there is nothing here to rate.")
        : (input.coaCount > 0
            ? `We hold ${tests} naming this maker, but they don't sell direct — nothing here is a storefront you can buy from, so there is nothing to rate. Their tests may back a listing sold by someone else.`
            : "We hold a record of this maker but no lab tests and nothing listed for sale, so there is nothing to rate."),
    };
  }

  // Appended to an adverse rationale when the vendor has nothing listed, so the warning keeps the
  // context the shortcut used to carry instead of losing it.
  const notListedNote = nothingListed
    ? " We hold nothing listed for sale from them here, so this is a warning about the operator rather than about a specific listing."
    : "";

  switch (composed.verdict) {
    case "unproven":
    case "info": {
      return {
        ...base,
        letter: null,
        band: "insufficient",
        headline: "Not enough evidence to grade",
        // "Not rated" must not read as an accusation — it sits in the same slot an F would.
        rationale: tested
          ? "This is not a warning. We track this vendor but have not found enough independent evidence to rate them yet. No news is not the same as good news — check the specific listing before you buy."
          : "This is not a warning — it means we have not found independent lab tests for them yet. That is different from finding something bad. It also is not a clean bill of health: check the specific listing before you buy.",
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
          rationale: "The only red flags here came from our own automated scan — reading their storefront, or one failed attempt to load their site. That is not solid enough to grade a real company on, so we are not going to. What we saw is listed below.",
        };
      }
      const letter: GradeLetter = hasVerifiedNegative ? "F" : "D";
      return {
        ...base,
        letter,
        band: "adverse",
        headline: `${letter} — avoid`,
        rationale: hasVerifiedNegative
          ? `There is an official record against this vendor — a government action, court filing, or a hard link to a flagged storefront. That is the strongest evidence we hold, and it caps the grade here.${notListedNote}`
          : `Buyers and the community report problems, but we have no official record to point at. That is why this is a D rather than an F.${notListedNote}`,
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
          ? `Something official counts against this vendor — a government record or a hard link to a flagged store. Real lab tests would not cancel that out, so the grade stops here.${notListedNote}`
          : tested
            ? `There are real reasons to be careful with this vendor, but they do have independent lab tests on file, which counts for something.${notListedNote}`
            : `There are real reasons to be careful with this vendor, and no independent lab tests to weigh against them.${notListedNote}`,
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
