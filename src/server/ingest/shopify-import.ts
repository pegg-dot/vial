// Shopify catalog importer — the breadth loophole.
import { StorefrontUnreachableError } from "./woocommerce-import";
import { feedCapture } from "./catalogue-claims";
//
// Most research-peptide vendors run Shopify, which exposes EVERY product + variant + price
// at /products.json (no HTML scraping, no bot-blocker). One fetch yields a vendor's whole
// real catalog. We map each product title to a canonical compound and record the vendor's
// own declared price as an honest observation (origin='live', "Vendor catalog").

import type { SqlConnection } from "@/server/db/client";
import { recordCatalogListing, upsertLiveVendor } from "./live-sources";
import { extractJanoshikRefs, resolveStorefrontCoaClaims, coaKey, detectAdvertisedTesting, type JanoshikRef } from "./storefront-coa";

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
// Abbreviations that collide with a DIFFERENT molecule sold in this market. A short alias is not
// evidence when the title spells out another chemical: "INDOLEPROPIONAMIDE (IPAM)" is a nootropic,
// not Ipamorelin, and "GnRH (Triptorelin)" is not Gonadorelin. Both were being listed — and priced
// per-mg — under the wrong compound, which is the most dangerous kind of wrong this product can be.
const COLLIDES: Record<string, string[]> = {
  ipamorelin: ["indolepropionamide"],
  gonadorelin: ["triptorelin"],
};

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
    // A title that names a colliding molecule disqualifies this compound outright, however
    // strong the alias hit looked.
    if (best && !(COLLIDES[c.slug] ?? []).some(term => t.includes(norm(term)))) hits.push({ slug: c.slug, key: best });
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
interface ShopifyProduct { title: string; handle: string; variants: ShopifyVariant[]; images?: { src?: string }[]; body_html?: string }

function shopifyImage(p: ShopifyProduct): string | undefined {
  const src = p.images?.find((i) => i.src && /^https?:\/\//i.test(i.src))?.src;
  return src ? src.replace(/^http:\/\//i, "https://") : undefined;
}

const UA = "VialGrade-Catalog-Import/1.0 (+https://vial.local/how-we-check)";

/** Shopify pages /products.json at 250; a full page means there may be more we did not read. */
export const SHOPIFY_PAGE_SIZE = 250;

export async function fetchShopifyProducts(domain: string): Promise<ShopifyProduct[] | null> {
  let lastStatus: number | null = null;
  let reachedHost = false;
  for (const base of [`https://${domain}`, `https://www.${domain}`]) {
    try {
      const res = await fetch(`${base}/products.json?limit=${SHOPIFY_PAGE_SIZE}`, { headers: { "user-agent": UA, accept: "application/json" }, redirect: "follow" });
      reachedHost = true;
      if (!res.ok) { lastStatus = res.status; continue; }
      const data = (await res.json()) as { products?: ShopifyProduct[] };
      if (Array.isArray(data.products) && data.products.length) return data.products;
    } catch { /* try next base */ }
  }
  // A 404 here means the store is no longer Shopify; a 403/429 means it refused us. Neither is
  // an empty catalogue. bluum-peptides 404'd for eight days while every run reported green with
  // zero items — because this function returned null and the collector called that success.
  if (!reachedHost || (lastStatus !== null && lastStatus >= 400)) {
    throw new StorefrontUnreachableError(domain, lastStatus);
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
  /** True only when the run saw the vendor's WHOLE catalogue — the precondition for retiring what it did not see. */
  complete: boolean;
}

// One matched (vendor, compound, size) offer, ready to record as a listing.
export interface Candidate { compoundSlug: string; price: number; quantity: string; name: string; url: string; available: boolean; image?: string; coa?: { batchCode: string | null }; advertisedTesting?: { issuer: string } | null }

const sizeSlug = (q: string) => q.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "std";
const MAX_SIZES_PER_COMPOUND = 5;

// Pull a size token from a product name (e.g. "BPC-157 10mg vial" → "10mg"), else "1 vial".
export function sizeFromName(name: string): string {
  const m = name.match(/\b(\d+(?:\.\d+)?)\s*(mg|mcg|iu|ml|grams?|g)\b/i);
  return m ? `${m[1]}${m[2].toLowerCase()}` : "1 vial";
}

// Record every distinct size a vendor sells per compound (not just the cheapest). The cheapest
// size keeps the canonical `<vendor>-<compound>` listing slug for backward compatibility; other
// sizes get a `-<size>` suffix. Capped per compound so a stray variant list can't explode.
export async function recordAllSizes(
  db: SqlConnection,
  input: { vendorSlug: string; vendorName: string; domain: string; feedUrl?: string },
  candidates: Candidate[],
): Promise<{ slug: string; compound: string; price: number }[]> {
  const byCompound = new Map<string, Candidate[]>();
  // One capture per import: the compact record of what the feed declared, the lineage every
  // price claim from this read points at, and the vendor-wide identical-price guard.
  const feed = feedCapture({
    vendorSlug: input.vendorSlug, vendorName: input.vendorName, feedUrl: input.feedUrl ?? `https://${input.domain}/`,
    items: candidates.map((c) => ({ slug: c.url, price: c.price, available: c.available })),
  });
  for (const c of candidates) {
    const arr = byCompound.get(c.compoundSlug);
    if (arr) arr.push(c); else byCompound.set(c.compoundSlug, [c]);
  }
  const imported: { slug: string; compound: string; price: number }[] = [];
  for (const [compoundSlug, list] of byCompound) {
    // Cheapest candidate per distinct size, then order sizes by price and cap.
    const perSize = new Map<string, Candidate>();
    for (const c of list) {
      const k = c.quantity.toLowerCase();
      const prev = perSize.get(k);
      if (!prev || c.price < prev.price) perSize.set(k, c);
    }
    const sizes = [...perSize.values()].sort((a, b) => a.price - b.price).slice(0, MAX_SIZES_PER_COMPOUND);
    const usedSlugs = new Set<string>();
    for (let i = 0; i < sizes.length; i++) {
      const c = sizes[i];
      const listingSlug = i === 0 ? `${input.vendorSlug}-${compoundSlug}` : `${input.vendorSlug}-${compoundSlug}-${sizeSlug(c.quantity)}`;
      if (usedSlugs.has(listingSlug)) continue;   // distinct sizes that normalize to one slug → keep cheapest
      usedSlugs.add(listingSlug);
      await recordCatalogListing(db, {
        compoundSlug, vendorSlug: input.vendorSlug, slug: listingSlug,
        name: c.name.slice(0, 120), quantity: c.quantity.slice(0, 60),
        externalUrl: c.url, price: c.price,
        availability: c.available ? "In stock" : "Unavailable",
        sourceUrl: c.url, sourceLabel: `${input.vendorName} — ${c.name.slice(0, 80)}`,
        imageUrl: c.image, coa: c.coa, advertisedTesting: c.advertisedTesting,
        feed,
      });
      imported.push({ slug: listingSlug, compound: compoundSlug, price: c.price });
    }
  }
  return imported;
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
  const result: ImportResult = { vendor: input.vendorName, productsSeen: products?.length ?? 0, matched: 0, imported: [], skipped: 0, complete: Boolean(products) && (products?.length ?? 0) < SHOPIFY_PAGE_SIZE };
  if (!products) return result;

  await upsertLiveVendor(db, { slug: input.vendorSlug, name: input.vendorName, domains: [input.domain], location: input.location, description: input.description });

  // One candidate per matched product (using its cheapest available variant); recordAllSizes
  // dedupes by size and records every distinct vial size the vendor sells for a compound.
  // Collect each product's published Janoshik verify links (scoped to its compound) and batch-resolve
  // them against the certificates VialGrade ALREADY HOLDS — this is what lets a storefront listing carry
  // independent evidence instead of "no lab test". Only held, compound-matched records resolve.
  const refsByCompound = new Map<string, Set<string>>();
  const productRefs = new Map<ShopifyProduct, JanoshikRef[]>();
  for (const product of products) {
    const compoundSlug = matchCompound(product.title, input.compounds);
    if (!compoundSlug) continue;
    const refs = extractJanoshikRefs(product.body_html);
    if (!refs.length) continue;
    productRefs.set(product, refs);
    const set = refsByCompound.get(compoundSlug) ?? new Set<string>();
    for (const r of refs) set.add(r.verifyUrl);
    refsByCompound.set(compoundSlug, set);
  }
  const coaClaims = await resolveStorefrontCoaClaims(db, input.vendorSlug, refsByCompound);

  const candidates: Candidate[] = [];
  for (const product of products) {
    const compoundSlug = matchCompound(product.title, input.compounds);
    if (!compoundSlug) { result.skipped += 1; continue; }
    result.matched += 1;
    // The resolved COA claim (if any) rides on every variant of this product — they share the page.
    // Look up by compound+URL so a boilerplate footer link can't drag another compound's claim over.
    const resolved = (productRefs.get(product) ?? []).map((r) => coaClaims.get(coaKey(compoundSlug, r.verifyUrl))).find(Boolean);
    // Fall back to the vendor's own advertised testing claim so a listing reads "Testing
    // unverified" rather than a silent "No lab test" — but ONLY when the page cites no verify
    // link at all. If it cites one, the wedge above is the authority: when it declines to stamp
    // (wrong compound, self-published, unresolvable) that is a deliberate refusal, and letting a
    // prose claim override it would reintroduce exactly the boilerplate-footer leak the wedge
    // keys by compound+URL to prevent.
    const citesAnyRef = (productRefs.get(product) ?? []).length > 0;
    const advertisedTesting = resolved || citesAnyRef ? null : detectAdvertisedTesting(product.body_html);
    const coa = resolved ? { batchCode: resolved.batchCode } : undefined;
    // One candidate PER VARIANT (each real size the vendor sells), so a product whose title bundles
    // several sizes ("… 2mg/5mg vial") becomes one listing per size with its OWN price — instead of
    // collapsing to just the cheapest variant. recordAllSizes then dedupes by size and caps the count.
    let any = false;
    for (const variant of product.variants) {
      const price = Number(variant?.price);
      if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) continue;
      const variantSize = variant?.title && variant.title !== "Default Title" ? variant.title : null;
      candidates.push({
        compoundSlug, price,
        quantity: variantSize ?? sizeFromName(product.title),
        name: product.title, url: `https://${input.domain}/products/${product.handle}`,
        available: Boolean(variant?.available), image: shopifyImage(product), coa, advertisedTesting,
      });
      any = true;
    }
    if (!any) result.skipped += 1;
  }
  for (const rec of await recordAllSizes(db, { ...input, feedUrl: `https://${input.domain}/products.json` }, candidates)) result.imported.push(rec);
  return result;
}
