# VIAL Market & Compounds Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the flat `/market` (≈408-listing) and `/compounds` (≈60-compound) walls into a StockX/GOAT/CoinMarketCap-grade browse experience — 9-shelf categories, algorithmic curated rows, a terminal ranked table, stacks/blends, and a quick-view modal with prev/next paging — that also conveys what VIAL is (the verification layer).

**Architecture:** Presentation-only. Three **pure modules** (`market-taxonomy`, `stacks`, `curation`) compute all grouping/ranking/trust from the existing `CatalogSnapshot`; a set of **shared UI components** render them; two client **experience** orchestrators (`market-experience`, `compounds-experience`) read the catalog already shipped to the browser by the root-layout `MarketplaceProvider` (`useMarketplace()`), hold quick-view state, and compose the rows. No backend/schema/ingestion/trust-logic changes.

**Tech Stack:** Next.js 16 (App Router, React 19 server+client components), TypeScript, Tailwind 4 (the "hard" design system in `docs/DESIGN_SYSTEM.md`), vitest (pure-logic unit tests in `tests/unit`), Playwright (`tests/e2e`). Icons: `lucide-react`.

## Global Constraints

- **Presentation only.** Never change copy, logic, data, props, or schema to make the look work outside these files. No new checkout/payments/dosing. (`AGENTS.md`)
- **Hard design system** (`docs/DESIGN_SYSTEM.md`): `ink`/`ink-1` borders, `hard`/`hard-sm`/`hard-lg` offset shadows (never soft blur), flat fills (no gradients except `ProductVisual`/`VialPlain` illustrations), extrabold type, `tabular-nums` for prices, sharp radii `rounded-[18px]`–`rounded-[20px]`, chips `rounded-full`. Market section signature = teal `#12b3a6` fill / `#0e8f80` text; royal-blue `#2b31d8` accent allowed.
- **Evidence/trust tints** (with `ink-1`): good `bg-[#e6fbf4] text-[#0e8f80]`; caution `bg-[#fff4e0] text-[#b26a00]`; bad `bg-[#fff1f0] text-[#d3372c]`; info blue `bg-[#eef0ff] text-[#2b31d8]`; unknown neutral `bg-[#f0f0ec] text-[var(--muted)]`. **Color never means "safe"** — always paired with text.
- **Honesty rules** (`AGENTS.md`): trust = decomposable label + reasons, **never a single score**; unknown stays visible; "too cheap?" / "vendor-tested only" surface as visible flags; **Demo vs Live** badge (`DataOriginBadge`) on every tile; curation labels stay neutral ("Most looked-up", "Most independent evidence", "Commonly discussed") — never "best", "recommended", "safe", or a buy/use recommendation; stacks are "commonly discussed research combinations", not protocols/dosing.
- **Buy handoff** stays the existing `/go?l=<slug>` server-resolved redirect; demo listings inert.
- **Accessibility/responsive:** core content readable at 320px; carousels scroll (`scroll-fade-x`, `snap-x`, `no-scrollbar`); tables scroll-x; touch targets ≥40px; strong focus states; reduced-motion disables non-essential motion; dialogs labeled + focus-trapped.
- **Run rules:** dev server is single-writer PGlite — never `npm run build` while `next dev` is up; never touch `.data/pglite` while dev runs. Import alias is `@/` → `src/`.
- **Determinism:** no `Date.now()`/`Math.random()` in pure modules — rank on existing fields (`lastChecked`, `reportDate`, `priceChange`).

---

## File structure

**Create (pure):**
- `src/lib/market-taxonomy.ts` — 9 shelves, goal→shelf map, `shelfForCompound`, `groupByShelf`.
- `src/lib/stacks.ts` — curated stacks data + `resolveStack`.
- `src/lib/curation.ts` — `trending`, `bestValue`, `mostVerified`, `newest`, `compoundTrustTier`, `compoundPriceRange`.

**Create (UI, `src/components/market/`):**
- `trust-tier-chip.tsx`, `compound-ticker-card.tsx`, `collection-row.tsx`, `stack-card.tsx`, `quick-view-modal.tsx`, `vial-value-band.tsx`, `category-rail.tsx`, `market-filter-bar.tsx`, `market-browser.tsx`, `market-experience.tsx`, `compound-market-table.tsx`, `compounds-experience.tsx`.

**Modify:**
- `src/app/market/page.tsx` — hero + value band + `<MarketExperience/>`.
- `src/app/compounds/page.tsx` — hero + stats + `<CompoundsExperience/>`.

**Create (tests):**
- `tests/unit/market-taxonomy.test.ts`, `tests/unit/stacks.test.ts`, `tests/unit/curation.test.ts`.
- `tests/e2e/market-redesign.spec.ts`.

**Type reference (already in `src/lib/types.ts` — do not change):** `Compound { slug, name, shorthand, category, description, listings, medianPrice, priceChange, documentationCoverage, coaCount, medianPurity: number|null, accent:[string,string,string], origin:"demo"|"live", researchNote }`. `Product { slug, name, compoundSlug, vendorSlug, quantity, mg?, pricePerMg?, price, previousPrice?, availability, evidenceLevel, evidenceLabel, trust, rating, reviewCount, priceHistory:number[], lastChecked, origin, externalUrl?, accent }`. `Vendor { slug, name, initials, kind:"storefront"|"manufacturer", coaCount, medianPurity, passportCount, accent:[string,string] }`. `CatalogSnapshot { compounds, vendors, products, generatedAt }`.

---

## Task 1: `market-taxonomy` — 9-shelf category system

**Files:**
- Create: `src/lib/market-taxonomy.ts`
- Test: `tests/unit/market-taxonomy.test.ts`

**Interfaces:**
- Consumes: `Compound` (types), `educationFor`, `GOAL_TAGS` (`@/lib/compound-education`).
- Produces:
  - `export interface Shelf { key: string; label: string; blurb: string; goalKeys: string[] }`
  - `export const SHELVES: Shelf[]` (9 entries, ordered)
  - `export function shelfForCompound(compound: Pick<Compound,"slug"|"category">): Shelf` (never null — falls back to the last "Other" shelf)
  - `export function groupByShelf(compounds: Compound[]): Array<{ shelf: Shelf; compounds: Compound[] }>` (only non-empty shelves, in `SHELVES` order)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/market-taxonomy.test.ts
import { describe, expect, it } from "vitest";
import { SHELVES, shelfForCompound, groupByShelf } from "@/lib/market-taxonomy";
import { COMPOUND_EDUCATION } from "@/lib/compound-education";

const c = (slug: string, category = "Synthetic peptide") => ({ slug, category });

describe("market-taxonomy", () => {
  it("exposes the 9 canonical shelves in order, ending with Other", () => {
    expect(SHELVES).toHaveLength(9);
    expect(SHELVES[0].key).toBe("metabolic");
    expect(SHELVES[SHELVES.length - 1].key).toBe("other");
  });
  it("maps a GLP-1 compound to the metabolic shelf", () => {
    expect(shelfForCompound(c("retatrutide")).key).toBe("metabolic");
  });
  it("folds muscle goals into the growth-hormone shelf", () => {
    expect(shelfForCompound(c("igf-1-lr3")).key).toBe("gh");
  });
  it("folds gut goals into the healing shelf", () => {
    expect(shelfForCompound(c("larazotide")).key).toBe("healing");
  });
  it("resolves EVERY seeded compound to a shelf (never throws, never undefined)", () => {
    for (const slug of Object.keys(COMPOUND_EDUCATION)) {
      const shelf = shelfForCompound(c(slug));
      expect(shelf).toBeTruthy();
      expect(SHELVES).toContain(shelf);
    }
  });
  it("groups only non-empty shelves, in SHELVES order", () => {
    const groups = groupByShelf([
      { slug: "retatrutide", category: "x" } as never,
      { slug: "bpc-157", category: "x" } as never,
    ]);
    expect(groups.map((g) => g.shelf.key)).toEqual(["metabolic", "healing"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm run test:unit -- market-taxonomy` → FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/market-taxonomy.ts`**

```ts
import type { Compound } from "./types";
import { educationFor } from "./compound-education";

export interface Shelf { key: string; label: string; blurb: string; goalKeys: string[] }

// 9 research-validated shelves. goalKeys fold the 12 granular goal tags:
// muscle→gh, sleep→cognitive, gut→healing. "other" is the always-present catch-all.
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

const OTHER: Shelf = { key: "other", label: "Other research compounds", blurb: "Everything else we track.", goalKeys: [] };
export const ALL_SHELVES: Shelf[] = [...SHELVES, OTHER];
// keep SHELVES.length === 9 by exposing the catch-all only through ALL_SHELVES-aware helpers:
Object.freeze(SHELVES);

const GOAL_TO_SHELF = new Map<string, Shelf>();
for (const shelf of SHELVES) for (const g of shelf.goalKeys) GOAL_TO_SHELF.set(g, shelf);

export function shelfForCompound(compound: Pick<Compound, "slug" | "category">): Shelf {
  const goals = educationFor(compound.slug)?.goals ?? [];
  for (const g of goals) { const s = GOAL_TO_SHELF.get(g); if (s) return s; }
  return OTHER;
}

export function groupByShelf(compounds: Compound[]): Array<{ shelf: Shelf; compounds: Compound[] }> {
  const buckets = new Map<string, Compound[]>();
  for (const c of compounds) {
    const key = shelfForCompound(c).key;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(c);
  }
  return ALL_SHELVES
    .map((shelf) => ({ shelf, compounds: buckets.get(shelf.key) ?? [] }))
    .filter((g) => g.compounds.length > 0);
}
```

> Note: the test asserts `SHELVES` has length 9 and ends with `other`. Reconcile by making `SHELVES` the 9 **including** `other` as the last entry, and deriving `GOAL_TO_SHELF` from the first 8 (or all — `other` has no goalKeys so it never matches). Adjust: put `OTHER` as `SHELVES[8]` and drop the separate `ALL_SHELVES`. Implementer: make the array literally 9 entries with `other` last, build the goal map from all of them, and return `SHELVES[8]` as the fallback. Update the test's `SHELVES[SHELVES.length-1].key === "other"` accordingly (already asserted).

- [ ] **Step 4: Run test to verify it passes** — `npm run test:unit -- market-taxonomy` → PASS.

- [ ] **Step 5: Commit** — `git add src/lib/market-taxonomy.ts tests/unit/market-taxonomy.test.ts && git commit -m "feat(market): 9-shelf category taxonomy"`

---

## Task 2: `stacks` — curated named stacks/blends

**Files:**
- Create: `src/lib/stacks.ts`
- Test: `tests/unit/stacks.test.ts`

**Interfaces:**
- Consumes: `Compound`, `Product` (types).
- Produces:
  - `export interface Stack { slug: string; name: string; kind: "blend"|"recipe"; goal: string; componentSlugs: string[]; accent: string }`
  - `export const STACKS: Stack[]`
  - `export interface ResolvedStack { stack: Stack; components: Compound[]; priceFrom: number|null; anyLive: boolean }`
  - `export function resolveStack(stack: Stack, compounds: Compound[]): ResolvedStack | null` (null if 0 components exist; `priceFrom` = sum of each component's `medianPrice` where >0, else null)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/stacks.test.ts
import { describe, expect, it } from "vitest";
import { STACKS, resolveStack } from "@/lib/stacks";

const comp = (slug: string, medianPrice = 50, origin: "demo" | "live" = "demo") =>
  ({ slug, name: slug, medianPrice, origin } as never);

describe("stacks", () => {
  it("every stack has ≥2 components and a neutral goal label", () => {
    for (const s of STACKS) {
      expect(s.componentSlugs.length).toBeGreaterThanOrEqual(2);
      expect(s.goal).toMatch(/discussed|research|metabolic/i);
    }
  });
  it("includes the canonical Wolverine (BPC-157 + TB-500) recipe", () => {
    const w = STACKS.find((s) => s.slug === "wolverine")!;
    expect(w.componentSlugs).toEqual(["bpc-157", "tb-500"]);
    expect(w.kind).toBe("recipe");
  });
  it("resolveStack keeps only components that exist and sums their median price", () => {
    const r = resolveStack(STACKS.find((s) => s.slug === "wolverine")!, [comp("bpc-157", 40), comp("tb-500", 60)])!;
    expect(r.components).toHaveLength(2);
    expect(r.priceFrom).toBe(100);
  });
  it("drops missing components and returns null when none exist", () => {
    const w = STACKS.find((s) => s.slug === "wolverine")!;
    expect(resolveStack(w, [comp("bpc-157")])!.components).toHaveLength(1);
    expect(resolveStack(w, [])).toBeNull();
  });
  it("marks a stack live when any component is live", () => {
    const r = resolveStack(STACKS.find((s) => s.slug === "wolverine")!, [comp("bpc-157", 40, "live"), comp("tb-500", 60)])!;
    expect(r.anyLive).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm run test:unit -- stacks` → FAIL.

- [ ] **Step 3: Implement `src/lib/stacks.ts`** (research-sourced set; all slugs exist in `COMPOUND_EDUCATION`)

```ts
import type { Compound } from "./types";

export interface Stack { slug: string; name: string; kind: "blend" | "recipe"; goal: string; componentSlugs: string[]; accent: string }

// "Commonly discussed research combinations." Neutral goal labels only — never a protocol/dose.
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
```

- [ ] **Step 4: Run test to verify it passes** — `npm run test:unit -- stacks` → PASS.
- [ ] **Step 5: Commit** — `git add src/lib/stacks.ts tests/unit/stacks.test.ts && git commit -m "feat(market): curated stacks/blends module"`

---

## Task 3: `curation` — trending, best-value, verified, newest, trust tier

**Files:**
- Create: `src/lib/curation.ts`
- Test: `tests/unit/curation.test.ts`

**Interfaces:**
- Consumes: `Compound`, `Product` (types).
- Produces:
  - `export interface TrustTier { tier: "independent"|"vendor"|"none"; label: string; reasons: string[] }`
  - `export function compoundTrustTier(c: Pick<Compound,"coaCount"|"medianPurity"|"listings">): TrustTier`
  - `export function compoundPriceRange(compoundSlug: string, products: Product[]): { from: number|null; count: number }`
  - `export function trending(compounds: Compound[], limit?: number): Compound[]`
  - `export function mostVerified(compounds: Compound[], limit?: number): Compound[]`
  - `export function newest(products: Product[], limit?: number): Product[]`
  - `export function bestValue(products: Product[], limit?: number): Product[]`
  - `export const TIER1 = ["retatrutide","tirzepatide","bpc-157","tb-500","semaglutide"]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/curation.test.ts
import { describe, expect, it } from "vitest";
import { compoundTrustTier, trending, mostVerified, bestValue, compoundPriceRange } from "@/lib/curation";

const C = (o: Partial<{ slug: string; coaCount: number; medianPurity: number | null; listings: number; priceChange: number }>) =>
  ({ slug: "x", coaCount: 0, medianPurity: null, listings: 0, priceChange: 0, ...o } as never);

describe("curation", () => {
  it("tiers a compound with independent COAs as independent, with reasons", () => {
    const t = compoundTrustTier(C({ coaCount: 3, medianPurity: 99.4 }));
    expect(t.tier).toBe("independent");
    expect(t.reasons.join(" ")).toMatch(/3 independent/i);
  });
  it("tiers a compound with listings but no COAs as vendor-tested", () => {
    expect(compoundTrustTier(C({ coaCount: 0, listings: 4 })).tier).toBe("vendor");
  });
  it("tiers a compound with nothing as none", () => {
    expect(compoundTrustTier(C({ coaCount: 0, listings: 0 })).tier).toBe("none");
  });
  it("ranks Tier-1 compounds ahead of an equal-signal non-tier-1 one", () => {
    const out = trending([C({ slug: "obscure", listings: 5, coaCount: 1 }), C({ slug: "bpc-157", listings: 5, coaCount: 1 })]);
    expect(out[0].slug).toBe("bpc-157");
  });
  it("mostVerified ranks by independent COA count then purity", () => {
    const out = mostVerified([C({ slug: "a", coaCount: 1, medianPurity: 99 }), C({ slug: "b", coaCount: 5, medianPurity: 98 })]);
    expect(out[0].slug).toBe("b");
  });
  it("bestValue ranks by ascending price-per-mg and skips listings without one", () => {
    const p = (slug: string, pricePerMg?: number) => ({ slug, pricePerMg } as never);
    const out = bestValue([p("hi", 5), p("lo", 2), p("none", undefined)]);
    expect(out.map((x) => x.slug)).toEqual(["lo", "hi"]);
  });
  it("compoundPriceRange returns the min listing price for the compound", () => {
    const p = (compoundSlug: string, price: number) => ({ compoundSlug, price } as never);
    expect(compoundPriceRange("bpc-157", [p("bpc-157", 40), p("bpc-157", 55), p("tb-500", 10)])).toEqual({ from: 40, count: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm run test:unit -- curation` → FAIL.

- [ ] **Step 3: Implement `src/lib/curation.ts`**

```ts
import type { Compound, Product } from "./types";

export const TIER1 = ["retatrutide", "tirzepatide", "bpc-157", "tb-500", "semaglutide"];

export interface TrustTier { tier: "independent" | "vendor" | "none"; label: string; reasons: string[] }

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
```

- [ ] **Step 4: Run test to verify it passes** — `npm run test:unit -- curation` → PASS.
- [ ] **Step 5: Commit** — `git add src/lib/curation.ts tests/unit/curation.test.ts && git commit -m "feat(market): curation + trust-tier engine"`

---

## Task 4: `trust-tier-chip` component

**Files:** Create `src/components/market/trust-tier-chip.tsx`.

**Interfaces:** Consumes `TrustTier` (`@/lib/curation`). Produces `export function TrustTierChip({ tier }: { tier: TrustTier }): JSX.Element`.

- [ ] **Step 1: Implement** — a `rounded-full ink-1` chip; tint by tier: `independent`→good, `vendor`→caution, `none`→neutral; icon `FlaskConical`/`ShieldCheck`/`CircleHelp` (lucide); label = `tier.label`; `title={tier.reasons.join(" · ")}`; `aria-label` includes label + first reason. Text always present (never color-only).

```tsx
import type { TrustTier } from "@/lib/curation";
import { FlaskConical, ShieldCheck, CircleHelp } from "lucide-react";

const STYLE = {
  independent: { cls: "bg-[#e6fbf4] text-[#0e8f80]", Icon: ShieldCheck },
  vendor: { cls: "bg-[#fff4e0] text-[#b26a00]", Icon: FlaskConical },
  none: { cls: "bg-[#f0f0ec] text-[var(--muted)]", Icon: CircleHelp },
} as const;

export function TrustTierChip({ tier }: { tier: TrustTier }) {
  const { cls, Icon } = STYLE[tier.tier];
  return (
    <span className={`ink-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`} title={tier.reasons.join(" · ")} aria-label={`${tier.label}. ${tier.reasons[0]}`}>
      <Icon className="size-3" aria-hidden /> {tier.label}
    </span>
  );
}
```

- [ ] **Step 2: Verify** — `npm run typecheck` passes.
- [ ] **Step 3: Commit** — `git add src/components/market/trust-tier-chip.tsx && git commit -m "feat(market): trust-tier chip"`

---

## Task 5: `compound-ticker-card` component

**Files:** Create `src/components/market/compound-ticker-card.tsx`.

**Interfaces:**
- Consumes: `Compound` (types), `shelfForCompound` (`@/lib/market-taxonomy`), `compoundTrustTier`, `compoundPriceRange` (`@/lib/curation`), `TrustTierChip` (Task 4), `formatCurrency` (`@/lib/format`), `DataOriginBadge`, `useMarketplace`, `FollowButton` or the watchlist toggle from the provider.
- Produces: `export function CompoundTickerCard({ compound, products, metric, onQuickView }: { compound: Compound; products: Product[]; metric?: { label: string; value: string }; onQuickView?: () => void }): JSX.Element`

- [ ] **Step 1: Implement** — a `"use client"` tile, `ink-1 hard rounded-[20px] bg-white p-5`, `press` hover. Layout:
  - top row: shelf label (uppercase `text-[11px] text-[var(--muted)]`) + `DataOriginBadge` if live; a save/bookmark button top-right (reuse `useMarketplace().toggleWatchlist`/`isWatched` keyed by compound slug is NOT valid — watchlist is listing-keyed; instead render a `FollowButton` if available, else omit — implementer: check `follow-button.tsx` API and use it with the compound slug; if it needs server props, render a lightweight bookmark that links to the compound page).
  - name (`text-xl font-extrabold tracking-[-.03em]`), `shorthand` muted.
  - labeled canonical number: `from {formatCurrency(range.from)}` (or `—` if null) + `{range.count} vendors`.
  - price-change delta: `priceChange` → `▲/▼ {abs%}` with `text-[#0e8f80]` up / `text-[#d3372c]` down / muted zero, `tabular-nums`. Deltas are facts.
  - `TrustTierChip` + purity chip (`{medianPurity.toFixed(1)}%` good tint) when present.
  - optional `metric` block (the row's ranking number) rendered in a `ink-1 rounded-xl bg-[var(--background)]` mini-box when provided.
  - Whole card: if `onQuickView` provided, it's a `<button>` opening quick-view; also a small "Open →" link to `/compounds/[slug]`. Otherwise the card is a `<Link href={/compounds/${slug}}>`.
- [ ] **Step 2: Verify** — `npm run typecheck` passes.
- [ ] **Step 3: Commit** — `git commit -m "feat(market): compound ticker card"`

---

## Task 6: `collection-row` component

**Files:** Create `src/components/market/collection-row.tsx`.

**Interfaces:** Produces `export function CollectionRow({ eyebrow, title, blurb, seeAllHref, children }: { eyebrow: string; title: string; blurb?: string; seeAllHref?: string; children: React.ReactNode }): JSX.Element`.

- [ ] **Step 1: Implement** — titled section with a horizontal snap carousel. Header: eyebrow (`text-[11px] font-bold uppercase tracking-[.18em] text-[#0e8f80]`), `h2` (`text-3xl font-extrabold tracking-[-.045em]`), optional blurb muted, optional "See all →" `Link` (`ink hard-sm press rounded-full` pill). Body: reuse the home carousel pattern — `<div className="scroll-fade-x -mx-5 overflow-x-auto px-5 pb-3 no-scrollbar sm:-mx-8 sm:px-8"><div className="flex w-max snap-x snap-mandatory gap-4">{children}</div></div>`. Children (tiles) should be `w-[280px] shrink-0 snap-start`.
- [ ] **Step 2: Verify** — `npm run typecheck`.
- [ ] **Step 3: Commit** — `git commit -m "feat(market): collection row carousel"`

---

## Task 7: `stack-card` component

**Files:** Create `src/components/market/stack-card.tsx`.

**Interfaces:** Consumes `ResolvedStack` (`@/lib/stacks`), `VialPlain` (`@/components/vial-art`), `formatCurrency`. Produces `export function StackCard({ resolved }: { resolved: ResolvedStack }): JSX.Element`.

- [ ] **Step 1: Implement** — `ink-1 hard press rounded-[20px] bg-white p-5`, `w-[280px] shrink-0 snap-start`. Top: 2-3 overlapping `VialPlain` mini-vials tinted by component accents; a `rounded-full` badge — `Blend` (info-violet tint) vs `Recipe` (neutral). Name extrabold; `goal` muted; `priceFrom != null` → `from {formatCurrency(priceFrom)} combined`; component chips (each links to `/compounds/[slug]`). If any component live, `DataOriginBadge`. Footer: "commonly discussed research combination — not a protocol." Whole card links to the first component or a `/market?stack=slug` deep-link (implementer: link to `/compounds/[firstSlug]`).
- [ ] **Step 2: Verify** — `npm run typecheck`.
- [ ] **Step 3: Commit** — `git commit -m "feat(market): stack/blend card"`

---

## Task 8: `quick-view-modal` component

**Files:** Create `src/components/market/quick-view-modal.tsx`.

**Interfaces:**
- Produces: `export function QuickViewModal({ items, index, onClose, onNavigate, products, labByCompound }: { items: Compound[]; index: number | null; onClose: () => void; onNavigate: (next: number) => void; products: Product[] }): JSX.Element | null` — renders null when `index === null`.
- Behavior: focus-trapped `role="dialog" aria-modal aria-label={`${current.name} snapshot`}`. Keyboard: `Escape`→onClose, `ArrowLeft`/`ArrowRight`→`onNavigate((index-1+n)%n)`/`onNavigate((index+1)%n)`. On-screen prev/next arrow buttons (disabled-look at ends optional; wrap-around chosen). Backdrop click closes. `hard-lg` panel, `rounded-[20px] bg-white`, `max-w-lg`, scrollable body.

- [ ] **Step 1: Implement** — content = compound snapshot: name + shelf + `DataOriginBadge`; price range `from $X` + best-value `$/active mg` (compute from `bestValue(productsForCompound)` first item's `pricePerMg` via `formatPricePerMg`); `TrustTierChip` + reasons list; median purity; top 3 vendors by presence (derive from `products.filter(compoundSlug).map(vendorSlug)` unique, first 3); `PriceSparkline` (reuse `@/components/price-sparkline`) from the cheapest listing's `priceHistory`; goal tags (`GoalTags`); footer CTA `Link href={/compounds/${slug}}` "Open full ticker →" + prev/next arrows + a "◂ 3 / 10 ▸" counter. Respect reduced-motion (no transition when `prefers-reduced-motion`). Use a `useEffect` keydown listener bound while open; restore focus to opener on close.
- [ ] **Step 2: Verify** — `npm run typecheck`.
- [ ] **Step 3: Commit** — `git commit -m "feat(market): quick-view modal with prev/next paging"`

---

## Task 9: `vial-value-band` component

**Files:** Create `src/components/market/vial-value-band.tsx`.

**Interfaces:** Produces `export function VialValueBand(): JSX.Element` (static, server-renderable).

- [ ] **Step 1: Implement** — a 3-cell band under the hero. Each cell: `ink-1 hard rounded-[18px] bg-white p-5`, an icon chip (`Layers3`/`ShieldCheck`/`ArrowUpRight`), a bold title + one muted line:
  1. **Every vendor & price, side by side** — "One screen for what a compound costs across the market."
  2. **Cross-checked against independent lab tests** — "Real third-party COAs you can verify — not vendor marketing."
  3. **We hand you to the vendor** — "VIAL never sells or takes payment. It keeps you from getting scammed."
  Grid `sm:grid-cols-3 gap-4`. No "safe"/endorsement language.
- [ ] **Step 2: Verify** — `npm run typecheck`.
- [ ] **Step 3: Commit** — `git commit -m "feat(market): what-VIAL-is value band"`

---

## Task 10: `category-rail` component

**Files:** Create `src/components/market/category-rail.tsx`.

**Interfaces:** Consumes `SHELVES` (`@/lib/market-taxonomy`). Produces `export function CategoryRail({ activeKey, onSelect }: { activeKey?: string | null; onSelect?: (key: string | null) => void }): JSX.Element`. When `onSelect` is given it renders `<button>` pills (client filter); otherwise `<Link href={/compounds?goal=...}>` pills. Generalize `home-goal-rail`'s styling (pill: `ink-1 hard-sm press rounded-full bg-white`, active → `bg-[#111214] text-white`). Include an "All" pill.

- [ ] **Step 1: Implement** per above (icon map like `home-goal-rail`; add a shelf→icon map for the 9 keys).
- [ ] **Step 2: Verify** — `npm run typecheck`.
- [ ] **Step 3: Commit** — `git commit -m "feat(market): category shelf rail"`

---

## Task 11: `market-filter-bar` + `market-browser` (refactor of market-client)

**Files:** Create `src/components/market/market-filter-bar.tsx`, `src/components/market/market-browser.tsx`. Reference (don't delete yet): `src/components/market-client.tsx`.

**Interfaces:**
- `market-filter-bar.tsx` produces `export interface MarketFilters { query: string; shelf: string; tier: string; testedOnly: boolean; priceMax: number|null; availability: string; sort: string }` and `export function MarketFilterBar({ filters, onChange, compounds }: {...}): JSX.Element`.
- `market-browser.tsx` produces `export function MarketBrowser({ initialShelf, onQuickViewListing }: { initialShelf?: string | null; onQuickViewListing?: (slug: string) => void }): JSX.Element` — reads `useMarketplace().catalog`, owns `MarketFilters` state, filters `products` (search over name/vendor/quantity; shelf via `shelfForCompound(compound).key`; tier via `compoundTrustTier(compound).tier`; testedOnly → compound `coaCount>0`; priceMax; availability; sort incl. `value` = ascending pricePerMg), renders result count + reset + the grid of `ProductCard`. Preserve the existing `data-testid="market-count"`.

- [ ] **Step 1: Implement the filter bar** — hardened `.field` selects + search input matching `market-client` styling; add Category (from `SHELVES`), Trust tier (All / Independently tested / Vendor-tested / No tests), a "Tested only" toggle chip, Price max select (e.g. Any/$50/$100/$200), Availability, Sort (Strongest evidence / Price low-high / high-low / **Best value ($/mg)** / Highest rating / Recently checked).
- [ ] **Step 2: Implement the browser** — port `market-client`'s filter/sort logic, extend with shelf+tier+testedOnly+priceMax, keep `data-testid="market-count"`, render `ProductCard` grid (`grid gap-5 sm:grid-cols-2 xl:grid-cols-3`). Map a compound lookup once (`new Map(compounds.map(c=>[c.slug,c]))`) for shelf/tier.
- [ ] **Step 3: Verify** — `npm run typecheck`; grep that `data-testid="market-count"` exists.
- [ ] **Step 4: Commit** — `git commit -m "feat(market): faceted filter bar + market browser"`

---

## Task 12: `market-experience` + recompose `/market/page.tsx`

**Files:** Create `src/components/market/market-experience.tsx`; modify `src/app/market/page.tsx`.

**Interfaces:** `market-experience.tsx` produces `export function MarketExperience(): JSX.Element` — `"use client"`, reads `useMarketplace().catalog`, computes `trending/mostVerified/bestValue/newest` + `groupByShelf` + resolved `STACKS`, owns quick-view state `{ rowItems: Compound[]; index: number|null }`, renders top-to-bottom: `CategoryRail` (client, sets browser shelf) → `CollectionRow`s (Trending / Independently verified / Best value / New) of `CompoundTickerCard`/`ProductCard` with per-row `metric` → Stacks `CollectionRow` of `StackCard` → `MarketBrowser` → `QuickViewModal`.

- [ ] **Step 1: Implement `MarketExperience`** — wire curation → rows; each ticker card's `onQuickView` sets `{rowItems, index}`; `QuickViewModal` `onNavigate` updates index. Best-value row uses `ProductCard` (listing-level) or ticker with `metric={label:"per mg", value: formatPricePerMg(...)}`. Trending metric = `{label:"vendors", value:String(listings)}`; Verified metric = `{label:"lab tests", value:String(coaCount)}`.
- [ ] **Step 2: Recompose `/market/page.tsx`** — keep the hero `<section>`; after it render `<section><VialValueBand/></section>` then `<MarketExperience/>` inside the existing `max-w-[1320px]` wrapper. Remove the direct `<MarketClient/>` usage (its logic now lives in `MarketBrowser`). Keep `metadata`.

```tsx
// src/app/market/page.tsx (body)
import { VialValueBand } from "@/components/market/vial-value-band";
import { MarketExperience } from "@/components/market/market-experience";
// ...hero section unchanged...
<section className="mx-auto max-w-[1320px] px-5 pt-12 sm:px-8"><VialValueBand /></section>
<section className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-16"><MarketExperience /></section>
```

- [ ] **Step 3: Verify** — dev server already running; `npm run typecheck`; load `http://localhost:3000/market` via curl and confirm 200 + presence of "Most looked-up"/"Independently verified" strings server-or-client (rows are client — verify in e2e, Task 14). Confirm no console import errors via a quick Playwright smoke (Task 14).
- [ ] **Step 4: Commit** — `git commit -m "feat(market): recompose /market into curated experience"`

---

## Task 13: `compound-market-table` + `compounds-experience` + recompose `/compounds/page.tsx`

**Files:** Create `src/components/market/compound-market-table.tsx`, `src/components/market/compounds-experience.tsx`; modify `src/app/compounds/page.tsx`.

**Interfaces:**
- `compound-market-table.tsx`: `export function CompoundMarketTable({ compounds, products, onQuickView }: {...}): JSX.Element` — sortable ranked table (columns: `#`, Compound (name+shelf), Vendors, `from $X`, Δ, Purity, Lab tests, Trust tier, 7-pt sparkline). Client sort state (trending default). `overflow-x-auto ink hard rounded-[18px]`; row click → `onQuickView`. Sparkline: reuse `PriceSparkline` from cheapest listing's `priceHistory`.
- `compounds-experience.tsx`: `export function CompoundsExperience(): JSX.Element` — `"use client"`, reads `useMarketplace().catalog`, Terminal/Shelves toggle (default Terminal on `sm+`), Trending strip, Popular stacks strip, quick-view modal. Shelves view = `groupByShelf` → per-shelf `CollectionRow` of `CompoundTickerCard`.

- [ ] **Step 1: Implement the table** per interface (Δ colored fact; trust tier chip; `tabular-nums`; sticky-ish header via `bg-[#f7f7f4] border-b-2 border-[#111214]`).
- [ ] **Step 2: Implement `CompoundsExperience`** — view toggle (two `ink hard-sm press` pills), Trending `CollectionRow`, `CompoundMarketTable` OR shelves grid, Stacks strip, `QuickViewModal`.
- [ ] **Step 3: Recompose `/compounds/page.tsx`** — keep hero + `Stat` cards; the current goal-filtered flat grid is replaced by `<CompoundsExperience/>`. Preserve `?goal=` deep-link by passing it into `CompoundsExperience` (initial shelf/filter) — map goal key → shelf via existing goal semantics; simplest: keep the server hero reading `searchParams.goal` for the H1, and let `CompoundsExperience` default to Shelves view scrolled to that shelf when `goal` present. Keep `metadata`, `dynamic`.
- [ ] **Step 4: Verify** — `npm run typecheck`; curl `/compounds` → 200.
- [ ] **Step 5: Commit** — `git commit -m "feat(compounds): terminal table + categorized experience"`

---

## Task 14: e2e + full verification + screenshots

**Files:** Create `tests/e2e/market-redesign.spec.ts`; then run the gate.

- [ ] **Step 1: Write e2e spec**

```ts
// tests/e2e/market-redesign.spec.ts
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => { await page.addInitScript(() => window.localStorage.clear()); });

test("market shows curated rows, filters, and quick-view paging", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/market");
  await expect(page.getByRole("heading", { name: /on one screen/i })).toBeVisible();
  await expect(page.getByText(/Most looked-up|Trending/i).first()).toBeVisible();
  await expect(page.getByText(/Independently verified/i)).toBeVisible();
  // open quick-view on the first trending ticker
  await page.getByRole("button", { name: /quick view|snapshot/i }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("ArrowRight"); // paging
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // browse filter narrows the grid
  const count = page.getByTestId("market-count");
  await expect(count).toBeVisible();
  expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
});

test("compounds terminal table renders and a stack links to a component", async ({ page }) => {
  await page.goto("/compounds");
  await expect(page.getByRole("table").or(page.getByText(/Terminal/i)).first()).toBeVisible();
  await page.goto("/market");
  await expect(page.getByText(/Wolverine/i)).toBeVisible();
});
```

- [ ] **Step 2: Run e2e** — build for e2e in a SEPARATE step (dev server must be stopped first). Run: `NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build && npm run test:e2e -- market-redesign`. Expected: PASS. (If dev server is up, stop it first — never build while `next dev` runs.)
- [ ] **Step 3: Screenshots** — Playwright script capturing `/market`, `/compounds`, and an open quick-view at desktop (1280) + mobile (390) widths; read the PNGs to confirm the hard system (borders/shadows), no overflow, tiles scannable. Save under `docs/audit/` or scratchpad.
- [ ] **Step 4: Full gate** — `npm run lint && npm run typecheck && npm run test:all && npm run build && npm audit --audit-level=high`. Fix anything red. (`audit:roles` is a known sandbox-only failure — see HANDOFF §12.)
- [ ] **Step 5: Remove dead code** — if `market-client.tsx` is now unused, delete it and its import; grep first: `grep -rn "market-client" src`. Commit.
- [ ] **Step 6: Commit** — `git commit -m "test(market): e2e for curated browse + quick-view; verify gate green"`

---

## Self-review

**Spec coverage:** value band (T9) ✓ · category rail/9 shelves (T1,T10) ✓ · trending (T3,T12) ✓ · independently-verified row (T3,T12) ✓ · best value (T3,T12) ✓ · stacks/blends (T2,T7,T12) ✓ · new row (T3,T12) ✓ · browse-everything faceted filter (T11) ✓ · quick-view w/ paging (T8) ✓ · ranking-metric-on-tile (T5 `metric`, T12) ✓ · labeled canonical number (T5) ✓ · trust tier axis (T3,T4) ✓ · terminal table on /compounds (T13) ✓ · watchability (T5 save/follow) ✓ · compounds categorized + stacks (T13) ✓ · design-system fidelity (Global Constraints, every UI task) ✓ · honesty guardrails (Global Constraints, T3/T4/T7) ✓ · verification (T14) ✓.

**Placeholder scan:** pure-module tasks carry full code + tests. UI tasks specify exact files, interfaces (signatures/types), the design-system classes to use, and representative JSX; no "TBD/handle edge cases." The `market-taxonomy` Step-3 note reconciles the `SHELVES.length===9`/`other`-last detail explicitly.

**Type consistency:** `TrustTier`, `Shelf`, `Stack`/`ResolvedStack`, `MarketFilters` names are defined once and reused verbatim; `compoundTrustTier`/`compoundPriceRange`/`shelfForCompound`/`resolveStack` signatures match across producer and consumer tasks; `metric` prop shape `{label,value}` consistent between T5 and T12/T13.

## Out of scope
Backend/schema/ingestion, real affiliate deals, checkout, vendor/passport page internals (cross-links only), monetization, deploy.
