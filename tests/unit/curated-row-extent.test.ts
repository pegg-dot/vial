import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bestValue, hasIndependentEvidence, hasPerMgPrice, mostVerified } from "@/lib/curation";
import type { Compound, Product } from "@/lib/types";

// The market page built four curated rows — trending(compounds, 10), mostVerified(compounds, 10),
// bestValue(products, 8), newest(live, 8) — and said nothing about any of them being a top-N.
// `CollectionRow` accepted a `seeAllHref` and no caller ever passed one, so "Lowest cost per mg"
// showed eight listings, offered no route to the ninth, and read as the whole market.
//
// Two things have to hold and keep holding: a row that truncates must SAY it truncates, and the
// number it says it is a top of must be counted from the same pool the ranking ran over.

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");

const ROW_FILES = [
  "src/components/market/market-experience.tsx",
  "src/components/market/compounds-experience.tsx",
];

/** A curated slice — a ranking called with a hard numeric limit. Each one is a row that truncates. */
const SLICE_CALL = /\b(?:trending|mostVerified|bestValue|newest)\(\s*[A-Za-z][A-Za-z0-9_]*\s*,\s*\d+\s*\)/g;

const compound = (over: Partial<Compound>): Compound => ({
  slug: "x", name: "X", shorthand: "X", category: "c", aliases: [], listings: 1, coaCount: 0,
  medianPurity: null, priceChange: 0,
  ...over,
} as Compound);

const product = (slug: string, pricePerMg: number | null): Product => ({
  slug, name: slug, compoundSlug: "x", vendorSlug: "v", price: 100, pricePerMg,
} as Product);

describe("a curated row says what it is a top of", () => {
  // Positive control: if the scan stops finding sliced rows, the assertions below pass vacuously.
  it("finds the rows that truncate", () => {
    const calls = ROW_FILES.flatMap((file) => [...read(file).matchAll(SLICE_CALL)]);
    expect(calls.length, "the curated-slice scan found nothing — the regex has stopped matching").toBeGreaterThanOrEqual(5);
  });

  it.each(ROW_FILES.map((file) => [file]))("%s declares an extent for every row it truncates", (file) => {
    const source = read(file);
    const sliced = [...source.matchAll(SLICE_CALL)].length;
    const declared = [...source.matchAll(/extent=\{\{/g)].length;
    expect(
      declared,
      `${file} builds ${sliced} truncated row(s) but declares ${declared} extent(s). A row that shows the top N of a larger set must say so — silent truncation reads as the whole set.`,
    ).toBeGreaterThanOrEqual(sliced);
  });

  it("CollectionRow actually renders the extent, and only when there is more to see", () => {
    const row = read("src/components/market/collection-row.tsx");
    expect(row).toContain("Showing the top");
    expect(row, "the disclosure must be conditional on there being more than is shown").toMatch(/extent\.total > extent\.shown/);
  });

  // A "See all" that lands nowhere is the same defect wearing a button.
  it("every see-all destination exists", () => {
    const source = read("src/components/market/market-experience.tsx");
    const hrefs = [...source.matchAll(/seeAllHref="([^"]+)"/g)].map((match) => match[1]);
    expect(hrefs.length, "no row wires seeAllHref — the prop is unused again").toBeGreaterThan(0);
    for (const href of hrefs) {
      const [path, hash] = href.split("#");
      expect(
        existsSync(fileURLToPath(new URL(`../../src/app${path}/page.tsx`, import.meta.url))),
        `seeAllHref points at ${path}, which is not a route`,
      ).toBe(true);
      if (hash) expect(source, `seeAllHref points at #${hash}, which nothing on the page anchors`).toContain(`id="${hash}"`);
    }
  });
});

describe("the denominator is the pool the ranking ran over", () => {
  // The count beside "top 10" must be the set the row is drawn from, not the whole catalog: a row
  // of the ten best-tested compounds is not a top ten of every compound, most of which have no
  // test at all. Both are counted from the SAME exported predicate the ranking filters on.
  it("mostVerified draws from exactly the compounds with independent evidence", () => {
    const pool = [
      compound({ slug: "a", coaCount: 3 }),
      compound({ slug: "b", coaCount: 0 }),
      compound({ slug: "c", coaCount: 1 }),
      compound({ slug: "d", coaCount: 0 }),
    ];
    expect(mostVerified(pool, 99).length).toBe(pool.filter(hasIndependentEvidence).length);
    expect(pool.filter(hasIndependentEvidence).length).toBe(2);
  });

  it("bestValue draws from exactly the listings that have a per-mg price", () => {
    const pool = [product("a", 4), product("b", null), product("c", 0), product("d", 1)];
    expect(bestValue(pool, 99).length).toBe(pool.filter(hasPerMgPrice).length);
    expect(pool.filter(hasPerMgPrice).length).toBe(2);
  });

  it("the market page counts its totals with those predicates, not a second filter", () => {
    const source = read("src/components/market/market-experience.tsx");
    expect(source).toMatch(/compounds\.filter\(hasIndependentEvidence\)\.length/);
    expect(source).toMatch(/products\.filter\(hasPerMgPrice\)\.length/);
  });
});
