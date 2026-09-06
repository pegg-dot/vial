import { describe, expect, it } from "vitest";
import { independentPurityByVendor, independentTestCountByVendor, isSuspicious, pickTopListings, splitByRankability, type PickKey } from "@/lib/market-picks";
import type { Product } from "@/lib/types";

// Minimal listing fixture — only the fields the pick logic reads carry meaning.
function listing(o: { slug: string; vendor: string; perMg?: number; adjusted?: number | null; tooCheap?: boolean; evidence?: string; batchLinked?: boolean; observedAt?: string }): Product {
  return {
    slug: o.slug, name: o.slug, compoundSlug: "test-compound", vendorSlug: o.vendor, quantity: "5mg",
    mg: 5, pricePerMg: o.perMg, form: "vial", price: (o.perMg ?? 0) * 5, currency: "USD",
    availability: "In stock", shipping: "", evidenceLevel: o.evidence ?? "public-only", evidenceLabel: "",
    reportDate: "", reportIssuer: "", reportConfirmed: false, batchCode: "", batchLinked: o.batchLinked ?? false,
    sampleOrigin: "", lastChecked: "", rating: 0, reviewCount: 0, observedAt: o.observedAt,
    trust: {
      status: "unverified", tone: "neutral", label: "", detail: "",
      priceFlag: o.tooCheap ? "too-cheap" : null, priceNote: null,
      compoundCoas: 0, compoundMedianPurity: null,
      adjustedPricePerMg: o.adjusted ?? null, purityBasis: null,
    },
  } as unknown as Product;
}

const winner = (picks: ReturnType<typeof pickTopListings>, key: PickKey) =>
  picks.find((p) => p.wins.some((w) => w.key === key));

describe("pickTopListings", () => {
  it("cheapest pick skips a too-cheap-flagged listing", () => {
    const picks = pickTopListings([
      listing({ slug: "scam", vendor: "v1", perMg: 1, tooCheap: true }),
      listing({ slug: "legit", vendor: "v2", perMg: 4 }),
    ], []);
    expect(winner(picks, "cheapest")?.product.slug).toBe("legit");
  });

  it("best value is the lowest REAL cost per active mg, not the lowest sticker", () => {
    const picks = pickTopListings([
      listing({ slug: "cheap-dirty", vendor: "v1", perMg: 4, adjusted: 5.0 }),
      listing({ slug: "pricier-pure", vendor: "v2", perMg: 4.5, adjusted: 4.6 }),
    ], []);
    expect(winner(picks, "best-value")?.product.slug).toBe("pricier-pure");
  });

  it("purity pick uses independent tests only — a vendor's own 100% never wins", () => {
    const picks = pickTopListings([
      listing({ slug: "a", vendor: "self-tested", perMg: 4 }),
      listing({ slug: "b", vendor: "indie-tested", perMg: 5 }),
    ], [
      { vendor_slug: "self-tested", purity_pct: 100, is_independent: false },
      { vendor_slug: "indie-tested", purity_pct: 99.2, is_independent: true },
    ]);
    expect(winner(picks, "purity")?.product.slug).toBe("b");
    expect(winner(picks, "purity")?.wins.find((w) => w.key === "purity")?.why).toContain("99.2");
  });

  it("a product that wins several categories shows ONCE, wearing every stamp it earned", () => {
    const picks = pickTopListings([
      listing({ slug: "winner", vendor: "v1", perMg: 3, adjusted: 3.1 }),
      listing({ slug: "other", vendor: "v2", perMg: 8, adjusted: 8.2 }),
    ], [{ vendor_slug: "v1", purity_pct: 99.9, is_independent: true }]);
    const w = picks.find((p) => p.product.slug === "winner");
    expect(picks.filter((p) => p.product.slug === "winner")).toHaveLength(1);
    expect(w?.wins.map((x) => x.key).sort()).toEqual(["best-value", "cheapest", "most-tested", "purity"].sort());
  });

  it("fallback categories fill the freed slots so the row doesn't run thin", () => {
    // cheapest+best-value collapse onto one product; best-documented and freshest fill the row.
    const picks = pickTopListings([
      listing({ slug: "star", vendor: "v1", perMg: 3, adjusted: 3.1 }),
      listing({ slug: "papered", vendor: "v2", perMg: 6, evidence: "independent", batchLinked: true }),
      listing({ slug: "fresh", vendor: "v3", perMg: 7, observedAt: "2026-09-02T12:00:00Z" }),
      listing({ slug: "stale", vendor: "v4", perMg: 5, observedAt: "2026-01-01T00:00:00Z" }),
    ], []);
    expect(picks.length).toBeGreaterThanOrEqual(3);
    expect(winner(picks, "best-documented")?.product.slug).toBe("papered");
    expect(winner(picks, "freshest")?.product.slug).toBe("fresh");
  });

  it("a deep market fills all five slots, backfilled with honest leaderboard ranks", () => {
    const many = Array.from({ length: 8 }, (_, i) => listing({ slug: `l${i}`, vendor: `v${i}`, perMg: 3 + i }));
    const picks = pickTopListings(many, []);
    expect(picks).toHaveLength(5);
    // Only "cheapest" wins a category here, so four slots backfill with rank stamps that state
    // the listing's REAL position in the per-mg table.
    const rankWins = picks.flatMap((p) => p.wins.filter((w) => w.key === "rank"));
    expect(rankWins).toHaveLength(4);
    expect(rankWins.map((w) => w.label)).toEqual(["#2 by price", "#3 by price", "#4 by price", "#5 by price"]);
    expect(rankWins[0].why).toContain("of 8 listings");
  });

  it("never shows more than five products", () => {
    const many = Array.from({ length: 12 }, (_, i) => listing({ slug: `l${i}`, vendor: `v${i}`, perMg: 3 + i, observedAt: `2026-08-${10 + i}T00:00:00Z`, evidence: i === 7 ? "independent" : undefined, batchLinked: i === 7 }));
    const picks = pickTopListings(many, [{ vendor_slug: "v9", purity_pct: 99, is_independent: true }]);
    expect(picks.length).toBeLessThanOrEqual(5);
    // Every card's CATEGORY stamps are genuine wins — no category appears on two products.
    // (Rank stamps are exempt: each states a distinct table position by construction.)
    const keys = picks.flatMap((p) => p.wins.map((w) => w.key).filter((k) => k !== "rank"));
    expect(new Set(keys).size).toBe(keys.length);
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

// /compounds/mots-c listed 40 listings in its own heading and put 30 in the comparison table. The
// ten missing ones were real vendors — Behemoth Labz, Cernum, Simple Peptide — dropped for having
// no published strength, which made them unreachable from the page rather than merely unsortable.
describe("splitByRankability", () => {
  it("accounts for every listing handed in", () => {
    const listings = [
      listing({ slug: "a", vendor: "v1", perMg: 3 }),
      listing({ slug: "b", vendor: "v2" }),                    // no per-mg: "1 vial", no strength
      listing({ slug: "c", vendor: "v3", perMg: 1 }),
      listing({ slug: "d", vendor: "v4" }),
    ];
    const { ranked, unranked } = splitByRankability(listings);
    expect(ranked.length + unranked.length).toBe(listings.length);
    expect([...ranked, ...unranked].map((p) => p.slug).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("orders the rankable ones cheapest per mg first", () => {
    const { ranked } = splitByRankability([
      listing({ slug: "dear", vendor: "v1", perMg: 9 }),
      listing({ slug: "cheap", vendor: "v2", perMg: 2 }),
      listing({ slug: "mid", vendor: "v3", perMg: 5 }),
    ]);
    expect(ranked.map((p) => p.slug)).toEqual(["cheap", "mid", "dear"]);
  });

  it("keeps a listing whose price we know but whose size we cannot read", () => {
    const { ranked, unranked } = splitByRankability([listing({ slug: "sized", vendor: "v1", perMg: 4 }), listing({ slug: "vial-only", vendor: "v2" })]);
    expect(ranked.map((p) => p.slug)).toEqual(["sized"]);
    expect(unranked.map((p) => p.slug)).toEqual(["vial-only"]);
  });

  it("treats a zero or negative per-mg as unrankable rather than cheapest", () => {
    // A $0.00/mg row sorting to the top of a "cheapest" table is the failure this guards.
    const { ranked, unranked } = splitByRankability([listing({ slug: "zero", vendor: "v1", perMg: 0 }), listing({ slug: "real", vendor: "v2", perMg: 6 })]);
    expect(ranked.map((p) => p.slug)).toEqual(["real"]);
    expect(unranked.map((p) => p.slug)).toEqual(["zero"]);
  });
});
