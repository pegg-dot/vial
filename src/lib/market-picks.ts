// Top-picks selection for a compound's market — the marketplace "buy box" logic.
//
// One place decides the standout listings so the picks row and the leaderboard table can never
// disagree about the same listing (two surfaces computing the same verdict independently WILL
// eventually diverge). The leaderboard imports isSuspicious/independentPurityByVendor from here
// for exactly that reason.
//
// Shape: up to five DISTINCT products, each carrying every category it won. When one listing is
// both cheapest and best value, it shows once with both stamps and the freed slot goes to the
// next honest category — then any still-empty slots fill with the next listings in leaderboard
// order, stamped with their real rank ("#4 by price"). A 48-listing market never shows a thin
// row, and no runner-up is ever mislabeled as "best".
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
/**
 * Split a compound's listings into the ones a price-per-mg ranking can order, and the ones it
 * cannot — without losing any.
 *
 * A vendor who publishes "1 vial" with no strength gives us no milligrams to divide the price by,
 * so that listing has no per-mg figure and cannot take a position in a cheapest-first table. It was
 * previously filtered out of the comparison entirely, which meant /compounds/mots-c showed 30 rows
 * under a heading that said "All 40 listings we track" and ten real vendors were unreachable from
 * the page. Not being sortable is not a reason to be invisible.
 *
 * The invariant this exists to hold: ranked + unranked accounts for every listing handed in.
 */
export function splitByRankability(listings: Product[]): { ranked: Product[]; unranked: Product[] } {
  const ranked = listings.filter((p) => p.pricePerMg != null && p.pricePerMg > 0).sort((a, b) => a.pricePerMg! - b.pricePerMg!);
  const unranked = listings.filter((p) => !(p.pricePerMg != null && p.pricePerMg > 0));
  return { ranked, unranked };
}

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

export type PickKey = "cheapest" | "best-value" | "purity" | "most-tested" | "best-documented" | "freshest" | "rank";

export interface PickWin {
  key: PickKey;
  label: string;
  why: string;
}

export interface TopPick {
  product: Product;
  wins: PickWin[];
}

const MAX_PICKS = 5;

export function pickTopListings(listings: Product[], tests: TestRowLike[]): TopPick[] {
  const ranked = listings.filter((p) => p.pricePerMg != null && p.pricePerMg > 0).sort((a, b) => a.pricePerMg! - b.pricePerMg!);
  if (ranked.length === 0) return [];

  const purityByVendor = independentPurityByVendor(tests);
  const countByVendor = independentTestCountByVendor(tests);

  // Each category names its genuine winner over the WHOLE market (never a runner-up), in
  // priority order. Wins for a product already on the board merge onto its card; a new product
  // only joins while there is room.
  const winners: { product: Product | undefined; win: Omit<PickWin, "why"> & { why: string } }[] = [];

  const cheapest = ranked.find((p) => !isSuspicious(p)) ?? ranked[0];
  winners.push({ product: cheapest, win: { key: "cheapest", label: "Cheapest", why: "Lowest price per mg that isn't flagged as suspiciously cheap." } });

  const withReal = ranked.filter((p) => p.trust?.adjustedPricePerMg != null);
  if (withReal.length) {
    const bestValue = withReal.reduce((a, b) => (a.trust!.adjustedPricePerMg! <= b.trust!.adjustedPricePerMg! ? a : b));
    winners.push({ product: bestValue, win: { key: "best-value", label: "Best value", why: "Lowest real cost per active mg — price divided by measured purity." } });
  }

  const tested = ranked.filter((p) => purityByVendor.has(p.vendorSlug));
  if (tested.length) {
    const best = tested.reduce((a, b) => (purityByVendor.get(b.vendorSlug)! > purityByVendor.get(a.vendorSlug)! ? b : a));
    winners.push({ product: best, win: { key: "purity", label: "Highest tested purity", why: `Independently tested at ${purityByVendor.get(best.vendorSlug)!.toFixed(1)}%.` } });
  }

  if (countByVendor.size) {
    let topVendor: string | null = null;
    for (const [vendor, n] of countByVendor) {
      if (topVendor === null || n > countByVendor.get(topVendor)!) topVendor = vendor;
    }
    const fromVendor = ranked.find((p) => p.vendorSlug === topVendor);
    if (fromVendor) {
      const n = countByVendor.get(topVendor!)!;
      winners.push({ product: fromVendor, win: { key: "most-tested", label: "Most tested vendor", why: `${n} independent lab test${n === 1 ? "" : "s"} on file for this vendor.` } });
    }
  }

  // Fallback categories that fill remaining slots honestly, from listing evidence alone.
  const documented = ranked.filter((p) => p.evidenceLevel === "independent");
  if (documented.length) {
    const batchLinked = documented.filter((p) => p.batchLinked);
    const best = (batchLinked.length ? batchLinked : documented)[0];
    winners.push({ product: best, win: { key: "best-documented", label: "Best documented", why: best.batchLinked ? "Independent certificate linked to its exact batch." : "Independent certificate on file for this listing." } });
  }

  const dated = ranked.filter((p) => p.observedAt && !Number.isNaN(Date.parse(p.observedAt)));
  if (dated.length) {
    const freshest = dated.reduce((a, b) => (Date.parse(b.observedAt!) > Date.parse(a.observedAt!) ? b : a));
    winners.push({ product: freshest, win: { key: "freshest", label: "Freshest check", why: "The most recently re-verified listing on this market." } });
  }

  const picks: TopPick[] = [];
  for (const { product, win } of winners) {
    if (!product) continue;
    const existing = picks.find((p) => p.product.slug === product.slug);
    if (existing) {
      existing.wins.push(win);
    } else if (picks.length < MAX_PICKS) {
      picks.push({ product, wins: [win] });
    }
  }

  // Backfill: the next listings straight from leaderboard order, stamped with the rank they
  // genuinely hold there. Honest by construction — the stamp IS the table position.
  for (let i = 0; i < ranked.length && picks.length < MAX_PICKS; i++) {
    const p = ranked[i];
    if (picks.some((x) => x.product.slug === p.slug)) continue;
    picks.push({ product: p, wins: [{ key: "rank", label: `#${i + 1} by price`, why: `Ranked #${i + 1} of ${ranked.length} listings by price per milligram.` }] });
  }
  return picks;
}
