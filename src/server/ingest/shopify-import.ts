// Shopify catalog importer — the breadth loophole.
//
// Most research-peptide vendors run Shopify, which exposes EVERY product + variant + price
// at /products.json (no HTML scraping, no bot-blocker). One fetch yields a vendor's whole
// real catalog. We map each product title to a canonical compound and record the vendor's
// own declared price as an honest observation (origin='live', "Vendor catalog").

import type { SqlConnection } from "@/server/db/client";
import { recordCatalogListing, upsertLiveVendor } from "./live-sources";

export interface CompoundRef { slug: string; name: string; aliases: string[] }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Build the match keys for a compound: its slug + name + aliases, normalized, length >= 4.
function compoundKeys(c: CompoundRef): string[] {
  return Array.from(new Set([c.slug, c.name, ...c.aliases].map(norm).filter((k) => k.length >= 4)));
}

/**
 * Map a vendor product title to a single canonical compound slug, or null.
 * Returns null for blends (two disjoint compounds), non-peptides, and no-match — we only
 * record listings we can confidently attribute to one compound.
 */
export function matchCompound(title: string, compounds: CompoundRef[]): string | null {
  const t = norm(title);
  if (!t) return null;
  // Collect every compound whose key appears in the title, keeping the longest key hit.
  const hits: { slug: string; key: string }[] = [];
  for (const c of compounds) {
    let best = "";
    for (const k of compoundKeys(c)) {
      if (t.includes(k) && k.length > best.length) best = k;
    }
    if (best) hits.push({ slug: c.slug, key: best });
  }
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0].slug;
  // Multiple hits: if they're nested (e.g. "cjc1295" ⊂ "cjc1295dac"), keep the longest —
  // it's one specific compound, not a blend. If genuinely disjoint keys, it's a blend → skip.
  hits.sort((a, b) => b.key.length - a.key.length);
  const longest = hits[0];
  const disjoint = hits.some((h) => h.slug !== longest.slug && !longest.key.includes(h.key) && !h.key.includes(longest.key));
  return disjoint ? null : longest.slug;
}

interface ShopifyVariant { title: string; price: string; available: boolean; grams?: number }
interface ShopifyProduct { title: string; handle: string; variants: ShopifyVariant[] }

const UA = "VIAL-Catalog-Import/1.0 (+https://vial.local/how-we-check)";

export async function fetchShopifyProducts(domain: string): Promise<ShopifyProduct[] | null> {
  for (const base of [`https://${domain}`, `https://www.${domain}`]) {
    try {
      const res = await fetch(`${base}/products.json?limit=250`, { headers: { "user-agent": UA, accept: "application/json" }, redirect: "follow" });
      if (!res.ok) continue;
      const data = (await res.json()) as { products?: ShopifyProduct[] };
      if (Array.isArray(data.products) && data.products.length) return data.products;
    } catch { /* try next base */ }
  }
  return null;
}

const PRICE_MIN = 5;
const PRICE_MAX = 2000;

export interface ImportResult {
  vendor: string;
  productsSeen: number;
  matched: number;
  imported: { slug: string; compound: string; price: number }[];
  skipped: number;
}

/**
 * Import a Shopify vendor's whole catalog: fetch /products.json, match each product to a
 * compound, and record a live listing with the vendor's declared price. Only products that
 * map to exactly one known compound and carry a sane price are recorded.
 */
export async function importShopifyCatalog(
  db: SqlConnection,
  input: { vendorSlug: string; vendorName: string; domain: string; location?: string; description: string; compounds: CompoundRef[]; products?: ShopifyProduct[] },
): Promise<ImportResult> {
  const products = input.products ?? (await fetchShopifyProducts(input.domain));
  const result: ImportResult = { vendor: input.vendorName, productsSeen: products?.length ?? 0, matched: 0, imported: [], skipped: 0 };
  if (!products) return result;

  await upsertLiveVendor(db, { slug: input.vendorSlug, name: input.vendorName, domains: [input.domain], location: input.location, description: input.description });

  // Collect the cheapest sane candidate PER compound (a vendor may list several sizes /
  // products for one compound — we record one representative listing per vendor+compound).
  const best = new Map();
  for (const product of products) {
    const compoundSlug = matchCompound(product.title, input.compounds);
    if (!compoundSlug) { result.skipped += 1; continue; }
    result.matched += 1;
    const variants = [...product.variants].sort((a, b) => Number(a.price) - Number(b.price));
    const variant = variants.find((v) => v.available) ?? variants[0];
    const price = Number(variant?.price);
    if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) { result.skipped += 1; continue; }
    const prev = best.get(compoundSlug);
    if (!prev || price < prev.price) {
      best.set(compoundSlug, {
        compoundSlug, price,
        quantity: (variant?.title && variant.title !== "Default Title") ? variant.title : "1 vial",
        title: product.title, handle: product.handle, available: Boolean(variant?.available),
      });
    }
  }

  for (const c of best.values()) {
    const listingSlug = `${input.vendorSlug}-${c.compoundSlug}`;
    const productUrl = `https://${input.domain}/products/${c.handle}`;
    await recordCatalogListing(db, {
      compoundSlug: c.compoundSlug,
      vendorSlug: input.vendorSlug,
      slug: listingSlug,
      name: c.title.slice(0, 120),
      quantity: String(c.quantity).slice(0, 60),
      externalUrl: productUrl,
      price: c.price,
      availability: c.available ? "In stock" : "Unavailable",
      sourceUrl: productUrl,
      sourceLabel: `${input.vendorName} — ${c.title.slice(0, 80)}`,
    });
    result.imported.push({ slug: listingSlug, compound: c.compoundSlug, price: c.price });
  }
  return result;
}
