import type { Compound } from "./types";

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

export interface ResolvedStack { stack: Stack; components: Compound[]; priceFrom: number | null; anyLive: boolean }

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
