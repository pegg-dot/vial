import { describe, expect, it } from "vitest";
import { SHELVES, OTHER_SHELF, shelfForCompound, groupByShelf } from "@/lib/market-taxonomy";
import { COMPOUND_EDUCATION } from "@/lib/compound-education";

const c = (slug: string, category = "Synthetic peptide") => ({ slug, category });

describe("market-taxonomy", () => {
  it("exposes the 9 canonical shelves in order", () => {
    expect(SHELVES).toHaveLength(9);
    expect(SHELVES[0].key).toBe("metabolic");
    expect(SHELVES[8].key).toBe("hormonal");
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
  it("falls back to the OTHER shelf for an unknown slug", () => {
    expect(shelfForCompound(c("not-a-real-compound")).key).toBe(OTHER_SHELF.key);
  });
  it("resolves EVERY seeded compound to a real (non-Other) shelf", () => {
    for (const slug of Object.keys(COMPOUND_EDUCATION)) {
      const shelf = shelfForCompound(c(slug));
      expect(shelf).toBeTruthy();
      expect(SHELVES).toContain(shelf);
    }
  });
  it("groups only non-empty shelves, in SHELVES order, OTHER last", () => {
    const groups = groupByShelf([
      { slug: "retatrutide", category: "x" } as never,
      { slug: "bpc-157", category: "x" } as never,
      { slug: "not-a-real-compound", category: "x" } as never,
    ]);
    expect(groups.map((g) => g.shelf.key)).toEqual(["metabolic", "healing", "other"]);
  });
});
