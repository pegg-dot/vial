// WooCommerce catalog importer — the second breadth loophole.
//
// Most peptide vendors that AREN'T on Shopify run WooCommerce, which exposes its whole catalog
// (products + prices) at the public /wp-json/wc/store/v1/products Store API — no HTML scraping.
// One paginated fetch yields a vendor's real catalog. We map each product name to a canonical
// compound and record the vendor's declared price as an honest observation (origin='live').

import type { SqlConnection } from "@/server/db/client";
import { upsertLiveVendor } from "./live-sources";
import { matchCompound, recordAllSizes, type Candidate, type CompoundRef, type ImportResult } from "./shopify-import";
import { detectAdvertisedTesting } from "./storefront-coa";

const UA = "VialGrade-Catalog-Import/1.0 (+https://vial.local/how-we-check)";
const PRICE_MIN = 5;
const PRICE_MAX = 2000;

export interface WooProduct {
  name: string;
  permalink: string;
  type: string;
  is_in_stock: boolean;
  prices: { price: string | null; price_range: { min_amount: string } | null; currency_minor_unit: number } | null;
  images?: { src?: string }[];
  // The Store API returns the product body. Vendors state their testing claim here — no Woo
  // storefront in the tracked set publishes a per-product verify link, so the claim is the signal.
  description?: string;
  short_description?: string;
}

// First usable image URL from a WooCommerce product (the Store API returns full-size srcs).
export function wooImage(p: WooProduct): string | undefined {
  const src = p.images?.find((i) => i.src && /^https?:\/\//i.test(i.src))?.src;
  return src ? src.replace(/^http:\/\//i, "https://") : undefined;
}

/** Fetch a WooCommerce vendor's catalog via the public Store API, paginating up to `maxPages`. */
export async function fetchWooProducts(domain: string, maxPages = 6): Promise<WooProduct[] | null> {
  for (const base of [`https://${domain}`, `https://www.${domain}`]) {
    const all: WooProduct[] = [];
    for (let page = 1; page <= maxPages; page++) {
      try {
        const res = await fetch(`${base}/wp-json/wc/store/v1/products?per_page=100&page=${page}`, { headers: { "user-agent": UA, accept: "application/json" }, redirect: "follow" });
        if (!res.ok) break;
        const data = (await res.json()) as WooProduct[];
        if (!Array.isArray(data) || data.length === 0) break;
        all.push(...data);
        if (data.length < 100) break;
      } catch { break; }
    }
    if (all.length) return all;
  }
  return null;
}

/** Vendor's declared price in major units (dollars) from the Store API's minor-unit strings. */
export function wooPrice(p: WooProduct): number | null {
  const minor = p.prices?.currency_minor_unit ?? 2;
  const raw = p.prices?.price_range?.min_amount ?? p.prices?.price;
  if (raw == null) return null;
  const n = Number(raw) / Math.pow(10, minor);
  return Number.isFinite(n) ? n : null;
}

/** Best-effort size label pulled from the product name (e.g. "BPC-157 – 10mg" → "10mg"). */
export function wooQuantity(name: string): string {
  const m = name.match(/(\d+(?:\.\d+)?\s?(?:mg|mcg|iu|ml|g)\b)/i);
  return m ? m[1].replace(/\s+/g, "") : "1 vial";
}

/**
 * Import a WooCommerce vendor's whole catalog: fetch the Store API, match each product to a
 * compound, and record one representative (cheapest sane) live listing per vendor+compound.
 */
export async function importWooCommerceCatalog(
  db: SqlConnection,
  input: { vendorSlug: string; vendorName: string; domain: string; location?: string; description: string; compounds: CompoundRef[]; products?: WooProduct[] },
): Promise<ImportResult> {
  const products = input.products ?? (await fetchWooProducts(input.domain));
  const result: ImportResult = { vendor: input.vendorName, productsSeen: products?.length ?? 0, matched: 0, imported: [], skipped: 0 };
  if (!products) return result;

  await upsertLiveVendor(db, { slug: input.vendorSlug, name: input.vendorName, domains: [input.domain], location: input.location, description: input.description });

  // Cheapest sane candidate per compound (a vendor lists several sizes for one compound).
  // Keep the cheapest candidate per (compound, size) — a vendor sells the same compound in
  // several vial sizes, and each real size is worth recording ($/mg differs by size).
  const bySize = new Map<string, Candidate>();
  for (const product of products) {
    if (!product?.name) { result.skipped += 1; continue; }
    const compoundSlug = matchCompound(product.name, input.compounds);
    if (!compoundSlug) { result.skipped += 1; continue; }
    result.matched += 1;
    const price = wooPrice(product);
    if (price == null || price < PRICE_MIN || price > PRICE_MAX) { result.skipped += 1; continue; }
    const quantity = wooQuantity(product.name);
    const key = `${compoundSlug}::${quantity.toLowerCase()}`;
    const prev = bySize.get(key);
    // The vendor's own advertised testing claim. Never upgraded to "verified" — a claim with no
    // independent record VialGrade holds resolves to "Testing unverified" in the cross-check.
    const advertised = detectAdvertisedTesting(`${product.description ?? ""} ${product.short_description ?? ""}`);
    const coa = advertised ? { batchCode: null, issuer: advertised.issuer } : undefined;
    if (!prev || price < prev.price) bySize.set(key, { compoundSlug, price, quantity, name: product.name, url: product.permalink || `https://${input.domain}`, available: Boolean(product.is_in_stock), image: wooImage(product), coa });
  }
  for (const rec of await recordAllSizes(db, input, [...bySize.values()])) result.imported.push(rec);
  return result;
}
