// WooCommerce catalog importer — the second breadth loophole.
//
// Most peptide vendors that AREN'T on Shopify run WooCommerce, which exposes its whole catalog
// (products + prices) at the public /wp-json/wc/store/v1/products Store API — no HTML scraping.
// One paginated fetch yields a vendor's real catalog. We map each product name to a canonical
// compound and record the vendor's declared price as an honest observation (origin='live').

import type { SqlConnection } from "@/server/db/client";
import { upsertLiveVendor } from "./live-sources";
import { matchCompound, recordAllSizes, type Candidate, type CompoundRef, type ImportResult } from "./shopify-import";
import { detectAdvertisedTesting, extractJanoshikRefs } from "./storefront-coa";

const UA = "VialGrade-Catalog-Import/1.0 (+https://vial.local/how-we-check)";
const PRICE_MIN = 5;
const PRICE_MAX = 2000;

export interface WooAttributeTerm { name?: string; slug?: string }
export interface WooAttribute { name?: string; has_variations?: boolean; terms?: WooAttributeTerm[] }
export interface WooVariationRef { id: number; attributes?: { name?: string; value?: string }[] }

export interface WooProduct {
  id?: number;
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
  // The SIZE lives here, not in the name. A Woo product name is almost always the bare compound
  // ("BPC-157"); the milligrams the buyer receives are an option — "Size: 5MG", "Dose: 70mg",
  // "Strength: 10mg" + "Pack Size: 10-vial kit" — carried on the attributes and their variations.
  attributes?: WooAttribute[];
  variations?: WooVariationRef[];
}

/** A single purchasable variation of a Woo product, fetched by id (this is where its OWN price is). */
export interface WooVariation {
  variation?: string;                       // human option label, e.g. "Size: 5MG"
  prices: WooProduct["prices"];
  is_in_stock?: boolean;
}

// First usable image URL from a WooCommerce product (the Store API returns full-size srcs).
export function wooImage(p: WooProduct): string | undefined {
  const src = p.images?.find((i) => i.src && /^https?:\/\//i.test(i.src))?.src;
  return src ? src.replace(/^http:\/\//i, "https://") : undefined;
}

/** Fetch a WooCommerce vendor's catalog via the public Store API, paginating up to `maxPages`. */
/**
 * Raised when a storefront refuses us outright — a bot wall, a hard block, an unreachable host.
 *
 * This MUST be distinguishable from "we fetched the catalog and it was empty". Returning null for
 * both made a blocked vendor look like a successful import of zero products: the collector recorded
 * ok=true, never backed off, and the vendor's now-frozen prices kept rendering as current. That is
 * the silently-broken-collector failure this product exists to catch in others.
 */
export class StorefrontUnreachableError extends Error {
  constructor(readonly domain: string, readonly status: number | null) {
    super(status ? `${domain} refused the catalog request (HTTP ${status})` : `${domain} could not be reached`);
    this.name = "StorefrontUnreachableError";
  }
}

async function pooled<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) out[i] = await work(items[i]);
  }));
  return out;
}

/** umbrella-labs lists more than 600 products; ten pages is a thousand. */
export const WOO_MAX_PAGES = 10;
const PAGE_CONCURRENCY = 4;

/**
 * The first page tells us how many there are (`x-wp-totalpages`); the rest are independent
 * requests and are fetched together. umbrella-labs took 42 s sequentially at ~7 s a page — past
 * the tick budget, so the function was killed mid-import every hour and the target never settled.
 * Past `deadlineAt` no further page is requested and the read is marked incomplete.
 *
 * `complete` is true only when the last page was seen. A read cut off by the page cap, the
 * deadline, or a failed page has NOT seen the whole catalogue and must not retire what it missed.
 */
export async function fetchWooCatalog(domain: string, maxPages = WOO_MAX_PAGES, options: { deadlineAt?: number } = {}): Promise<{ products: WooProduct[]; complete: boolean } | null> {
  let lastStatus: number | null = null;
  let reachedHost = false;
  const pageUrl = (base: string, page: number) => `${base}/wp-json/wc/store/v1/products?per_page=100&page=${page}`;
  const headers = { "user-agent": UA, accept: "application/json" };
  for (const base of [`https://${domain}`, `https://www.${domain}`]) {
    let first: Response;
    try {
      first = await fetch(pageUrl(base, 1), { headers, redirect: "follow" });
      reachedHost = true;
    } catch { continue; }
    if (!first.ok) { lastStatus = first.status; continue; }
    let data: WooProduct[];
    try { data = (await first.json()) as WooProduct[]; } catch { continue; }
    if (!Array.isArray(data) || data.length === 0) continue;
    const all: WooProduct[] = [...data];
    if (data.length < 100) return { products: all, complete: true };
    const declared = Number(first.headers.get("x-wp-totalpages") ?? "0");
    const wanted = declared > 0 ? Math.min(declared, maxPages) : maxPages;
    if (options.deadlineAt !== undefined && Date.now() >= options.deadlineAt) return { products: all, complete: false };
    const rest = Array.from({ length: Math.max(0, wanted - 1) }, (_, i) => i + 2);
    let sawEnd = declared > 0 && declared <= maxPages;
    let failed = false;
    const pages = await pooled(rest, PAGE_CONCURRENCY, async (page): Promise<WooProduct[] | null> => {
      try {
        const res = await fetch(pageUrl(base, page), { headers, redirect: "follow" });
        if (!res.ok) return null;
        const body = (await res.json()) as WooProduct[];
        return Array.isArray(body) ? body : null;
      } catch { return null; }
    });
    for (const page of pages) {
      if (page === null) { failed = true; continue; }
      all.push(...page);
      if (page.length < 100) sawEnd = true;
    }
    return { products: all, complete: sawEnd && !failed };
  }
  // A refusal (403/401/429) or an unreachable host is a FAILURE, not an empty catalog. Only a
  // genuine 2xx that returned no products falls through to null.
  if (!reachedHost || (lastStatus !== null && lastStatus >= 400)) {
    throw new StorefrontUnreachableError(domain, lastStatus);
  }
  return null;
}

export async function fetchWooProducts(domain: string, maxPages = 6): Promise<WooProduct[] | null> {
  return (await fetchWooCatalog(domain, maxPages))?.products ?? null;
}

/** Vendor's declared price in major units (dollars) from the Store API's minor-unit strings. */
export function wooPrice(p: Pick<WooProduct, "prices">): number | null {
  const minor = p.prices?.currency_minor_unit ?? 2;
  const raw = p.prices?.price_range?.min_amount ?? p.prices?.price;
  if (raw == null) return null;
  const n = Number(raw) / Math.pow(10, minor);
  return Number.isFinite(n) ? n : null;
}

/** WordPress bodies arrive as HTML with entities and shortcodes; the size is in the text under them. */
function plainText(html: string | undefined): string {
  return (html ?? "")
    .replace(/\[[^\]]*\]/g, " ")          // Visual Composer shortcodes wrap peptidepros.net spec tables
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&gt;/gi, ">").replace(/&lt;/gi, "<")
    .replace(/\s+/g, " ")
    .trim();
}

// An option value only counts as a size if it actually states one. "Peptides", "Lyophilized" and
// "Single vial" are real option values that carry no milligrams.
const statesASize = (s: string) => /\d/.test(s) && /(?:mg|mcg|µg|iu|ml|milligrams?|micrograms?|grams?|g|vials?|caps?|capsules?|tablets?|ct)\b/i.test(s);

/**
 * The distinct option combinations a variable Woo product sells, as human labels.
 *
 * Store API variations carry attribute SLUGS ("5mg-lyophilized", "peptides-2"); the readable term
 * names live on the parent attribute. Resolve one to the other so the recorded size reads the way
 * the vendor writes it.
 */
export function wooVariationLabels(p: WooProduct): string[] {
  const display = new Map<string, string>();
  for (const attr of p.attributes ?? []) {
    for (const term of attr.terms ?? []) {
      if (term.name) {
        if (term.slug) display.set(`${attr.name} ${term.slug.toLowerCase()}`, term.name);
        display.set(`${attr.name} ${term.name.toLowerCase()}`, term.name);
      }
    }
  }
  const labels = new Set<string>();
  for (const v of p.variations ?? []) {
    const parts = (v.attributes ?? [])
      .map((a) => display.get(`${a.name} ${(a.value ?? "").toLowerCase()}`) ?? a.value ?? "")
      .filter((s) => s.trim().length > 0);
    if (parts.length) labels.add(parts.join(" · "));
  }
  // A product can declare its options on the attributes without listing variations (Woo does this
  // for some "simple" products with a single option set).
  if (labels.size === 0) {
    const single = (p.attributes ?? []).filter((a) => (a.terms ?? []).length === 1);
    if (single.length && single.length === (p.attributes ?? []).length) {
      const parts = single.map((a) => a.terms?.[0]?.name ?? "").filter(Boolean);
      if (parts.length) labels.add(parts.join(" · "));
    }
  }
  return [...labels];
}

/** Strip the attribute-name prefixes Woo puts on a variation label: "Size: 5MG" → "5MG". */
export function wooVariationQuantity(label: string | undefined): string | null {
  const cleaned = (label ?? "")
    .split(",")
    .map((part) => part.replace(/^\s*[A-Za-z][\w /-]{0,24}:\s*/, "").trim())
    .filter(Boolean)
    .join(" · ");
  return cleaned && statesASize(cleaned) ? cleaned.slice(0, 60) : null;
}

/**
 * The size a Woo product delivers, read from the vendor's own data in descending order of certainty.
 *
 * Why this exists: 210 of 537 live listings (39%) carried the literal placeholder "1 vial" because
 * the only place this importer looked was the product NAME — and a Woo product name is almost
 * always just the compound. Every one of those listings was excluded from price-per-mg. The size was
 * in the payload the whole time, on the attributes and in the vendor's own spec block. When it is
 * genuinely absent this still returns "1 vial", which parses to no per-mg — the honest answer.
 */
export function wooQuantity(input: WooProduct | string): string {
  const product: WooProduct = typeof input === "string"
    ? { name: input, permalink: "", type: "simple", is_in_stock: true, prices: null }
    : input;

  // 1) The name, when the vendor put the size there ("BPC-157 – 10mg").
  const named = product.name?.match(/(\d+(?:\.\d+)?\s?(?:mg|mcg|iu|ml|milligrams?|micrograms?|grams?|g)\b)/i);
  if (named) return named[1].replace(/\s+/g, "");

  // 2) Exactly one option combination = one certain size, and the product price IS that option's
  //    price. (Several combinations are ambiguous here and are resolved per-variation instead.)
  const labels = wooVariationLabels(product);
  if (labels.length === 1) {
    const fromOption = wooVariationQuantity(labels[0]);
    if (fromOption) return fromOption;
  }

  // 3) A spec block stating unit size and unit quantity — how peptidepros.net describes its
  //    50-vial bulk packs: "Unit Size 5 mg/vial Unit Quantity 50 Vials".
  const body = plainText(product.description);
  const unitSize = body.match(/unit\s+size\s+(\d+(?:\.\d+)?)\s*(mg|mcg|µg|milligrams?|micrograms?|grams?|g)\s*\/\s*vial\b/i);
  if (unitSize) {
    const unitQty = body.match(/unit\s+quantity\s+(\d+)\s*vials?\b/i);
    const per = `${unitSize[1]}${unitSize[2].toLowerCase()}/vial`;
    return unitQty ? `${per} × ${unitQty[1]} vials` : per;
  }

  // 4) A single unambiguous size stated in the vendor's own summary line — nootropicsource.com
  //    writes "5mg Vial Lyophilized Powder" / "6mg in a Vial" there and nowhere else. Only trusted
  //    when the whole summary states ONE strength, so a bundle or a range can never be collapsed.
  const summary = plainText(product.short_description);
  const stated = [...summary.matchAll(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|milligrams?|micrograms?|grams?|g)\b/gi)];
  const distinct = new Set(stated.map((m) => `${Number(m[1])}${m[2].toLowerCase().replace(/s$/, "")}`));
  const inVial = summary.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|milligrams?|micrograms?|grams?|g)\b(?:\s+in)?\s+(?:an?\s+)?vial\b/i);
  if (inVial && distinct.size === 1) return `${inVial[1]}${inVial[2].toLowerCase()}`;

  // 5) No size anywhere in what the vendor published. Say so; do not invent one.
  return "1 vial";
}

const MAX_VARIATIONS_PER_PRODUCT = 8;
const MAX_VARIATION_FETCHES = 220;
const VARIATION_CONCURRENCY = 4;

/**
 * Fetch one variation's own record. The Store API returns each variation as its own product at
 * /products/<id>, carrying BOTH its option label and its OWN price — the only place the two are
 * tied together. The parent product only exposes a price RANGE, so a "5MG / 10MG" product cannot
 * be split honestly without this call.
 */
export async function fetchWooVariation(origin: string, id: number): Promise<WooVariation | null> {
  try {
    const res = await fetch(`${origin}/wp-json/wc/store/v1/products/${id}`, { headers: { "user-agent": UA, accept: "application/json" }, redirect: "follow" });
    if (!res.ok) return null;
    const data = (await res.json()) as WooVariation;
    return data && typeof data === "object" ? data : null;
  } catch { return null; }
}


/**
 * Import a WooCommerce vendor's whole catalog: fetch the Store API, match each product to a
 * compound, and record one representative (cheapest sane) live listing per vendor+compound.
 */
export async function importWooCommerceCatalog(
  db: SqlConnection,
  input: {
    vendorSlug: string; vendorName: string; domain: string; location?: string; description: string;
    compounds: CompoundRef[]; products?: WooProduct[];
    /** Injectable for tests and fixtures; defaults to the real Store API call. */
    fetchVariation?: (origin: string, id: number) => Promise<WooVariation | null>;
    /** Epoch ms. Past it, no further page or variation is fetched; what is known is recorded and the read returns. */
    deadlineAt?: number;
  },
): Promise<ImportResult> {
  const catalog = input.products ? { products: input.products, complete: true } : await fetchWooCatalog(input.domain, WOO_MAX_PAGES, { deadlineAt: input.deadlineAt });
  const products = catalog?.products ?? null;
  const result: ImportResult = { vendor: input.vendorName, productsSeen: products?.length ?? 0, matched: 0, imported: [], skipped: 0, complete: catalog?.complete ?? false };
  if (!products) return result;

  await upsertLiveVendor(db, { slug: input.vendorSlug, name: input.vendorName, domains: [input.domain], location: input.location, description: input.description });

  const getVariation = input.fetchVariation ?? fetchWooVariation;
  let variationBudget = MAX_VARIATION_FETCHES;

  // Cheapest sane candidate per compound (a vendor lists several sizes for one compound).
  // Keep the cheapest candidate per (compound, size) — a vendor sells the same compound in
  // several vial sizes, and each real size is worth recording ($/mg differs by size).
  const bySize = new Map<string, Candidate>();
  const offer = (c: Candidate) => {
    const key = `${c.compoundSlug}::${c.quantity.toLowerCase()}`;
    const prev = bySize.get(key);
    if (!prev || c.price < prev.price) bySize.set(key, c);
  };
  for (const product of products) {
    if (!product?.name) { result.skipped += 1; continue; }
    const compoundSlug = matchCompound(product.name, input.compounds);
    if (!compoundSlug) { result.skipped += 1; continue; }
    result.matched += 1;
    const price = wooPrice(product);
    if (price == null || price < PRICE_MIN || price > PRICE_MAX) { result.skipped += 1; continue; }
    // The vendor's own advertised testing claim. Never upgraded to "verified" — a claim with no
    // independent record VialGrade holds resolves to "Testing unverified" in the cross-check.
    // Same rule as the Shopify path: a page citing a verify link belongs to the wedge, not to
    // prose detection. No tracked Woo storefront publishes one today, but the guarantee must not
    // depend on that staying true.
    const body = `${product.description ?? ""} ${product.short_description ?? ""}`;
    const advertisedTesting = extractJanoshikRefs(body).length > 0 ? null : detectAdvertisedTesting(body);
    const base: Omit<Candidate, "price" | "quantity"> = {
      compoundSlug, name: product.name, url: product.permalink || `https://${input.domain}`,
      available: Boolean(product.is_in_stock), image: wooImage(product), advertisedTesting,
    };

    // A product sold in several sizes exposes only a price RANGE, so the recorded price cannot be
    // attributed to a size from this payload — which is exactly how a "5MG / 10MG" product ended up
    // recorded as "1 vial" with no cost-per-mg. Each variation's own record carries its label AND
    // its own price, so ask for them and record one real offer per size (what the Shopify path
    // already does with variants). Bounded, and a failure just falls back to the product-level read.
    const variations = (product.variations ?? []).slice(0, MAX_VARIATIONS_PER_PRODUCT);
    const inTime = input.deadlineAt === undefined || Date.now() < input.deadlineAt;
    if (inTime && variations.length > 1 && wooVariationLabels(product).length > 1 && variationBudget >= variations.length) {
      variationBudget -= variations.length;
      let origin = "";
      try { origin = new URL(product.permalink).origin; } catch { origin = `https://${input.domain}`; }
      const fetched = await pooled(variations, VARIATION_CONCURRENCY, (v) => getVariation(origin, v.id));
      let recorded = 0;
      for (const variation of fetched) {
        const quantity = wooVariationQuantity(variation?.variation);
        const vPrice = variation ? wooPrice(variation) : null;
        if (!quantity || vPrice == null || vPrice < PRICE_MIN || vPrice > PRICE_MAX) continue;
        offer({ ...base, price: vPrice, quantity, available: variation?.is_in_stock ?? base.available });
        recorded += 1;
      }
      if (recorded > 0) continue;
    }

    offer({ ...base, price, quantity: wooQuantity(product) });
  }
  for (const rec of await recordAllSizes(db, { ...input, feedUrl: `https://${input.domain}/wp-json/wc/store/v1/products` }, [...bySize.values()])) result.imported.push(rec);
  return result;
}
