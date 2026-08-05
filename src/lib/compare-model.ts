// The comparison model — shared by the server (which fills the cells from real data) and the
// client (which renders them). The whole point: surface the dimensions that actually DIFFER and
// judge each against a market baseline (base rate), so a comparison decides instead of looking
// "all the same."

export type DimGroup = "price" | "quality" | "reliability" | "hidden";

export interface CompareDim {
  key: string;
  label: string;
  group: DimGroup;
  betterIsLower?: boolean;   // for numeric winner-marking (price: lower wins; purity: higher wins)
  hint?: string;             // plain-English "what this means"
}

export interface CompareCell {
  text: string;              // what to display ("$8.40/mg", "99.8%", "Trusted", "—")
  num?: number | null;       // numeric value for ranking + baseline (null/undefined = not comparable)
  tone?: "good" | "warn" | "bad" | "neutral";
  baselinePct?: number | null; // signed % vs the market baseline (the base rate) — e.g. -14 = 14% below market
  best?: boolean;            // best in the compared SET (set by markWinners)
  worst?: boolean;
}

export interface CompareEntry {
  slug: string;
  name: string;
  quantity: string;
  vendorName: string;
  vendorSlug: string;
  imageUrl?: string;
  price: number;
  cells: Record<string, CompareCell>;   // keyed by CompareDim.key
}

// The ordered dimension set. "hidden" = the signals most buyers never see but that actually
// separate one listing from another — the reason a comparison is worth doing.
export const COMPARE_DIMS: CompareDim[] = [
  { key: "price", label: "Sticker price", group: "price", betterIsLower: true, hint: "What the vendor charges before you account for size or purity." },
  { key: "perMg", label: "Cost per mg", group: "price", betterIsLower: true, hint: "Price divided by milligrams — the only honest way to compare across vial sizes." },
  { key: "vsMedian", label: "Value vs market", group: "price", betterIsLower: true, hint: "How this listing's cost-per-mg compares to the median $/mg across every vendor of this compound. Blank when we can't read the size." },

  { key: "tests", label: "Vendor lab tests", group: "quality", hint: "How many third-party certificates are on record for this vendor, across everything they sell." },
  { key: "purity", label: "Tested purity", group: "quality", hint: "Median independently-measured purity." },
  { key: "evidence", label: "Evidence tier", group: "quality", hint: "How strong the evidence tied to this listing is." },

  { key: "verdict", label: "Trust verdict", group: "reliability", hint: "VIAL's composed verdict across every signal we hold on the vendor." },
  { key: "trustpilot", label: "Trustpilot", group: "reliability", hint: "Independent buyer rating (their opinion, not ours)." },
  { key: "reviews", label: "Buyer reviews on file", group: "reliability", hint: "How much buyer feedback exists." },
  { key: "track", label: "Track record", group: "reliability", hint: "How long the vendor has existed — a new site can't fake years of history." },

  { key: "realPerMg", label: "Real cost / active mg", group: "hidden", betterIsLower: true, hint: "Cost per mg divided by measured purity — the true cost of the actual peptide. A 90%-pure vial costs more per real mg than its sticker says." },
  { key: "tooCheap", label: "Suspiciously cheap?", group: "hidden", hint: "A price far below the market rate usually means underdosed or fake, not a deal." },
  { key: "blind", label: "Blind tests", group: "hidden", hint: "Tests on samples the vendor couldn't cherry-pick — the strongest independence signal." },
  { key: "enforcement", label: "Enforcement history", group: "hidden", hint: "FDA/DOJ actions on record — the strongest red flag there is." },
  { key: "batchMatch", label: "Batch-matched COA", group: "hidden", hint: "Whether a certificate matches the exact batch, not a generic claim." },
  { key: "vendorPrice", label: "Vendor's typical price", group: "hidden", betterIsLower: true, hint: "Whether this vendor is generally cheaper or pricier than the market, across their whole catalog." },
];

export const GROUP_LABEL: Record<DimGroup, string> = {
  price: "Price",
  quality: "Quality & evidence",
  reliability: "Reliability",
  hidden: "Signals most people miss",
};

// Mark the best and worst cell per dimension across the compared set (only among comparable,
// numeric cells; a dimension where everything ties gets no winner). Mutates the cells.
export function markWinners(entries: CompareEntry[], dims: CompareDim[] = COMPARE_DIMS): void {
  if (entries.length < 2) return;
  for (const dim of dims) {
    const nums = entries.map((e) => e.cells[dim.key]?.num).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    if (nums.length < 2) continue;
    const min = Math.min(...nums), max = Math.max(...nums);
    if (min === max) continue;   // all identical → no winner (this is a "same" row)
    const bestVal = dim.betterIsLower ? min : max;
    const worstVal = dim.betterIsLower ? max : min;
    for (const e of entries) {
      const cell = e.cells[dim.key];
      if (!cell || typeof cell.num !== "number") continue;
      if (cell.num === bestVal) cell.best = true;
      else if (cell.num === worstVal) cell.worst = true;
    }
  }
}

// Keys of dimensions whose displayed values are NOT all identical — the rows worth showing in a
// "differences only" view (the antidote to a samey table).
export function differingKeys(entries: CompareEntry[], dims: CompareDim[] = COMPARE_DIMS): Set<string> {
  const out = new Set<string>();
  for (const dim of dims) {
    const texts = entries.map((e) => e.cells[dim.key]?.text ?? "—");
    if (new Set(texts).size > 1) out.add(dim.key);
  }
  return out;
}
