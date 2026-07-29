import { describe, expect, it } from "vitest";
import { PRIORITIES, rankVendors, type VendorDirectoryEntry } from "@/lib/vendor-ranking";

const entry = (o: Partial<{ slug: string; coaCount: number; medianPurity: number | null; reviewCount: number; latestTestedAt: string | null; priceIndex: number | null; reviewSentiment: VendorDirectoryEntry["reviewSentiment"]; redFlag: boolean; passportCount: number }>): VendorDirectoryEntry => ({
  vendor: { slug: o.slug ?? "v", name: o.slug ?? "v", coaCount: o.coaCount ?? 0, medianPurity: o.medianPurity ?? null, reviewCount: o.reviewCount ?? 0, latestTestedAt: o.latestTestedAt ?? null, passportCount: o.passportCount ?? 0 } as never,
  priceIndex: o.priceIndex ?? null,
  pricedListings: o.priceIndex != null ? 3 : 0,
  enforcement: null,
  defunct: false,
  integrityFlagged: false,
  reviewSentiment: o.reviewSentiment ?? null,
  redFlag: o.redFlag ?? false,
});

const names = (list: VendorDirectoryEntry[]) => list.map((e) => e.vendor.slug);

describe("vendor-ranking", () => {
  it("exposes the fact-based priorities with 'reliable' first (the safe default)", () => {
    expect(PRIORITIES[0].key).toBe("reliable");
    expect(PRIORITIES.map((p) => p.key)).toEqual(["reliable", "price", "purity", "tested", "reputation"]);
  });
  it("price ranks the cheapest-vs-market first, missing $/mg last", () => {
    const out = rankVendors([entry({ slug: "mid", priceIndex: 0 }), entry({ slug: "cheap", priceIndex: -30 }), entry({ slug: "none" }), entry({ slug: "dear", priceIndex: 20 })], "price");
    expect(names(out)).toEqual(["cheap", "mid", "dear", "none"]);
  });
  it("purity ranks highest median purity first, untested last", () => {
    const out = rankVendors([entry({ slug: "a", medianPurity: 98 }), entry({ slug: "b", medianPurity: 99.5 }), entry({ slug: "untested" })], "purity");
    expect(names(out)).toEqual(["b", "a", "untested"]);
  });
  it("tested ranks by COA count", () => {
    const out = rankVendors([entry({ slug: "few", coaCount: 2 }), entry({ slug: "many", coaCount: 40 }), entry({ slug: "none" })], "tested");
    expect(names(out)).toEqual(["many", "few", "none"]);
  });
  it("reliable favors tested + pure + well-reviewed vendors", () => {
    const out = rankVendors([entry({ slug: "bare" }), entry({ slug: "solid", coaCount: 10, medianPurity: 99.2, reviewSentiment: "positive", reviewCount: 8 })], "reliable");
    expect(names(out)[0]).toBe("solid");
  });
  it("red-flag vendors always sink to the bottom, even when cheapest", () => {
    const out = rankVendors([entry({ slug: "scam-cheap", priceIndex: -80, redFlag: true }), entry({ slug: "honest", priceIndex: -10 })], "price");
    expect(names(out)).toEqual(["honest", "scam-cheap"]);
  });
});
