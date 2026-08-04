import { describe, expect, it } from "vitest";
import { markWinners, differingKeys, COMPARE_DIMS, type CompareEntry } from "@/lib/compare-model";

const entry = (slug: string, cells: Record<string, { text: string; num?: number }>): CompareEntry => ({
  slug, name: slug, quantity: "10mg", vendorName: slug, vendorSlug: slug, price: 0, cells,
});

describe("compare-model", () => {
  it("exposes grouped dimensions incl. a 'signals most people miss' group", () => {
    expect(COMPARE_DIMS.some((d) => d.group === "hidden")).toBe(true);
    expect(COMPARE_DIMS.find((d) => d.key === "realPerMg")?.betterIsLower).toBe(true);
  });
  it("marks the cheapest per-mg as best and priciest as worst (lower is better)", () => {
    const a = entry("a", { perMg: { text: "$4/mg", num: 4 } });
    const b = entry("b", { perMg: { text: "$9/mg", num: 9 } });
    const c = entry("c", { perMg: { text: "$6/mg", num: 6 } });
    markWinners([a, b, c]);
    expect(a.cells.perMg.best).toBe(true);
    expect(b.cells.perMg.worst).toBe(true);
    expect(c.cells.perMg.best).toBeUndefined();
  });
  it("marks the highest purity as best (higher is better)", () => {
    const a = entry("a", { purity: { text: "98%", num: 98 } });
    const b = entry("b", { purity: { text: "99.8%", num: 99.8 } });
    markWinners([a, b]);
    expect(b.cells.purity.best).toBe(true);
    expect(a.cells.purity.worst).toBe(true);
  });
  it("marks no winner when a dimension ties across all", () => {
    const a = entry("a", { perMg: { text: "$5/mg", num: 5 } });
    const b = entry("b", { perMg: { text: "$5/mg", num: 5 } });
    markWinners([a, b]);
    expect(a.cells.perMg.best).toBeUndefined();
    expect(b.cells.perMg.best).toBeUndefined();
  });
  it("differingKeys returns only rows that actually differ", () => {
    const a = entry("a", { perMg: { text: "$5/mg" }, evidence: { text: "Vendor catalog" } });
    const b = entry("b", { perMg: { text: "$9/mg" }, evidence: { text: "Vendor catalog" } });
    const diff = differingKeys([a, b]);
    expect(diff.has("perMg")).toBe(true);
    expect(diff.has("evidence")).toBe(false);
  });
});
