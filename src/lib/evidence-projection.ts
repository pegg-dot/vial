import type { CatalogSnapshot, Compound, Vendor } from "./types";
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
