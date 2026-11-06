import { describe, expect, it } from "vitest";
import { projectCatalog, projectCompound, projectDirectoryEntry, projectVendor } from "@/lib/evidence-projection";
import type { CatalogSnapshot, Compound, Vendor } from "@/lib/types";
import type { VendorDirectoryEntry } from "@/lib/vendor-ranking";

const compound = { slug: "bpc-157", name: "BPC-157", listings: 12, medianPrice: 49.5, medianPricePerMg: 9.9, priceChange: -3, priceChangeBasis: { medianPct: -3 }, coaCount: 7, medianPurity: 98.1, documentationCoverage: 0.7 } as unknown as Compound;
const vendor = { slug: "acme", name: "Acme", productCount: 40, medianShipDays: 3, supportScore: 80, reviewCount: 22, coaCount: 5, medianPurity: 97.4, passportCount: 2, latestTestedAt: "2026-09-01",
  history: [{ date: "2026-07-10", event: "KPV price reduced", type: "catalog" }, { date: "2026-06-01", event: "New lab report", type: "document" }], grade: { letter: "B" } } as unknown as Vendor;

describe("evidence-only projections", () => {
  it("compound: price, listing and change fields are neutral, evidence stays", () => {
    const p = projectCompound(compound);
    expect([p.listings, p.medianPrice, p.medianPricePerMg, p.priceChange, p.priceChangeBasis]).toEqual([0, 0, null, 0, null]);
    expect([p.coaCount, p.medianPurity, p.name]).toEqual([7, 98.1, "BPC-157"]);
  });

  it("catalog: no products and no vendors leave the server", () => {
    const snapshot = { compounds: [compound], vendors: [vendor], products: [{ slug: "x", price: 61, url: "https://shop.example/x" }], generatedAt: "t" } as unknown as CatalogSnapshot;
    const p = projectCatalog(snapshot);
    expect(p.products).toEqual([]);
    expect(p.vendors).toEqual([]);
    expect(JSON.stringify(p)).not.toMatch(/61|shop\.example|49\.5|"price"/);
  });

  it("vendor: catalog history and commerce counters are dropped, evidence and grade stay", () => {
    const p = projectVendor(vendor);
    expect(p.history.map(h => h.type)).toEqual(["document"]);
    expect([p.productCount, p.reviewCount, p.supportScore, p.medianShipDays]).toEqual([0, 0, 0, 0]);
    expect([p.coaCount, p.medianPurity, p.grade?.letter]).toEqual([5, 97.4, "B"]);
  });

  it("directory entry: price index, priced listings and sentiment are removed", () => {
    const e = projectDirectoryEntry({ vendor, priceIndex: -30, pricedListings: 9, enforcement: "caution", defunct: false, integrityFlagged: true, reviewSentiment: "scam", verdict: "caution", redFlag: false } as unknown as VendorDirectoryEntry);
    expect([e.priceIndex, e.pricedListings, e.reviewSentiment]).toEqual([null, 0, null]);
    expect([e.enforcement, e.integrityFlagged]).toEqual(["caution", true]);
    expect(JSON.stringify(e)).not.toMatch(/price reduced|-30/);
  });

  it("does not mutate its input", () => {
    projectCompound(compound); projectVendor(vendor);
    expect(compound.medianPrice).toBe(49.5);
    expect(vendor.history).toHaveLength(2);
  });
});
