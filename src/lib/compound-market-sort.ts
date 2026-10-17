import type { Product } from "./types";
import { splitByRankability } from "./market-picks";

// Sorting for the full market of ONE compound. Pure, and out here rather than in the component,
// because the rule it encodes is a correctness rule rather than a presentation one.

export type CompoundSortKey = "cheapest" | "value" | "purity" | "tested" | "price" | "fresh";

export const SORTS: Array<{ key: CompoundSortKey; label: string; blurb: string }> = [
  { key: "cheapest", label: "Reported price/mg ↑", blurb: "Observed price divided by listed quantity. Not a verified unit cost or a purchasing recommendation." },
  { key: "value", label: "COA-adjusted estimate ↑", blurb: "A calculation from a reported sample purity, not proof of the purity or contents of a later vial." },
  { key: "purity", label: "Reported sample purity ↓", blurb: "Ordered by available laboratory-reported sample findings, not by product safety or clinical quality." },
  { key: "tested", label: "Lab reports on record ↓", blurb: "Document counts do not establish a vendor's production quality or legality." },
  { key: "price", label: "Reported listing price ↑", blurb: "Historical third-party prices with varying quantities and dates; not live purchasing offers." },
  { key: "fresh", label: "Most recently observed", blurb: "When the source page was last read, not a statement of current availability." },
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
