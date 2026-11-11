import { describe, expect, it } from "vitest";
import { projectCatalog, projectCompound, projectDirectoryEntry, projectMarketCatalog, projectMarketDirectoryEntry, projectMarketProduct, projectVendor } from "@/lib/evidence-projection";
import type { CatalogSnapshot, Compound, Product, Vendor } from "@/lib/types";
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
    const e = projectDirectoryEntry({ vendor, priceIndex: -30, pricedListings: 9, enforcement: "caution", defunct: false, integrityFlagged: true, reviewSentiment: "scam", websiteUrl: "https://acme.example/", verdict: "caution", redFlag: false } as unknown as VendorDirectoryEntry);
    expect([e.priceIndex, e.pricedListings, e.reviewSentiment]).toEqual([null, 0, null]);
    expect([e.enforcement, e.integrityFlagged]).toEqual(["caution", true]);
    // The storefront link is governed by its own release rule, not by the commerce projection.
    expect(e.websiteUrl).toBe("https://acme.example/");
    expect(JSON.stringify(e)).not.toMatch(/price reduced|-30/);
  });

  it("does not mutate its input", () => {
    projectCompound(compound); projectVendor(vendor);
    expect(compound.medianPrice).toBe(49.5);
    expect(vendor.history).toHaveLength(2);
  });
});

describe("market-record projections", () => {
  const product = { slug: "acme-bpc-5", name: "BPC-157 5mg", compoundSlug: "bpc-157", vendorSlug: "acme", quantity: "5mg", mg: 5, pricePerMg: 12.2, price: 61,
    availability: "In stock", observedAt: "2026-11-02T10:00:00.000Z", lastChecked: "2 days ago", pricePoints: [{ day: "2026-11-02", price: 61 }],
    externalUrl: "https://shop.example/x?ref=vg", imageUrl: "https://shop.example/x.jpg", rating: 4.8, reviewCount: 212, shipping: "Ships free in 2 days",
    featured: true, checkoutMode: "outbound" } as unknown as Product;

  it("listing: what it was, what it cost and when it was read stay; the URL, photo, ratings, shipping and checkout mode go", () => {
    const p = projectMarketProduct(product);
    expect([p.slug, p.name, p.vendorSlug, p.compoundSlug, p.quantity, p.mg, p.price, p.pricePerMg, p.availability, p.observedAt]).toEqual(
      ["acme-bpc-5", "BPC-157 5mg", "acme", "bpc-157", "5mg", 5, 61, 12.2, "In stock", "2026-11-02T10:00:00.000Z"]);
    expect([p.externalUrl, p.imageUrl, p.rating, p.reviewCount, p.shipping, p.featured, p.checkoutMode]).toEqual([undefined, undefined, 0, 0, "", undefined, "information-only"]);
    for (const key of ["externalUrl", "imageUrl", "featured"]) expect(key in p).toBe(false);
    expect(JSON.stringify(p)).not.toMatch(/shop\.example|ref=vg|4\.8|212|Ships free|outbound/);
  });

  it("catalog: compounds keep their price figures, listings are projected, no vendor record leaves the server", () => {
    const snapshot = { compounds: [compound], vendors: [vendor], products: [product], generatedAt: "t" } as unknown as CatalogSnapshot;
    const p = projectMarketCatalog(snapshot);
    expect([p.compounds[0].listings, p.compounds[0].medianPrice]).toEqual([12, 49.5]);
    expect(p.products).toHaveLength(1);
    expect(p.products[0].price).toBe(61);
    expect(p.vendors).toEqual([]);
    expect(JSON.stringify(p)).not.toMatch(/shop\.example|Ships free/);
  });

  it("directory entry: listing count and price index stay, buyer sentiment and review figures go", () => {
    const e = projectMarketDirectoryEntry({ vendor, priceIndex: -30, pricedListings: 9, enforcement: "caution", defunct: false, integrityFlagged: true, reviewSentiment: "scam", websiteUrl: "https://acme.example/", verdict: "caution" as never, redFlag: false });
    expect([e.priceIndex, e.pricedListings, e.vendor.productCount]).toEqual([-30, 9, 40]);
    expect([e.reviewSentiment, e.vendor.reviewCount, e.vendor.supportScore, e.vendor.medianShipDays]).toEqual([null, 0, 0, 0]);
    expect([e.enforcement, e.integrityFlagged, e.websiteUrl, e.vendor.coaCount]).toEqual(["caution", true, "https://acme.example/", 5]);
  });

  it("does not mutate its input", () => {
    projectMarketProduct(product); projectMarketDirectoryEntry({ vendor, priceIndex: 1, pricedListings: 1, enforcement: null, defunct: false, integrityFlagged: false, reviewSentiment: "positive", websiteUrl: null, verdict: "caution" as never, redFlag: false });
    expect([product.externalUrl, product.rating, vendor.reviewCount]).toEqual(["https://shop.example/x?ref=vg", 4.8, 22]);
  });
});
