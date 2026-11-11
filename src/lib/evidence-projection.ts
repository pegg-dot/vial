import type { CatalogSnapshot, Compound, Product, Vendor } from "./types";
import type { VendorDirectoryEntry } from "./vendor-ranking";

/**
 * Server-side projections for the evidence-only release. Props passed to a client component are
 * serialized into the page, so hiding a price in the markup is not enough: the data itself must not
 * leave the server. Each function returns a copy with every price, listing, review and catalog-history
 * field neutralized, keeping the evidence fields (lab tests, purity, grades, regulatory flags).
 */
export function projectCompound(c: Compound): Compound {
  return { ...c, listings: 0, medianPrice: 0, medianPricePerMg: null, priceChange: 0, priceChangeBasis: null };
}

export function projectCatalog(catalog: CatalogSnapshot): CatalogSnapshot {
  return { generatedAt: catalog.generatedAt, compounds: catalog.compounds.map(projectCompound), vendors: [], products: [] };
}

export function projectVendor(v: Vendor): Vendor {
  return {
    ...v, productCount: 0, medianShipDays: 0, supportScore: 0, reviewCount: 0,
    history: v.history.filter((h) => h.type !== "catalog"),
  };
}

export function projectDirectoryEntry(e: VendorDirectoryEntry): VendorDirectoryEntry {
  return { ...e, vendor: projectVendor(e.vendor), priceIndex: null, pricedListings: 0, reviewSentiment: null };
}

/**
 * The market-record projections, for the evidence-only release with VIALGRADE_MARKET_RECORDS on.
 * What a listing was, what it cost and when it was read leave the server. Everything else about a
 * listing stays behind: the listing URL (a citation is built on the server, per vendor, by
 * listingSourceUrl), the vendor's photo, buyer ratings and review counts, shipping claims, the
 * checkout mode and the featured flag.
 */
export function projectMarketProduct(p: Product): Product {
  // The optional fields are removed, not set to undefined, so the keys never reach the payload.
  const { externalUrl, imageUrl, featured, ...kept } = p;
  void externalUrl; void imageUrl; void featured;
  return { ...kept, rating: 0, reviewCount: 0, shipping: "", checkoutMode: "information-only" };
}

export function projectMarketCatalog(catalog: CatalogSnapshot): CatalogSnapshot {
  return { generatedAt: catalog.generatedAt, compounds: catalog.compounds, vendors: [], products: catalog.products.map(projectMarketProduct) };
}

/** Listing counts and the price index stay; buyer sentiment, review, support and shipping figures go. */
export function projectMarketDirectoryEntry(e: VendorDirectoryEntry): VendorDirectoryEntry {
  return { ...e, vendor: { ...e.vendor, medianShipDays: 0, supportScore: 0, reviewCount: 0 }, reviewSentiment: null };
}
