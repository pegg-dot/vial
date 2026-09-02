import { describe, expect, it } from "vitest";
import { independentPurityByVendor, independentTestCountByVendor, isSuspicious, pickTopListings } from "@/lib/market-picks";
import type { Product } from "@/lib/types";

// Minimal listing fixture — only the fields the pick logic reads carry meaning.
function listing(o: { slug: string; vendor: string; perMg?: number; adjusted?: number | null; tooCheap?: boolean }): Product {
  return {
    slug: o.slug, name: o.slug, compoundSlug: "test-compound", vendorSlug: o.vendor, quantity: "5mg",
    mg: 5, pricePerMg: o.perMg, form: "vial", price: (o.perMg ?? 0) * 5, currency: "USD",
    availability: "In stock", shipping: "", evidenceLevel: "public-only", evidenceLabel: "",
    reportDate: "", reportIssuer: "", reportConfirmed: false, batchCode: "", batchLinked: false,
    sampleOrigin: "", lastChecked: "", rating: 0, reviewCount: 0,
    trust: {
      status: "unverified", tone: "neutral", label: "", detail: "",
      priceFlag: o.tooCheap ? "too-cheap" : null, priceNote: null,
      compoundCoas: 0, compoundMedianPurity: null,
      adjustedPricePerMg: o.adjusted ?? null, purityBasis: null,
    },
  } as unknown as Product;
}

describe("pickTopListings", () => {
  it("cheapest pick skips a too-cheap-flagged listing", () => {
    const picks = pickTopListings([
      listing({ slug: "scam", vendor: "v1", perMg: 1, tooCheap: true }),
      listing({ slug: "legit", vendor: "v2", perMg: 4 }),
    ], []);
    expect(picks.find((p) => p.key === "cheapest")?.product.slug).toBe("legit");
  });

  it("best value is the lowest REAL cost per active mg, not the lowest sticker", () => {
    const picks = pickTopListings([
      listing({ slug: "cheap-dirty", vendor: "v1", perMg: 4, adjusted: 5.0 }),
      listing({ slug: "pricier-pure", vendor: "v2", perMg: 4.5, adjusted: 4.6 }),
    ], []);
    expect(picks.find((p) => p.key === "best-value")?.product.slug).toBe("pricier-pure");
  });

  it("purity pick uses independent tests only — a vendor's own 100% never wins", () => {
    const picks = pickTopListings([
      listing({ slug: "a", vendor: "self-tested", perMg: 4 }),
      listing({ slug: "b", vendor: "indie-tested", perMg: 5 }),
    ], [
      { vendor_slug: "self-tested", purity_pct: 100, is_independent: false },
      { vendor_slug: "indie-tested", purity_pct: 99.2, is_independent: true },
    ]);
    expect(picks.find((p) => p.key === "purity")?.product.slug).toBe("b");
    expect(picks.find((p) => p.key === "purity")?.why).toContain("99.2");
  });

  it("most-tested pick maps the vendor with the most independent tests to its cheapest listing", () => {
    const picks = pickTopListings([
      listing({ slug: "v1-cheap", vendor: "v1", perMg: 6 }),
      listing({ slug: "v1-dear", vendor: "v1", perMg: 9 }),
      listing({ slug: "v2-only", vendor: "v2", perMg: 4 }),
    ], [
      { vendor_slug: "v1", purity_pct: 99, is_independent: true },
      { vendor_slug: "v1", purity_pct: 98, is_independent: true },
      { vendor_slug: "v2", purity_pct: 99.5, is_independent: true },
    ]);
    const most = picks.find((p) => p.key === "most-tested");
    // v2 already won cheapest + purity, so most-tested must surface v1's cheapest listing.
    expect(most?.product.slug).toBe("v1-cheap");
    expect(most?.why).toContain("2 independent lab tests");
  });

  it("a product that wins several categories appears once", () => {
    const picks = pickTopListings([
      listing({ slug: "winner", vendor: "v1", perMg: 3, adjusted: 3.1 }),
      listing({ slug: "other", vendor: "v2", perMg: 8, adjusted: 8.2 }),
    ], [{ vendor_slug: "v1", purity_pct: 99.9, is_independent: true }]);
    expect(picks.filter((p) => p.product.slug === "winner")).toHaveLength(1);
  });

  it("returns nothing when no listing has a usable per-mg price", () => {
    expect(pickTopListings([listing({ slug: "x", vendor: "v1" })], [])).toEqual([]);
  });
});

describe("helpers", () => {
  it("independentPurityByVendor keeps the best independent number per vendor and drops junk", () => {
    const m = independentPurityByVendor([
      { vendor_slug: "v1", purity_pct: 98.5, is_independent: true },
      { vendor_slug: "v1", purity_pct: 99.5, is_independent: true },
      { vendor_slug: "v1", purity_pct: 100, is_independent: false },
      { vendor_slug: null, purity_pct: 99, is_independent: true },
      { vendor_slug: "v2", purity_pct: "not-a-number", is_independent: true },
    ]);
    expect(m.get("v1")).toBe(99.5);
    expect(m.has("v2")).toBe(false);
  });

  it("independentTestCountByVendor excludes self-published records", () => {
    const m = independentTestCountByVendor([
      { vendor_slug: "v1", is_independent: true },
      { vendor_slug: "v1", is_independent: false },
      { vendor_slug: "v1" },
    ]);
    expect(m.get("v1")).toBe(2);
  });

  it("isSuspicious reads the canonical trust flag", () => {
    expect(isSuspicious(listing({ slug: "a", vendor: "v", perMg: 1, tooCheap: true }))).toBe(true);
    expect(isSuspicious(listing({ slug: "b", vendor: "v", perMg: 1 }))).toBe(false);
  });
});
