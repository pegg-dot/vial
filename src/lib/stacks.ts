import type { Compound, Product } from "./types";

export interface Stack { slug: string; name: string; kind: "blend" | "recipe"; goal: string; componentSlugs: string[]; accent: string }

// "Commonly discussed research combinations." Neutral goal labels only — never a protocol/dose.
// A blend is a pre-mixed single-vial SKU; a recipe is two-or-more compounds bought separately.
export const STACKS: Stack[] = [
  { slug: "wolverine", name: "Wolverine", kind: "recipe", goal: "Discussed for tissue recovery", componentSlugs: ["bpc-157", "tb-500"], accent: "#12b3a6" },
  { slug: "glow", name: "GLOW", kind: "blend", goal: "Discussed for skin + recovery", componentSlugs: ["ghk-cu", "bpc-157", "tb-500"], accent: "#d8467f" },
  { slug: "klow", name: "KLOW", kind: "recipe", goal: "GLOW + anti-inflammatory research", componentSlugs: ["ghk-cu", "kpv", "bpc-157", "tb-500"], accent: "#6d5dfc" },
  { slug: "gh-stack", name: "GH Stack", kind: "recipe", goal: "Discussed for the GH axis", componentSlugs: ["cjc-1295", "ipamorelin"], accent: "#2b8fe0" },
  { slug: "visceral-fat", name: "Visceral Fat Stack", kind: "recipe", goal: "Discussed for abdominal-fat research", componentSlugs: ["tesamorelin", "ipamorelin"], accent: "#2b31d8" },
  { slug: "cagrisema", name: "CagriSema", kind: "recipe", goal: "Discussed for satiety research", componentSlugs: ["cagrilintide", "semaglutide"], accent: "#e0872b" },
  { slug: "reta-cagri", name: "Reta + Cagri", kind: "recipe", goal: "Multi-pathway metabolic research", componentSlugs: ["retatrutide", "cagrilintide"], accent: "#d3372c" },
  { slug: "skin-repair", name: "Skin Repair", kind: "recipe", goal: "Discussed for skin + collagen", componentSlugs: ["ghk-cu", "bpc-157"], accent: "#12b3a6" },
  { slug: "metabolic-mito", name: "Metabolic + Mito", kind: "recipe", goal: "Metabolic + mitochondrial research", componentSlugs: ["semaglutide", "mots-c"], accent: "#0e8f80" },
  { slug: "cognitive-duo", name: "Cognitive Duo", kind: "recipe", goal: "Discussed for focus + calm", componentSlugs: ["semax", "selank"], accent: "#6d5dfc" },
];

export const stackBySlug = (slug: string): Stack | undefined => STACKS.find((s) => s.slug === slug);

/** Every stack a compound is a component of — the "part of" links on its page. */
export const stacksContaining = (compoundSlug: string): Stack[] => STACKS.filter((s) => s.componentSlugs.includes(compoundSlug));

export interface ResolvedStack { stack: Stack; components: Compound[]; priceFrom: number | null; anyLive: boolean }

// `priceFrom` is the SUM OF MEDIANS — the tile has compounds, not listings, so it cannot know the
// cheapest way to buy the stack. The tile labels it "median … combined" for that reason; the stack
// page (resolveStackDetail) is where the real lowest-combined number lives.
export function resolveStack(stack: Stack, compounds: Compound[]): ResolvedStack | null {
  const bySlug = new Map(compounds.map((c) => [c.slug, c]));
  const components = stack.componentSlugs.map((s) => bySlug.get(s)).filter((c): c is Compound => Boolean(c));
  if (components.length === 0) return null;
  const priced = components.map((c) => c.medianPrice).filter((p) => p > 0);
  return {
    stack,
    components,
    priceFrom: priced.length ? priced.reduce((a, b) => a + b, 0) : null,
    anyLive: components.some((c) => c.origin === "live"),
  };
}

export interface StackComponentDetail {
  compound: Compound;
  vendors: number;                  // distinct vendors with a priced listing
  cheapest: Product | null;         // cheapest priced listing, any evidence
  cheapestTested: Product | null;   // cheapest listing whose OWN vendor carries a good test verdict
  bestValue: Product[];             // lowest $/mg first (falls back to cheapest sticker when no size reads)
}

export interface StackDetail {
  stack: Stack;
  components: StackComponentDetail[];
  missing: string[];                // component slugs the catalog does not track (said out loud, never hidden)
  anyLive: boolean;
  lowestCombined: number | null;    // Σ cheapest — only when EVERY component has a priced listing
  testedCombined: number | null;    // Σ cheapestTested — only when EVERY component has a tested listing
  medianCombined: number | null;    // Σ compound medians, the tile's number, for continuity
}

// A listing "tested" for this purpose = the vendor's own product carries a good verdict (independent
// or batch test). Compound-level COAs held for OTHER vendors do not count — that would let a tested
// competitor vouch for an untested vial.
const isTested = (p: Product) => p.trust?.tone === "good";

const sumOrNull = (values: Array<number | null>): number | null =>
  values.every((v): v is number => v != null && v > 0) && values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;

/**
 * The stack page's view: each component with its cheapest / cheapest-tested / best-value listings,
 * and the three combined totals. A total is null — not a partial sum — when any component lacks the
 * listing it needs; "from $138 combined" over two of three compounds would be a claim we cannot
 * stand behind.
 */
export function resolveStackDetail(stack: Stack, compounds: Compound[], products: Product[]): StackDetail | null {
  const bySlug = new Map(compounds.map((c) => [c.slug, c]));
  const found = stack.componentSlugs.map((s) => bySlug.get(s)).filter((c): c is Compound => Boolean(c));
  if (found.length === 0) return null;
  const missing = stack.componentSlugs.filter((s) => !bySlug.has(s));

  const components = found.map((compound): StackComponentDetail => {
    const priced = products.filter((p) => p.compoundSlug === compound.slug && p.price > 0);
    const byPrice = [...priced].sort((a, b) => a.price - b.price);
    const perMg = priced.filter((p) => p.pricePerMg && p.pricePerMg > 0).sort((a, b) => a.pricePerMg! - b.pricePerMg!);
    return {
      compound,
      vendors: new Set(priced.map((p) => p.vendorSlug)).size,
      cheapest: byPrice[0] ?? null,
      cheapestTested: byPrice.find(isTested) ?? null,
      bestValue: (perMg.length ? perMg : byPrice).slice(0, 3),
    };
  });

  return {
    stack,
    components,
    missing,
    anyLive: found.some((c) => c.origin === "live"),
    lowestCombined: missing.length ? null : sumOrNull(components.map((c) => c.cheapest?.price ?? null)),
    testedCombined: missing.length ? null : sumOrNull(components.map((c) => c.cheapestTested?.price ?? null)),
    medianCombined: missing.length ? null : sumOrNull(found.map((c) => c.medianPrice)),
  };
}
