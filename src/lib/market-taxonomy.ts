import type { Compound } from "./types";
import { educationFor } from "./compound-education";

export interface Shelf { key: string; label: string; blurb: string; goalKeys: string[] }

// 9 research-validated shelves. goalKeys fold the 12 granular goal tags:
// muscle→gh, sleep→cognitive, gut→healing. Every seeded compound carries at least one
// of these 12 goals, so it always resolves to a real shelf; OTHER is the fallback for
// any future compound with no goal tag (kept out of SHELVES, appended last when non-empty).
export const SHELVES: Shelf[] = [
  { key: "metabolic", label: "Weight & Metabolic", blurb: "GLP-1s and metabolic research compounds.", goalKeys: ["metabolic"] },
  { key: "gh", label: "Growth Hormone & Performance", blurb: "Secretagogues, GH axis, muscle & performance.", goalKeys: ["gh", "muscle"] },
  { key: "healing", label: "Healing & Recovery", blurb: "Tissue repair, recovery, and gut-lining research.", goalKeys: ["recovery", "gut"] },
  { key: "longevity", label: "Longevity & Anti-aging", blurb: "Aging, mitochondrial, and cellular research.", goalKeys: ["longevity"] },
  { key: "cognitive", label: "Cognitive & Mood", blurb: "Focus, memory, mood, and sleep research.", goalKeys: ["cognitive", "sleep"] },
  { key: "skin", label: "Skin & Cosmetic", blurb: "Collagen, elasticity, and cosmetic research.", goalKeys: ["skin"] },
  { key: "tanning", label: "Tanning & Libido", blurb: "Melanocortin pigmentation and libido research.", goalKeys: ["tanning"] },
  { key: "immune", label: "Immune & Thymic", blurb: "Immune modulation and thymic-function research.", goalKeys: ["immune"] },
  { key: "hormonal", label: "Reproductive & Hormonal", blurb: "Reproductive-hormone and endocrine research.", goalKeys: ["hormonal"] },
];

export const OTHER_SHELF: Shelf = { key: "other", label: "Other research compounds", blurb: "Everything else we track.", goalKeys: [] };

const GOAL_TO_SHELF = new Map<string, Shelf>();
for (const shelf of SHELVES) for (const g of shelf.goalKeys) GOAL_TO_SHELF.set(g, shelf);

export function shelfForCompound(compound: Pick<Compound, "slug" | "category">): Shelf {
  const goals = educationFor(compound.slug)?.goals ?? [];
  for (const g of goals) { const s = GOAL_TO_SHELF.get(g); if (s) return s; }
  return OTHER_SHELF;
}

/**
 * Listings per shelf key — what a shelf facet will actually hand back if it is selected.
 *
 * A product whose compound is not in `compounds` is skipped, exactly as the market browser's own
 * filter skips it, so a facet can never advertise more rows than selecting it produces. Shared by
 * the category rail and the category select on the same page so the two cannot disagree about
 * which shelves exist.
 */
export function countListingsByShelf(compounds: Compound[], products: Array<{ compoundSlug: string }>): Map<string, number> {
  const shelfBySlug = new Map(compounds.map((c) => [c.slug, shelfForCompound(c).key]));
  const counts = new Map<string, number>();
  for (const p of products) {
    const key = shelfBySlug.get(p.compoundSlug);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function groupByShelf(compounds: Compound[]): Array<{ shelf: Shelf; compounds: Compound[] }> {
  const buckets = new Map<string, Compound[]>();
  for (const c of compounds) {
    const key = shelfForCompound(c).key;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(c);
    else buckets.set(key, [c]);
  }
  return [...SHELVES, OTHER_SHELF]
    .map((shelf) => ({ shelf, compounds: buckets.get(shelf.key) ?? [] }))
    .filter((g) => g.compounds.length > 0);
}
