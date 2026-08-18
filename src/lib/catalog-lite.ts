import type { CatalogSnapshot, Compound, DataOrigin, Product, Vendor } from "./types";

// The catalog projection the ROOT LAYOUT ships.
//
// The layout wraps every route on the site, so whatever it hands `MarketplaceProvider` is
// serialized into the HTML of every page — including pages that render no catalog data at all.
// It used to hand over the whole `CatalogSnapshot`: ~580 listings with their price histories,
// evidence dimensions and trust objects, ~95 vendors with their full history feeds and grade
// prose, ~60 compounds with descriptions and research notes. That put well over a megabyte of
// JSON into /about, /grades and every /legal page, on every view and every crawler hit, to
// render nothing.
//
// Only four global surfaces actually read the catalog on a page that isn't the market:
//   • the ⌘K search overlay      (marketplace-state.tsx)
//   • the compare dock            (marketplace-state.tsx)
//   • the header's saved counter   (site-header.tsx — reads watchlist, validated against slugs)
//   • the market card             (product-card.tsx — vendor name/grade + compound median $/mg)
// Everything below is the exact union of what those four read. Nothing is here "just in case":
// a field that no global surface renders is a field every page pays for and no page uses.
//
// Pages that genuinely need whole records — /market, /compounds, /watchlist — take the full
// `CatalogSnapshot` as a prop from their own server component instead.

// Phantom brand. It never exists at runtime (a `unique symbol` key cannot be produced by
// `getCatalogSnapshot`), so a full `CatalogSnapshot` is NOT assignable to `CatalogLite` even
// though it structurally has every field. That is the point: without the brand, a future edit
// could pass the whole catalog straight back into the provider and TypeScript would accept it,
// silently restoring the megabyte. `toCatalogLite` is the only way to mint one.
declare const CATALOG_LITE_BRAND: unique symbol;

export interface CompoundLite {
  slug: string;
  name: string;
  shorthand: string;
  aliases: string[];
  listings: number;
  coaCount: number;
  /** Only the first colour is ever read (search result mark), so only the first is shipped. */
  accent: readonly [string, ...string[]];
  /** The market baseline behind the market card's "+N% vs median/mg" line. */
  medianPricePerMg: number | null;
  origin: DataOrigin;
}

export interface VendorLite {
  slug: string;
  name: string;
  initials: string;
  accent: readonly [string, ...string[]];
  productCount: number;
  coaCount: number;
  origin: DataOrigin;
  /**
   * Exactly the three fields `VialGradePill` renders: the letter, the band that colours it, and
   * the rationale it shows as a tooltip. The stored grade also carries a headline, a summary, a
   * weighed count and a verified count — those are read only by the full grade card on the vendor
   * and product pages, which load the vendor record themselves.
   */
  grade: { letter: string | null; band: string; rationale: string } | null;
}

export interface ProductLite {
  slug: string;
  name: string;
  quantity: string;
  vendorSlug: string;
  price: number;
  evidenceLabel: string;
  accent: readonly [string, ...string[]];
  featured?: boolean;
  origin: DataOrigin;
}

export interface CatalogLite {
  readonly [CATALOG_LITE_BRAND]: "catalog-lite";
  compounds: CompoundLite[];
  vendors: VendorLite[];
  products: ProductLite[];
  generatedAt: string;
}

// Pinned field sets. tests/unit/catalog-lite.test.ts asserts the projection emits exactly these
// keys and no others, so re-widening the payload cannot happen quietly: adding a field to a lite
// record means changing this list, in the diff, on purpose.
export const COMPOUND_LITE_FIELDS = ["slug", "name", "shorthand", "aliases", "listings", "coaCount", "accent", "medianPricePerMg", "origin"] as const;
export const VENDOR_LITE_FIELDS = ["slug", "name", "initials", "accent", "productCount", "coaCount", "origin", "grade"] as const;
export const PRODUCT_LITE_FIELDS = ["slug", "name", "quantity", "vendorSlug", "price", "evidenceLabel", "accent", "featured", "origin"] as const;
export const VENDOR_LITE_GRADE_FIELDS = ["letter", "band", "rationale"] as const;

function toCompoundLite(compound: Compound): CompoundLite {
  return {
    slug: compound.slug,
    name: compound.name,
    shorthand: compound.shorthand,
    aliases: compound.aliases,
    listings: compound.listings,
    coaCount: compound.coaCount,
    accent: [compound.accent[0]],
    medianPricePerMg: compound.medianPricePerMg,
    origin: compound.origin,
  };
}

function toVendorLite(vendor: Vendor): VendorLite {
  return {
    slug: vendor.slug,
    name: vendor.name,
    initials: vendor.initials,
    accent: [vendor.accent[0]],
    productCount: vendor.productCount,
    coaCount: vendor.coaCount,
    origin: vendor.origin,
    grade: vendor.grade ? { letter: vendor.grade.letter, band: vendor.grade.band, rationale: vendor.grade.rationale } : null,
  };
}

function toProductLite(product: Product): ProductLite {
  return {
    slug: product.slug,
    name: product.name,
    quantity: product.quantity,
    vendorSlug: product.vendorSlug,
    price: product.price,
    evidenceLabel: product.evidenceLabel,
    accent: [product.accent[0]],
    featured: product.featured,
    origin: product.origin,
  };
}

/** Narrow a full catalog snapshot down to what the site-wide chrome renders. */
export function toCatalogLite(catalog: CatalogSnapshot): CatalogLite {
  return {
    compounds: catalog.compounds.map(toCompoundLite),
    vendors: catalog.vendors.map(toVendorLite),
    products: catalog.products.map(toProductLite),
    generatedAt: catalog.generatedAt,
  } as CatalogLite;
}

/**
 * What the layout ships when the database is unreachable. The chrome goes quiet — the search
 * overlay finds nothing, the compare dock stays empty — and every static page still renders.
 * Never a fabricated record: absent data stays absent.
 */
export function emptyCatalogLite(generatedAt: string): CatalogLite {
  // Minted through the same projection as everything else, so there is exactly one place in the
  // codebase that can produce a CatalogLite.
  return toCatalogLite({ compounds: [], vendors: [], products: [], generatedAt });
}
