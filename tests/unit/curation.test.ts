import { describe, expect, it } from "vitest";
import { compoundTrustTier, trending, mostVerified, bestValue, compoundPriceRange, listingMarketStats, median, vendorPriceIndex, compoundMedianPerMg, valueVsMarketPerMg, MIN_PERMG_PEERS } from "@/lib/curation";

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
  it("compoundPriceRange returns the min price, and counts listings and vendors apart", () => {
    // The fixture deliberately gives one vendor two listings: conflating the two counts is what
    // made the ticker card advertise 39 vendors for BPC-157 when 14 sell it.
    const p = (compoundSlug: string, price: number, vendorSlug: string) => ({ compoundSlug, price, vendorSlug } as never);
    expect(compoundPriceRange("bpc-157", [p("bpc-157", 40, "acme"), p("bpc-157", 55, "acme"), p("tb-500", 10, "zenith")]))
      .toEqual({ from: 40, count: 2, vendors: 1 });
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
  it("vendorPriceIndex reports how a vendor's $/mg compares to the market median (markets with enough peers)", () => {
    const all = [
      { compoundSlug: "bpc-157", pricePerMg: 4 }, { compoundSlug: "bpc-157", pricePerMg: 5 }, { compoundSlug: "bpc-157", pricePerMg: 6 }, // median 5, 3 listings
      { compoundSlug: "tb-500", pricePerMg: 10 }, { compoundSlug: "tb-500", pricePerMg: 15 }, { compoundSlug: "tb-500", pricePerMg: 20 }, // median 15, 3 listings
    ] as never;
    // vendor sells bpc at 4 (−20% vs 5) and tb-500 at 12 (−20% vs 15) → median −20%
    const idx = vendorPriceIndex([{ compoundSlug: "bpc-157", pricePerMg: 4 }, { compoundSlug: "tb-500", pricePerMg: 12 }] as never, all);
    expect(idx).toEqual({ medianPctVsMarket: -20, comparedCount: 2 });
  });

  it("vendorPriceIndex WITHHOLDS a verdict on a thin market (< min peers) — matches the compound-page floor", () => {
    // Only 2 priced listings market-wide → no real 'typical price' → no confident +/-% verdict.
    const all = [{ compoundSlug: "x", pricePerMg: 4 }, { compoundSlug: "x", pricePerMg: 6 }] as never;
    expect(vendorPriceIndex([{ compoundSlug: "x", pricePerMg: 4 }] as never, all)).toEqual({ medianPctVsMarket: null, comparedCount: 0 });
  });
  it("vendorPriceIndex returns null when nothing is comparable", () => {
    expect(vendorPriceIndex([{ compoundSlug: "x", pricePerMg: undefined }] as never, [] as never)).toEqual({ medianPctVsMarket: null, comparedCount: 0 });
  });

  describe("compoundMedianPerMg — the per-mg baseline, with a min-peer guard", () => {
    it("returns the median $/mg once there are enough size-readable peers", () => {
      expect(compoundMedianPerMg([2, 4, 6])).toBe(4);
    });
    it("fails toward null below the peer floor (no thin-market verdict)", () => {
      expect(compoundMedianPerMg([2, 4])).toBeNull();
      expect(compoundMedianPerMg([])).toBeNull();
    });
    it("counts only readable sizes (drops zero/negative before the count)", () => {
      // two real per-mg values + junk → still under the floor of 3 → null
      expect(compoundMedianPerMg([5, 0, -3, 7])).toBeNull();
      expect(compoundMedianPerMg([5, 0, 7, 9])).toBe(7);
    });
    it("MIN_PERMG_PEERS is the shared floor", () => {
      expect(MIN_PERMG_PEERS).toBe(3);
      expect(compoundMedianPerMg([1, 2, 3], MIN_PERMG_PEERS)).toBe(2);
    });
  });

  describe("valueVsMarketPerMg — the size-honest 'vs market' verdict", () => {
    it("scores against cost-per-mg, not sticker price", () => {
      expect(valueVsMarketPerMg(1.2, 1.0)).toBe(20);   // 20% pricier per mg
      expect(valueVsMarketPerMg(0.6, 1.0)).toBe(-40);  // 40% cheaper per mg
    });
    it("a big-vial bargain reads GREEN and a small-vial ripoff reads RED — the size bug, cured", () => {
      const medianPerMg = 4; // typical $/mg for the compound
      // 30mg vial at $60 → $2/mg → well below typical → negative (good), even though $60 sticker is high
      expect(valueVsMarketPerMg(2, medianPerMg)).toBeLessThan(0);
      // 2mg vial at $40 → $20/mg → far above typical → positive (bad), even though $40 sticker is low
      expect(valueVsMarketPerMg(20, medianPerMg)).toBeGreaterThan(0);
    });
    it("FAILS TOWARD UNKNOWN — no verdict when the size is unreadable", () => {
      expect(valueVsMarketPerMg(undefined, 1.0)).toBeNull();
      expect(valueVsMarketPerMg(null, 1.0)).toBeNull();
      expect(valueVsMarketPerMg(0, 1.0)).toBeNull();
    });
    it("no verdict when the compound has no per-mg baseline (thin market)", () => {
      expect(valueVsMarketPerMg(1.2, null)).toBeNull();
      expect(valueVsMarketPerMg(1.2, 0)).toBeNull();
    });
  });
});
