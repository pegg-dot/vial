import type { Product } from "./types";
import { splitByRankability } from "./market-picks";

// Sorting for the full market of ONE compound. Pure, and out here rather than in the component,
// because the rule it encodes is a correctness rule rather than a presentation one.

export type CompoundSortKey = "cheapest" | "value" | "purity" | "tested" | "price" | "fresh";

export const SORTS: Array<{ key: CompoundSortKey; label: string; blurb: string }> = [
  { key: "cheapest", label: "Cheapest per mg", blurb: "What a milligram actually costs, so a big vial isn't mistaken for a bargain." },
  { key: "value", label: "Best real value", blurb: "Price per mg divided by measured purity — the cost of the actual peptide." },
  { key: "purity", label: "Highest tested purity", blurb: "Ranked by the vendor's median independently-tested purity. Purity is not a grade." },
  { key: "tested", label: "Most independently tested", blurb: "Vendors with the most third-party certificates on record for this compound." },
  { key: "price", label: "Lowest sticker price", blurb: "The number on the page, ignoring size. Useful for a budget, misleading for value." },
  { key: "fresh", label: "Most recently checked", blurb: "How long ago we last read this listing from the vendor's own store." },
];

/**
 * Order listings by one key, keeping every one of them.
 *
 * Two rules, both load-bearing:
 *
 * - A listing missing the figure being sorted on goes LAST. It is never dropped — that is the bug
 *   that hid ten of MOTS-c's forty listings — and it is never coerced to zero, because ranking a
 *   vendor who published no purity below one who published a bad result is an accusation the data
 *   does not support. "We don't know" is not "worst".
 * - Ties break on sticker price, so the order is total and a re-render cannot reshuffle equals.
 */
export function sortListings(
  listings: Product[],
  sort: CompoundSortKey,
  purityByVendor: Map<string, number>,
  testsByVendor: Map<string, number>,
): Product[] {
  const missingLast = (a: number | null | undefined, b: number | null | undefined, dir: "asc" | "desc") => {
    const av = a ?? null, bv = b ?? null;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return dir === "asc" ? av - bv : bv - av;
  };
  const copy = [...listings];
  switch (sort) {
    case "cheapest": {
      // Reuses the compound table's own split so the two surfaces order the same market the same
      // way, and the unrankable listings land at the end of both.
      const { ranked, unranked } = splitByRankability(copy);
      return [...ranked, ...unranked];
    }
    case "value":
      return copy.sort((a, b) => missingLast(a.trust?.adjustedPricePerMg, b.trust?.adjustedPricePerMg, "asc") || a.price - b.price);
    case "purity":
      return copy.sort((a, b) => missingLast(purityByVendor.get(a.vendorSlug), purityByVendor.get(b.vendorSlug), "desc") || a.price - b.price);
    case "tested":
      // `|| null` on purpose: a vendor with zero tests is "none on record", which sorts with the
      // unknowns rather than ahead of them.
      return copy.sort((a, b) => missingLast(testsByVendor.get(a.vendorSlug) || null, testsByVendor.get(b.vendorSlug) || null, "desc") || a.price - b.price);
    case "price":
      return copy.sort((a, b) => a.price - b.price);
    case "fresh":
      return copy.sort((a, b) => (b.observedAt ?? "").localeCompare(a.observedAt ?? "") || a.price - b.price);
    default:
      return copy;
  }
}
