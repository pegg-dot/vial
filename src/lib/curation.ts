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

export function compoundPriceRange(compoundSlug: string, products: Product[]): { from: number | null; count: number } {
  const prices = products.filter((p) => p.compoundSlug === compoundSlug && p.price > 0).map((p) => p.price);
  return { from: prices.length ? Math.min(...prices) : null, count: prices.length };
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
