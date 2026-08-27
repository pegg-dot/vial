import { describe, expect, it } from "vitest";
import { markWinners, differingKeys, orderComparison, planComparison, COMPARE_DIMS, COMPARE_LIMIT, type CompareEntry } from "@/lib/compare-model";

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

describe("planComparison", () => {
  const SIX = ["a", "b", "c", "d", "e", "f"];

  it("shows every selection when it fits", () => {
    const plan = planComparison(["a", "b", "c"]);
    expect(plan.shown).toEqual(["a", "b", "c"]);
    expect(plan.hidden).toEqual([]);
    expect(plan.truncated).toBe(false);
  });

  it("does not call an exactly-full table truncated", () => {
    const plan = planComparison(["a", "b", "c", "d"]);
    expect(plan.shown).toHaveLength(COMPARE_LIMIT);
    expect(plan.truncated).toBe(false);
    expect(plan.hidden).toEqual([]);
  });

  // The defect this exists for: the page took the first four and said nothing, so a reader who
  // picked six was shown four AS IF they were the whole set. Every slug the reader chose has to
  // come back either as a column or as a named, recoverable omission — never as neither.
  it("accounts for every selected listing, as a column or as a named omission", () => {
    const plan = planComparison(SIX);
    expect(plan.shown).toEqual(["a", "b", "c", "d"]);
    expect(plan.hidden).toEqual(["e", "f"]);
    expect(plan.truncated).toBe(true);
    expect([...plan.shown, ...plan.hidden].sort()).toEqual([...SIX].sort());
  });

  it("swaps a held-back listing into the table without dropping it from the selection", () => {
    const plan = planComparison(SIX, ["f"]);
    expect(plan.shown).toEqual(["f", "a", "b", "c"]);
    expect(plan.hidden).toEqual(["d", "e"]);
    // Still six accounted for: the swap moved a column out, it did not remove anything.
    expect([...plan.shown, ...plan.hidden].sort()).toEqual([...SIX].sort());
  });

  it("keeps the most recently promoted listing first when several are swapped in", () => {
    expect(planComparison(SIX, ["d", "f"]).shown).toEqual(["d", "f", "a", "b"]);
  });

  it("discards a promotion for a listing that is no longer selected", () => {
    // The reader removed 'f' with the column's X while it was promoted. It must not reappear.
    const plan = planComparison(["a", "b", "c", "d", "e"], ["f"]);
    expect(plan.shown).toEqual(["a", "b", "c", "d"]);
    expect(plan.hidden).toEqual(["e"]);
    expect(plan.shown).not.toContain("f");
  });

  it("collapses a duplicated slug rather than rendering the same listing twice", () => {
    const plan = planComparison(["a", "b", "a", "c"]);
    expect(plan.shown).toEqual(["a", "b", "c"]);
    expect(plan.truncated).toBe(false);
    expect(planComparison(SIX, ["e", "e"]).shown).toEqual(["e", "a", "b", "c"]);
  });

  it("handles an empty selection", () => {
    const plan = planComparison([]);
    expect(plan.shown).toEqual([]);
    expect(plan.hidden).toEqual([]);
    expect(plan.truncated).toBe(false);
  });

  it("reports the limit it actually applied", () => {
    expect(planComparison(SIX).limit).toBe(COMPARE_LIMIT);
    const narrow = planComparison(SIX, [], 2);
    expect(narrow.shown).toEqual(["a", "b"]);
    expect(narrow.hidden).toEqual(["c", "d", "e", "f"]);
    expect(narrow.limit).toBe(2);
  });
});

describe("orderComparison", () => {
  it("preserves selection order when nothing is promoted", () => {
    expect(orderComparison(["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });
  it("moves promoted slugs to the front, keeping the rest in selection order", () => {
    expect(orderComparison(["a", "b", "c", "d"], ["c"])).toEqual(["c", "a", "b", "d"]);
  });
  it("never invents a slug that was not selected", () => {
    expect(orderComparison(["a", "b"], ["z"])).toEqual(["a", "b"]);
  });
});
