import type { Compound, Product } from "./types";

// Highest-interest compounds (mid-2026 research-community popularity). Used only to boost
// discovery ordering — never presented as a recommendation to buy or use anything.
export const TIER1 = ["retatrutide", "tirzepatide", "bpc-157", "tb-500", "semaglutide"];

export interface TrustTier { tier: "independent" | "vendor" | "none"; label: string; reasons: string[] }

// Decomposable trust label — NEVER a single black-box score (AGENTS.md). coaCount is the count
// of independent third-party certificates on record for the compound.
export function compoundTrustTier(c: Pick<Compound, "coaCount" | "medianPurity" | "listings">): TrustTier {
  if (c.coaCount > 0) {
    const reasons = [`${c.coaCount} independent lab certificate${c.coaCount === 1 ? "" : "s"} on record`];
    if (c.medianPurity != null) reasons.push(`median tested purity ${c.medianPurity.toFixed(1)}%`);
    return { tier: "independent", label: "Independently tested", reasons };
  }
  if (c.listings > 0) return { tier: "vendor", label: "Vendor-tested only", reasons: ["No independent third-party certificate on record yet"] };
  return { tier: "none", label: "No tests on record", reasons: ["No lab evidence on record"] };
}

/**
 * Cheapest price for a compound, plus how many priced LISTINGS and how many distinct VENDORS.
 *
 * `count` and `vendors` are different relationships and were being conflated: the ticker card
 * rendered `count` — priced listings — beneath the word "vendors", so BPC-157 advertised 39 sellers
 * when 14 vendors sell it. Both numbers are returned explicitly now, and named for what they
 * actually are, so a caller has to choose rather than assume.
 */
export function compoundPriceRange(compoundSlug: string, products: Product[]): { from: number | null; count: number; vendors: number } {
  const matches = products.filter((p) => p.compoundSlug === compoundSlug && p.price > 0);
  const prices = matches.map((p) => p.price);
  return {
    from: prices.length ? Math.min(...prices) : null,
    count: prices.length,
    vendors: new Set(matches.map((p) => p.vendorSlug)).size,
  };
}

function trendScore(c: Pick<Compound, "slug" | "listings" | "coaCount" | "priceChange">): number {
  const boost = TIER1.includes(c.slug) ? 1000 : 0;
  return boost + c.listings * 3 + c.coaCount * 2 + Math.abs(c.priceChange ?? 0);
}

export function trending(compounds: Compound[], limit = 10): Compound[] {
  return [...compounds].sort((a, b) => trendScore(b) - trendScore(a) || a.slug.localeCompare(b.slug)).slice(0, limit);
}

export function mostVerified(compounds: Compound[], limit = 10): Compound[] {
  return [...compounds]
    .filter((c) => c.coaCount > 0)
    .sort((a, b) => b.coaCount - a.coaCount || (b.medianPurity ?? 0) - (a.medianPurity ?? 0) || a.slug.localeCompare(b.slug))
    .slice(0, limit);
}

export function newest(products: Product[], limit = 12): Product[] {
  return [...products].sort((a, b) => (b.lastChecked ?? "").localeCompare(a.lastChecked ?? "")).slice(0, limit);
}

export function bestValue(products: Product[], limit = 8): Product[] {
  return products
    .filter((p) => p.pricePerMg && p.pricePerMg > 0)
    .sort((a, b) => a.pricePerMg! - b.pricePerMg!)
    .slice(0, limit);
}

export function median(values: number[]): number | null {
  const s = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// A "vs market" verdict is a value claim, so it must run on cost-per-mg — never sticker price, which
// is size-blind (a 30mg vial looks "expensive" beside 2mg vials). And it needs a real middle: below
// this many size-readable peers we return no baseline, so the UI shows no badge. Fail toward unknown.
export const MIN_PERMG_PEERS = 3;

/** The compound's typical cost-per-mg — the baseline a listing is judged against. Only listings whose
 *  size we can read count; below `minPeers`, returns null (no baseline → no verdict). */
export function compoundMedianPerMg(pricePerMgs: number[], minPeers = MIN_PERMG_PEERS): number | null {
  const priced = pricePerMgs.filter((v) => typeof v === "number" && v > 0);
  return priced.length >= minPeers ? median(priced) : null;
}

/** A listing's value vs the compound market, on cost-per-mg. Returns null — no verdict — when the
 *  listing's size is unknown or the compound has no per-mg baseline. Positive = pricier than typical. */
export function valueVsMarketPerMg(pricePerMg: number | null | undefined, medianPerMg: number | null | undefined): number | null {
  if (!pricePerMg || pricePerMg <= 0 || !medianPerMg || medianPerMg <= 0) return null;
  return Math.round(((pricePerMg - medianPerMg) / medianPerMg) * 100);
}

export interface MarketStats {
  price: number;
  count: number;          // number of priced listings for the compound (incl. this one)
  low: number;
  high: number;
  med: number | null;
  rank: number | null;    // 1 = cheapest; null if not priced
  positionPct: number | null; // 0 = at the market low, 100 = at the high — where this price sits
  vsMedianPct: number | null; // signed % this price is above(+)/below(−) the market median
}

// The "is this price good?" answer: where a single listing sits in the whole market for its
// compound. `allPrices` should be every priced listing for the compound, including this one.
// How a vendor's per-mg pricing compares to the market: for each of their listings that has a
// $/mg, diff against that compound's market-median $/mg; return the median % delta across them.
// Negative = typically cheaper than the market. null when nothing is comparable.
export function vendorPriceIndex(
  vendorListings: Array<Pick<Product, "compoundSlug" | "pricePerMg">>,
  allProducts: Array<Pick<Product, "compoundSlug" | "pricePerMg">>,
): { medianPctVsMarket: number | null; comparedCount: number } {
  const byCompound = new Map<string, number[]>();
  for (const p of allProducts) {
    if (!p.pricePerMg || p.pricePerMg <= 0) continue;
    const arr = byCompound.get(p.compoundSlug);
    if (arr) arr.push(p.pricePerMg);
    else byCompound.set(p.compoundSlug, [p.pricePerMg]);
  }
  const marketMed = new Map<string, number>();
  // Same min-peer floor as the compound-page verdict: a market with fewer than MIN_PERMG_PEERS priced
  // listings has no real "typical price," so we withhold it here too — otherwise the vendor page would
  // show a confident "-25% vs market" off a 2-listing market that the compound page refuses to judge.
  for (const [slug, arr] of byCompound) { if (arr.length < MIN_PERMG_PEERS) continue; const m = median(arr); if (m) marketMed.set(slug, m); }
  const deltas: number[] = [];
  for (const l of vendorListings) {
    if (!l.pricePerMg || l.pricePerMg <= 0) continue;
    const mm = marketMed.get(l.compoundSlug);
    if (!mm) continue;
    deltas.push(((l.pricePerMg - mm) / mm) * 100);
  }
  if (!deltas.length) return { medianPctVsMarket: null, comparedCount: 0 };
  const sorted = [...deltas].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medDelta = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { medianPctVsMarket: Math.round(medDelta), comparedCount: deltas.length };
}

export function listingMarketStats(price: number, allPrices: number[]): MarketStats {
  const priced = allPrices.filter((p) => p > 0).sort((a, b) => a - b);
  const count = priced.length;
  const low = count ? priced[0] : price;
  const high = count ? priced[count - 1] : price;
  const med = median(priced);
  const rank = price > 0 ? priced.filter((p) => p < price).length + 1 : null;
  const positionPct = high > low ? Math.round(((price - low) / (high - low)) * 100) : count ? 0 : null;
  const vsMedianPct = med && med > 0 ? Math.round(((price - med) / med) * 100) : null;
  return { price, count, low, high, med, rank, positionPct, vsMedianPct };
}
