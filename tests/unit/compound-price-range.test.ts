import { describe, expect, it } from "vitest";
import { compoundPriceRange } from "@/lib/curation";
import type { Product } from "@/lib/types";

// The ticker card rendered the priced-LISTING count under the word "vendors", so BPC-157 told
// visitors 39 vendors sold it when 14 did. On a site whose premise is that other people's numbers
// do not survive checking, a number of ours that does not survive checking is the worst defect
// available. These pin the two counts apart.
const p = (slug: string, vendorSlug: string, price: number) =>
  ({ slug, compoundSlug: "bpc-157", vendorSlug, price } as unknown as Product);

describe("compoundPriceRange", () => {
  const products = [
    p("a", "acme", 40), p("b", "acme", 55), p("c", "acme", 70), // one vendor, three listings
    p("d", "zenith", 35),
    p("e", "orbit", 90),
  ];

  it("counts listings and vendors as the different things they are", () => {
    const r = compoundPriceRange("bpc-157", products);
    expect(r.count).toBe(5);    // priced listings
    expect(r.vendors).toBe(3);  // distinct sellers
    expect(r.count).not.toBe(r.vendors); // the conflation that shipped
  });

  it("takes the lowest price", () => {
    expect(compoundPriceRange("bpc-157", products).from).toBe(35);
  });

  it("ignores unpriced listings in both counts", () => {
    const r = compoundPriceRange("bpc-157", [...products, p("f", "ghost", 0)]);
    expect(r.vendors).toBe(3);
    expect(r.count).toBe(5);
  });

  it("returns zeros and no price for a compound nobody sells", () => {
    const r = compoundPriceRange("nonexistent", products);
    expect(r).toEqual({ from: null, count: 0, vendors: 0 });
  });
});
