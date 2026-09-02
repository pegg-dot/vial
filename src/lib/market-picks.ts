// Top-picks selection for a compound's market — the marketplace "buy box" logic.
//
// One place decides "cheapest", "best value", "highest tested purity", and "most tested vendor"
// so the picks row and the leaderboard table can never disagree about the same listing (two
// surfaces computing the same verdict independently WILL eventually diverge). The leaderboard
// imports isSuspicious/independentPurityByVendor from here for exactly that reason.
//
// Pure data module: no server imports, unit-testable.

import type { Product } from "./types";

// Structural subset of LabTestRow so this lib module never imports server code.
export interface TestRowLike {
  vendor_slug?: string | null;
  purity_pct?: number | string | null;
  is_independent?: boolean | null;
}

// A listing far below market rate is flagged by the canonical trust verdict; the crown and the
// "cheapest" pick must both skip it — a too-cheap listing is a warning, not a deal.
export function isSuspicious(p: Product): boolean {
  return p.trust?.priceFlag === "too-cheap";
}

// Best INDEPENDENTLY-tested purity per vendor. Self-published records (is_independent === false)
// are excluded, or a vendor's own number would count as third-party evidence.
export function independentPurityByVendor(tests: TestRowLike[]): Map<string, number> {
  const byVendor = new Map<string, number>();
  for (const t of tests) {
    if (!t.vendor_slug || t.purity_pct == null || t.is_independent === false) continue;
    const p = Number(t.purity_pct);
    if (!Number.isFinite(p)) continue;
    if (!byVendor.has(t.vendor_slug) || p > byVendor.get(t.vendor_slug)!) byVendor.set(t.vendor_slug, p);
  }
  return byVendor;
}

// Count of independent tests per vendor — evidence volume, not quality.
export function independentTestCountByVendor(tests: TestRowLike[]): Map<string, number> {
  const byVendor = new Map<string, number>();
  for (const t of tests) {
    if (!t.vendor_slug || t.is_independent === false) continue;
    byVendor.set(t.vendor_slug, (byVendor.get(t.vendor_slug) ?? 0) + 1);
  }
  return byVendor;
}

export interface TopPick {
  key: "cheapest" | "best-value" | "purity" | "most-tested";
  label: string;
  why: string;
  product: Product;
}

// Up to four distinct picks, in a fixed order. A product that wins several categories appears
// once, under the first category it wins — fewer cards beats repeated ones.
export function pickTopListings(listings: Product[], tests: TestRowLike[]): TopPick[] {
  const ranked = listings.filter((p) => p.pricePerMg != null && p.pricePerMg > 0).sort((a, b) => a.pricePerMg! - b.pricePerMg!);
  if (ranked.length === 0) return [];

  const candidates: TopPick[] = [];

  const cheapest = ranked.find((p) => !isSuspicious(p)) ?? ranked[0];
  candidates.push({ key: "cheapest", label: "Cheapest", why: "Lowest price per mg that isn't flagged as suspiciously cheap", product: cheapest });

  const withReal = ranked.filter((p) => p.trust?.adjustedPricePerMg != null);
  if (withReal.length) {
    const bestValue = withReal.reduce((a, b) => (a.trust!.adjustedPricePerMg! <= b.trust!.adjustedPricePerMg! ? a : b));
    candidates.push({ key: "best-value", label: "Best value", why: "Lowest real cost per active mg — price divided by measured purity", product: bestValue });
  }

  const purityByVendor = independentPurityByVendor(tests);
  const tested = ranked.filter((p) => purityByVendor.has(p.vendorSlug));
  if (tested.length) {
    // Highest independently-tested purity; ties go to the cheaper per-mg listing (ranked order).
    const best = tested.reduce((a, b) => (purityByVendor.get(b.vendorSlug)! > purityByVendor.get(a.vendorSlug)! ? b : a));
    candidates.push({ key: "purity", label: "Highest tested purity", why: `Independently tested at ${purityByVendor.get(best.vendorSlug)!.toFixed(1)}%`, product: best });
  }

  const countByVendor = independentTestCountByVendor(tests);
  if (countByVendor.size) {
    let topVendor: string | null = null;
    for (const [vendor, n] of countByVendor) {
      if (topVendor === null || n > countByVendor.get(topVendor)!) topVendor = vendor;
    }
    const fromVendor = ranked.find((p) => p.vendorSlug === topVendor);
    if (fromVendor) {
      const n = countByVendor.get(topVendor!)!;
      candidates.push({ key: "most-tested", label: "Most tested vendor", why: `${n} independent lab test${n === 1 ? "" : "s"} on file for this vendor`, product: fromVendor });
    }
  }

  const seen = new Set<string>();
  return candidates.filter((c) => (seen.has(c.product.slug) ? false : (seen.add(c.product.slug), true)));
}
