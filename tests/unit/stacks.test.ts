import { describe, expect, it } from "vitest";
import { STACKS, resolveStack } from "@/lib/stacks";

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
