import { describe, expect, it } from "vitest";
import { compoundTrustTier, trending, mostVerified, bestValue, compoundPriceRange, listingMarketStats, median, vendorPriceIndex } from "@/lib/curation";

const C = (o: Partial<{ slug: string; coaCount: number; medianPurity: number | null; listings: number; priceChange: number }>) =>
  ({ slug: "x", coaCount: 0, medianPurity: null, listings: 0, priceChange: 0, ...o } as never);

describe("curation", () => {
  it("tiers a compound with independent COAs as independent, with reasons", () => {
    const t = compoundTrustTier(C({ coaCount: 3, medianPurity: 99.4 }));
    expect(t.tier).toBe("independent");
    expect(t.reasons.join(" ")).toMatch(/3 independent/i);
  });
  it("tiers a compound with listings but no COAs as vendor-tested", () => {
    expect(compoundTrustTier(C({ coaCount: 0, listings: 4 })).tier).toBe("vendor");
  });
  it("tiers a compound with nothing as none", () => {
    expect(compoundTrustTier(C({ coaCount: 0, listings: 0 })).tier).toBe("none");
  });
  it("ranks Tier-1 compounds ahead of an equal-signal non-tier-1 one", () => {
    const out = trending([C({ slug: "obscure", listings: 5, coaCount: 1 }), C({ slug: "bpc-157", listings: 5, coaCount: 1 })]);
    expect(out[0].slug).toBe("bpc-157");
  });
  it("mostVerified ranks by independent COA count then purity", () => {
    const out = mostVerified([C({ slug: "a", coaCount: 1, medianPurity: 99 }), C({ slug: "b", coaCount: 5, medianPurity: 98 })]);
    expect(out[0].slug).toBe("b");
  });
  it("bestValue ranks by ascending price-per-mg and skips listings without one", () => {
    const p = (slug: string, pricePerMg?: number) => ({ slug, pricePerMg } as never);
    const out = bestValue([p("hi", 5), p("lo", 2), p("none", undefined)]);
    expect(out.map((x) => x.slug)).toEqual(["lo", "hi"]);
  });
  it("compoundPriceRange returns the min listing price for the compound", () => {
    const p = (compoundSlug: string, price: number) => ({ compoundSlug, price } as never);
    expect(compoundPriceRange("bpc-157", [p("bpc-157", 40), p("bpc-157", 55), p("tb-500", 10)])).toEqual({ from: 40, count: 2 });
  });
  it("median handles odd and even sets and ignores non-positive", () => {
    expect(median([40, 50, 60])).toBe(50);
    expect(median([40, 60])).toBe(50);
    expect(median([0, 50])).toBe(50);
    expect(median([])).toBeNull();
  });
  it("listingMarketStats places a listing in its compound market", () => {
    const s = listingMarketStats(65, [34, 42, 49, 65, 80]);
    expect(s).toMatchObject({ count: 5, low: 34, high: 80, med: 49, rank: 4 });
    expect(s.positionPct).toBe(67); // (65-34)/(80-34)
    expect(s.vsMedianPct).toBe(33); // (65-49)/49
  });
  it("listingMarketStats handles a lone listing (no range)", () => {
    const s = listingMarketStats(65, [65]);
    expect(s).toMatchObject({ count: 1, low: 65, high: 65, med: 65, rank: 1, positionPct: 0, vsMedianPct: 0 });
  });
  it("vendorPriceIndex reports how a vendor's $/mg compares to the market median", () => {
    const all = [
      { compoundSlug: "bpc-157", pricePerMg: 4 }, { compoundSlug: "bpc-157", pricePerMg: 6 }, // market median 5
      { compoundSlug: "tb-500", pricePerMg: 10 }, { compoundSlug: "tb-500", pricePerMg: 20 }, // market median 15
    ] as never;
    // vendor sells bpc at 4 (−20% vs 5) and tb-500 at 12 (−20% vs 15) → median −20%
    const idx = vendorPriceIndex([{ compoundSlug: "bpc-157", pricePerMg: 4 }, { compoundSlug: "tb-500", pricePerMg: 12 }] as never, all);
    expect(idx).toEqual({ medianPctVsMarket: -20, comparedCount: 2 });
  });
  it("vendorPriceIndex returns null when nothing is comparable", () => {
    expect(vendorPriceIndex([{ compoundSlug: "x", pricePerMg: undefined }] as never, [] as never)).toEqual({ medianPctVsMarket: null, comparedCount: 0 });
  });
});
