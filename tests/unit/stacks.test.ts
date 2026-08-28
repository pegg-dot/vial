import { describe, expect, it } from "vitest";
import { STACKS, resolveStack, resolveStackDetail, stackBySlug, stacksContaining } from "@/lib/stacks";

const comp = (slug: string, medianPrice = 50, origin: "demo" | "live" = "demo") =>
  ({ slug, name: slug, medianPrice, origin } as never);

describe("stacks", () => {
  it("every stack has >=2 components and a neutral goal label", () => {
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

// The card used to link to the first compound in the recipe because there was no stack page. These
// pin the page's own numbers: a "combined" total is either the whole stack or nothing.
const listing = (slug: string, compoundSlug: string, price: number, over: Record<string, unknown> = {}) =>
  ({ slug, compoundSlug, vendorSlug: `v-${slug}`, price, ...over } as never);
const tested = { trust: { tone: "good" } };

describe("stack pages", () => {
  it("finds a stack by slug and every stack a compound is part of", () => {
    expect(stackBySlug("wolverine")?.name).toBe("Wolverine");
    expect(stackBySlug("nope")).toBeUndefined();
    expect(stacksContaining("bpc-157").map((s) => s.slug)).toEqual(["wolverine", "glow", "klow", "skin-repair"]);
    expect(stacksContaining("not-a-compound")).toEqual([]);
  });

  it("lowest combined is the sum of each component's CHEAPEST listing, not its median", () => {
    const d = resolveStackDetail(stackBySlug("wolverine")!, [comp("bpc-157", 60), comp("tb-500", 90)], [
      listing("a", "bpc-157", 34), listing("b", "bpc-157", 120), listing("c", "tb-500", 40, tested), listing("d", "tb-500", 200),
    ])!;
    expect(d.lowestCombined).toBe(74);
    expect(d.medianCombined).toBe(150);
    expect(d.components.map((c) => c.cheapest?.slug)).toEqual(["a", "c"]);
  });

  it("withholds a total rather than summing a partial stack", () => {
    const d = resolveStackDetail(stackBySlug("wolverine")!, [comp("bpc-157", 60), comp("tb-500", 90)], [listing("a", "bpc-157", 34)])!;
    expect(d.lowestCombined).toBeNull();
    expect(d.components[1].cheapest).toBeNull();
    const partial = resolveStackDetail(stackBySlug("wolverine")!, [comp("bpc-157", 60)], [listing("a", "bpc-157", 34)])!;
    expect(partial.missing).toEqual(["tb-500"]);
    expect(partial.lowestCombined).toBeNull();
    expect(partial.medianCombined).toBeNull();
  });

  it("the tested total only counts listings whose OWN vendor carries a good verdict", () => {
    const d = resolveStackDetail(stackBySlug("wolverine")!, [comp("bpc-157", 60), comp("tb-500", 90)], [
      listing("cheap-untested", "bpc-157", 34), listing("tested", "bpc-157", 50, tested),
      listing("tb-info-only", "tb-500", 40, { trust: { tone: "neutral", compoundCoas: 6 } }), listing("tb-tested", "tb-500", 70, tested),
    ])!;
    expect(d.lowestCombined).toBe(74);
    expect(d.testedCombined).toBe(120);
    expect(d.components.map((c) => c.cheapestTested?.slug)).toEqual(["tested", "tb-tested"]);
  });

  it("is null when no component exists at all", () => {
    expect(resolveStackDetail(stackBySlug("wolverine")!, [], [])).toBeNull();
  });
});
