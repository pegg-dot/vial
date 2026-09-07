import { describe, expect, it } from "vitest";
import { groupVendorHistory } from "@/lib/vendor-history";

type Item = { date: string; event: string; type: "catalog" | "document" | "profile" | "policy" };

const priceRun = (names: string[], date = "Sep 3, 2026"): Item[] =>
  names.map((name) => ({ date, event: `${name} price updated through a reviewed source`, type: "catalog" as const }));

describe("vendor history grouping", () => {
  it("collapses a same-day run of same-shape events into one row that names every subject", () => {
    const groups = groupVendorHistory(priceRun(["Epithalon", "PT-141", "AOD-9604", "IGF-1 LR3"]));
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(4);
    expect(groups[0].headline).toBe("Price updated through a reviewed source");
    expect(groups[0].subjects).toEqual(["Epithalon", "PT-141", "AOD-9604", "IGF-1 LR3"]);
    expect(groups[0].date).toBe("Sep 3, 2026");
    expect(groups[0].type).toBe("catalog");
  });

  it("keeps a lone event verbatim, with no subject list", () => {
    const groups = groupVendorHistory([{ date: "Jul 16, 2026", event: "Current batch report confirmed by issuer", type: "document" }]);
    expect(groups).toEqual([{ date: "Jul 16, 2026", type: "document", headline: "Current batch report confirmed by issuer", subjects: [], count: 1 }]);
  });

  it("never merges across dates or across types", () => {
    const groups = groupVendorHistory([
      ...priceRun(["Epithalon", "PT-141"], "Sep 3, 2026"),
      ...priceRun(["MOTS-c"], "Sep 2, 2026"),
      { date: "Sep 3, 2026", event: "Semax report updated through a reviewed source", type: "document" },
    ]);
    expect(groups.map((g) => [g.date, g.type, g.count])).toEqual([
      ["Sep 3, 2026", "catalog", 2],
      ["Sep 2, 2026", "catalog", 1],
      ["Sep 3, 2026", "document", 1],
    ]);
  });

  it("preserves newest-first order by each group's first appearance", () => {
    const groups = groupVendorHistory([
      { date: "Sep 3, 2026", event: "Refund policy snapshot updated", type: "policy" },
      ...priceRun(["Epithalon"], "Sep 3, 2026"),
      { date: "Sep 3, 2026", event: "Shipping estimate snapshot updated", type: "policy" },
    ]);
    expect(groups[0].type).toBe("policy");
    expect(groups[0].count).toBe(2);
    expect(groups[0].headline).toBe("Snapshot updated");
    expect(groups[0].subjects).toEqual(["Refund policy", "Shipping estimate"]);
    expect(groups[1].type).toBe("catalog");
  });

  it("does not group when the shared tail would leave a subject empty", () => {
    const groups = groupVendorHistory([
      { date: "Sep 3, 2026", event: "Price updated", type: "catalog" },
      { date: "Sep 3, 2026", event: "Epithalon price updated", type: "catalog" },
    ]);
    expect(groups.map((g) => g.headline)).toEqual(["Price updated", "Epithalon price updated"]);
    expect(groups.every((g) => g.count === 1)).toBe(true);
  });

  it("collapses byte-identical repeats into one counted row with no subject list", () => {
    const groups = groupVendorHistory(priceRun(["Epithalon", "Epithalon", "Epithalon"]));
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
    expect(groups[0].headline).toBe("Epithalon price updated through a reviewed source");
    expect(groups[0].subjects).toEqual([]);
  });

  it("does not group two unrelated events that merely end in the same word", () => {
    const groups = groupVendorHistory([
      { date: "Sep 3, 2026", event: "Shipping estimate changed", type: "policy" },
      { date: "Sep 3, 2026", event: "Refund policy changed", type: "policy" },
    ]);
    expect(groups.map((g) => g.headline)).toEqual(["Shipping estimate changed", "Refund policy changed"]);
  });

  it("lists one subject per entry, so a repeated subject is not silently dropped", () => {
    const groups = groupVendorHistory(priceRun(["Epithalon", "PT-141", "Epithalon"]));
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
    expect(groups[0].subjects).toEqual(["Epithalon", "PT-141", "Epithalon"]);
  });

  it("returns nothing for an empty feed", () => {
    expect(groupVendorHistory([])).toEqual([]);
  });

  it("never loses an entry: group counts always sum to the input length", () => {
    const feed: Item[] = [
      ...priceRun(["Epithalon", "PT-141", "AOD-9604"], "Sep 3, 2026"),
      { date: "Sep 3, 2026", event: "Semax report updated through a reviewed source", type: "document" },
      ...priceRun(["MOTS-c", "GHK-Cu"], "Sep 1, 2026"),
      { date: "Aug 28, 2026", event: "Profile claimed by vendor representative", type: "profile" },
    ];
    expect(groupVendorHistory(feed).reduce((sum, g) => sum + g.count, 0)).toBe(feed.length);
  });
});
