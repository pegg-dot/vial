// WooCommerce catalog importer — the second breadth loophole.
//
// Most peptide vendors that AREN'T on Shopify run WooCommerce, which exposes its whole catalog
// (products + prices) at the public /wp-json/wc/store/v1/products Store API — no HTML scraping.
// One paginated fetch yields a vendor's real catalog. We map each product name to a canonical
// compound and record the vendor's declared price as an honest observation (origin='live').

import type { SqlConnection } from "@/server/db/client";
import { recordCatalogListing, upsertLiveVendor } from "./live-sources";
import { matchCompound, type CompoundRef, type ImportResult } from "./shopify-import";

const UA = "VIAL-Catalog-Import/1.0 (+https://vial.local/how-we-check)";
const PRICE_MIN = 5;
const PRICE_MAX = 2000;

export interface WooProduct {
  name: string;
  permalink: string;
  type: string;
  is_in_stock: boolean;
  prices: { price: string | null; price_range: { min_amount: string } | null; currency_minor_unit: number } | null;
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
  const best = new Map<string, { compoundSlug: string; price: number; quantity: string; name: string; url: string; available: boolean }>();
  for (const product of products) {
    if (!product?.name) { result.skipped += 1; continue; }
    const compoundSlug = matchCompound(product.name, input.compounds);
    if (!compoundSlug) { result.skipped += 1; continue; }
    result.matched += 1;
    const price = wooPrice(product);
    if (price == null || price < PRICE_MIN || price > PRICE_MAX) { result.skipped += 1; continue; }
    const prev = best.get(compoundSlug);
    if (!prev || price < prev.price) {
      best.set(compoundSlug, { compoundSlug, price, quantity: wooQuantity(product.name), name: product.name, url: product.permalink, available: Boolean(product.is_in_stock) });
    }
  }

  for (const c of best.values()) {
    const listingSlug = `${input.vendorSlug}-${c.compoundSlug}`;
    await recordCatalogListing(db, {
      compoundSlug: c.compoundSlug,
      vendorSlug: input.vendorSlug,
      slug: listingSlug,
      name: c.name.slice(0, 120),
      quantity: c.quantity.slice(0, 60),
      externalUrl: c.url || `https://${input.domain}`,
      price: c.price,
      availability: c.available ? "In stock" : "Unavailable",
      sourceUrl: c.url || `https://${input.domain}`,
      sourceLabel: `${input.vendorName} — ${c.name.slice(0, 80)}`,
    });
    result.imported.push({ slug: listingSlug, compound: c.compoundSlug, price: c.price });
  }
  return result;
}
