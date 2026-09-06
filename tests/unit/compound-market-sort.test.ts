import { describe, expect, it } from "vitest";
import { SORTS, sortListings, type CompoundSortKey } from "@/lib/compound-market-sort";
import type { Product } from "@/lib/types";

function listing(o: { slug: string; vendor: string; price: number; perMg?: number; adjusted?: number | null; observedAt?: string }): Product {
  return {
    slug: o.slug, name: o.slug, compoundSlug: "c", vendorSlug: o.vendor, quantity: "5mg", mg: 5,
    pricePerMg: o.perMg, form: "vial", price: o.price, currency: "USD", availability: "In stock",
    shipping: "", evidenceLevel: "public-only", evidenceLabel: "", reportDate: "", reportIssuer: "",
    reportConfirmed: false, batchCode: "", batchLinked: false, sampleOrigin: "", lastChecked: "",
    rating: 0, reviewCount: 0, observedAt: o.observedAt,
    trust: { status: "unverified", tone: "neutral", label: "", detail: "", priceFlag: null, priceNote: null,
      compoundCoas: 0, compoundMedianPurity: null, adjustedPricePerMg: o.adjusted ?? null, purityBasis: null },
  } as unknown as Product;
}

const purity = new Map([["tested-high", 99.5], ["tested-low", 91.0]]);
const tests = new Map([["tested-high", 8], ["tested-low", 2], ["zero-tests", 0]]);

describe("sortListings", () => {
  // The rule the whole surface rests on. Dropping a listing is the bug that hid ten of MOTS-c's
  // forty; this is the same failure one layer up, where a sort quietly loses its unknowns.
  it("returns every listing for every sort", () => {
    const listings = [
      listing({ slug: "a", vendor: "tested-high", price: 50, perMg: 5, adjusted: 5.1, observedAt: "2026-09-01" }),
      listing({ slug: "b", vendor: "unknown-vendor", price: 20 }),
      listing({ slug: "c", vendor: "tested-low", price: 80, perMg: 2 }),
    ];
    for (const { key } of SORTS) {
      const out = sortListings(listings, key, purity, tests);
      expect(out.map((p) => p.slug).sort(), `sort "${key}" lost a listing`).toEqual(["a", "b", "c"]);
    }
  });

  it("puts a listing with no per-mg last when sorting by cheapest per mg", () => {
    const out = sortListings([
      listing({ slug: "no-size", vendor: "v", price: 10 }),
      listing({ slug: "dear", vendor: "v", price: 90, perMg: 9 }),
      listing({ slug: "cheap", vendor: "v", price: 20, perMg: 2 }),
    ], "cheapest", purity, tests);
    expect(out.map((p) => p.slug)).toEqual(["cheap", "dear", "no-size"]);
  });

  it("ranks a known purity above an unknown one", () => {
    // Documents the order, but note it cannot CATCH a missing-as-zero bug: on a descending sort,
    // "unknown last" and "unknown = 0" happen to agree. The ascending sorts below are what
    // actually pin that rule — mutating `?? null` to `?? 0` turns the real-value case red and
    // leaves this one green.
    const out = sortListings([
      listing({ slug: "unknown", vendor: "unknown-vendor", price: 10 }),
      listing({ slug: "low", vendor: "tested-low", price: 20 }),
      listing({ slug: "high", vendor: "tested-high", price: 30 }),
    ], "purity", purity, tests);
    expect(out.map((p) => p.slug)).toEqual(["high", "low", "unknown"]);
  });

  it("sorts a vendor with zero tests among the unknowns, not ahead of them", () => {
    const out = sortListings([
      listing({ slug: "none", vendor: "zero-tests", price: 10 }),
      listing({ slug: "few", vendor: "tested-low", price: 20 }),
      listing({ slug: "many", vendor: "tested-high", price: 30 }),
    ], "tested", purity, tests);
    expect(out.map((p) => p.slug)).toEqual(["many", "few", "none"]);
  });

  it("puts a listing with no real-value figure last rather than first", () => {
    const out = sortListings([
      listing({ slug: "no-real", vendor: "v", price: 5 }),
      listing({ slug: "best", vendor: "v", price: 50, adjusted: 1.2 }),
      listing({ slug: "worse", vendor: "v", price: 60, adjusted: 4.4 }),
    ], "value", purity, tests);
    expect(out.map((p) => p.slug)).toEqual(["best", "worse", "no-real"]);
  });

  it("breaks ties on sticker price so the order is total", () => {
    const out = sortListings([
      listing({ slug: "pricier", vendor: "tested-high", price: 90 }),
      listing({ slug: "cheaper", vendor: "tested-high", price: 30 }),
    ], "purity", purity, tests);
    expect(out.map((p) => p.slug)).toEqual(["cheaper", "pricier"]);
  });

  it("does not mutate the array it was given", () => {
    const listings = [listing({ slug: "b", vendor: "v", price: 90 }), listing({ slug: "a", vendor: "v", price: 10 })];
    const before = listings.map((p) => p.slug);
    sortListings(listings, "price" as CompoundSortKey, purity, tests);
    expect(listings.map((p) => p.slug)).toEqual(before);
  });
});
