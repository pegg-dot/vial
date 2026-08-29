// Headless-storefront catalog importer — the second breadth loophole.
//
// The Shopify importer works because Shopify hands over /products.json. A growing share of this
// market has moved to headless commerce (Medusa) behind a Next.js app: no /products.json, no
// /wp-json, and a product page that is mostly an empty shell until React hydrates. Those vendors
// were invisible to us — not "no listings on record", but never even looked at.
//
// The catalog is there. A Next.js server-component response streams its data to the browser in
// `self.__next_f.push([1,"<escaped json>"])` chunks, and the product — variants, resolved prices,
// and the vendor's own COA metadata — sits inside it. We reassemble the stream and read it.
//
// Treated as hostile data throughout, per the source-refresh rules: nothing here decides
// publication, and every value is validated before it is believed.

import type { SqlConnection } from "@/server/db/client";
import { upsertLiveVendor } from "./live-sources";
import { matchCompound, recordAllSizes, type CompoundRef, type Candidate, type ImportResult } from "./shopify-import";

export interface RscVariant {
  title?: string;
  sku?: string | null;
  metadata?: Record<string, unknown> | null;
  calculated_price?: { calculated_amount?: number; currency_code?: string } | null;
}

export interface RscProduct {
  id?: string;
  handle: string;
  title?: string;
  description?: string;
  thumbnail?: string | null;
  metadata?: Record<string, unknown> | null;
  variants: RscVariant[];
  images?: { url?: string }[];
}

/**
 * Reassemble a Next.js flight payload from its push() chunks.
 *
 * The stream splits a single product across chunk boundaries, so a parser that reads chunks
 * independently finds nothing. A malformed chunk is skipped rather than thrown, because losing
 * one chunk of a streamed response must not discard a vendor's whole catalog.
 */
export function parseFlightPayload(html: string): string {
  const chunks = html.matchAll(/self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\.)*")\]\)/g);
  let out = "";
  for (const m of chunks) {
    try { out += JSON.parse(m[1]) as string; } catch { /* a corrupt chunk loses itself, not the page */ }
  }
  return out;
}

const MAX_CANDIDATE_BYTES = 500_000;

/**
 * Recover every product object embedded in a reassembled flight payload.
 *
 * Scans once, tracking object boundaries string-aware, and only parses a slice that names both
 * a handle and a variant list. Wrapper objects that merely CONTAIN a product fail the top-level
 * shape check. Deduped by handle: a real page emits the same product more than once (detail view
 * plus a related-products rail), and recording it twice would double the vendor's listing count.
 */
export function extractRscProducts(flight: string): RscProduct[] {
  const byHandle = new Map<string, RscProduct>();
  const stack: number[] = [];
  let inStr = false, esc = false;

  for (let i = 0; i < flight.length; i++) {
    const ch = flight[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;

    if (ch === "{") { stack.push(i); continue; }
    if (ch !== "}") continue;

    const start = stack.pop();
    if (start === undefined) continue;
    const end = i + 1;
    if (end - start > MAX_CANDIDATE_BYTES) continue;
    const slice = flight.slice(start, end);
    if (!slice.includes('"handle":"') || !slice.includes('"variants":')) continue;

    let parsed: unknown;
    try { parsed = JSON.parse(slice); } catch { continue; }
    const p = parsed as Partial<RscProduct>;
    if (typeof p.handle !== "string" || !p.handle || !Array.isArray(p.variants)) continue;
    if (!byHandle.has(p.handle)) byHandle.set(p.handle, p as RscProduct);
  }
  return [...byHandle.values()];
}

/**
 * The variant's resolved price in dollars, or null.
 *
 * Medusa resolves prices per region, so a payload can carry a non-USD amount. Recording that as
 * dollars would put a wrong number on a price comparison, so an unexpected currency is refused
 * rather than assumed.
 */
export function rscVariantPrice(variant: RscVariant): number | null {
  const price = variant?.calculated_price;
  if (!price) return null;
  const amount = price.calculated_amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  const currency = (price.currency_code ?? "usd").toLowerCase();
  if (currency !== "usd") return null;
  return amount;
}

export interface RscCoa { lab: string; url: string; batchId: string | null; testedAt: string | null; purityPct: number | null }

/**
 * The vendor's own published certificate reference for this product, or null.
 *
 * Two fields are load-bearing and neither is optional: a NAMED lab and a document to point at.
 * A certificate with no lab named is a self-test — legitimate to show, but counting it as
 * independent evidence would inflate a vendor's grade on the one seam that has to stay honest.
 * `coa_legacy_lab` is deliberately not a fallback: it says where they used to test, which is not
 * evidence about this batch.
 */
export function rscCoaFromMetadata(metadata: Record<string, unknown> | null | undefined): RscCoa | null {
  if (!metadata) return null;
  const str = (k: string): string | null => {
    const v = metadata[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const lab = str("coa_lab");
  const url = str("coa_url");
  if (!lab || !url) return null;
  const purityRaw = str("purity");
  const purityNum = purityRaw ? Number.parseFloat(purityRaw.replace(/[^0-9.]/g, "")) : NaN;

  // The published id is the LAB SUBMISSION, not a product lot — a vendor sends many samples at
  // once and each comes back as its own numbered report under the same submission. Recording the
  // bare submission id makes every compound in that run share a "lot", which reads downstream as
  // a reused lot number: the accusation that a vendor's certificates are a template rather than
  // real per-batch testing. For a vendor whose certificates ARE individually run, that would be
  // a false statement of fact. The report number is the part that identifies this certificate,
  // and it is what the vial's own label carries.
  const bare = str("coa_batch_id");
  const report = url.match(/\breport-(\d+)\b/)?.[1] ?? null;
  const batchId = bare ? (report ? `${bare}-${report}` : bare) : null;

  return {
    lab,
    url,
    batchId,
    testedAt: str("coa_test_date"),
    purityPct: Number.isFinite(purityNum) && purityNum > 0 && purityNum <= 100 ? purityNum : null,
  };
}

/**
 * The vendor's own product-page URLs, taken from their sitemap.
 *
 * A headless storefront has no catalogue endpoint, so the sitemap is how we learn what exists.
 * It is third-party content and treated as such: an off-host `<loc>` is dropped, because
 * following one would send the importer somewhere the vendor does not control and then record
 * whatever it found there as that vendor's catalogue.
 */
export function productUrlsFromSitemap(xml: string, pathPrefix: string, host?: string): string[] {
  const wanted = host?.toLowerCase().replace(/^www\./, "");
  const out = new Set<string>();
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    let url: URL;
    try { url = new URL(m[1]); } catch { continue; }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (!url.pathname.startsWith(pathPrefix)) continue;
    if (wanted && url.hostname.toLowerCase().replace(/^www\./, "") !== wanted) continue;
    out.add(url.toString());
  }
  return [...out];
}

const UA = "VialGrade-Catalog-Import/1.0 (+https://vial.local/how-we-check)";
const PRICE_MIN = 5;
const PRICE_MAX = 2000;

/** Fetch one product page and recover the products embedded in it. */
export async function fetchRscProducts(url: string): Promise<RscProduct[]> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow" });
    if (!res.ok) return [];
    return extractRscProducts(parseFlightPayload(await res.text()));
  } catch {
    return [];
  }
}

function rscImage(p: RscProduct): string | undefined {
  const src = p.thumbnail ?? p.images?.find((i) => i.url && /^https?:\/\//i.test(i.url))?.url;
  return src ? src.replace(/^http:\/\//i, "https://") : undefined;
}

const outOfStock = (meta: Record<string, unknown> | null | undefined) =>
  typeof meta?.wp_stock_status === "string" && meta.wp_stock_status === "outofstock";

/**
 * Import a headless vendor's catalog from a list of product-page URLs.
 *
 * One product page yields one product; the pages come from the vendor's own sitemap. Only
 * products that map to exactly one known compound and carry a sane USD price are recorded,
 * matching the Shopify importer's rules exactly — the transport is different, the standard is not.
 */
export async function importRscCatalog(
  db: SqlConnection,
  input: {
    vendorSlug: string; vendorName: string; domain: string; location?: string; description: string;
    compounds: CompoundRef[]; productUrls: string[];
    /** Injected in tests and by the collector so a run can be replayed without the network. */
    fetchProducts?: (url: string) => Promise<RscProduct[]>;
  },
): Promise<ImportResult & { coas: (RscCoa & { compoundSlug: string; productUrl: string })[] }> {
  const fetcher = input.fetchProducts ?? fetchRscProducts;
  const result: ImportResult & { coas: (RscCoa & { compoundSlug: string; productUrl: string })[] } =
    { vendor: input.vendorName, productsSeen: 0, matched: 0, imported: [], skipped: 0, complete: false, coas: [] };

  await upsertLiveVendor(db, {
    slug: input.vendorSlug, name: input.vendorName, domains: [input.domain],
    location: input.location, description: input.description,
  });

  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const url of input.productUrls) {
    for (const product of await fetcher(url)) {
      if (seen.has(product.handle)) continue;
      seen.add(product.handle);
      result.productsSeen += 1;

      const compoundSlug = matchCompound(product.title ?? product.handle, input.compounds);
      if (!compoundSlug) { result.skipped += 1; continue; }
      result.matched += 1;

      const coa = rscCoaFromMetadata(product.metadata);
      if (coa) result.coas.push({ ...coa, compoundSlug, productUrl: url });

      const image = rscImage(product);
      const productOut = outOfStock(product.metadata);
      let any = false;
      for (const variant of product.variants) {
        const price = rscVariantPrice(variant);
        if (price === null || price < PRICE_MIN || price > PRICE_MAX) continue;
        candidates.push({
          compoundSlug, price,
          quantity: variant.title?.trim() || "1 vial",
          name: product.title ?? product.handle,
          url,
          available: !productOut && !outOfStock(variant.metadata),
          image,
          coa: coa ? { batchCode: coa.batchId } : undefined,
        });
        any = true;
      }
      if (!any) result.skipped += 1;
    }
  }

  for (const rec of await recordAllSizes(db, input, candidates)) result.imported.push(rec);
  return result;
}
