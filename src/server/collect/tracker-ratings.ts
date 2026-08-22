// Third-party tracker ratings, collected.
//
// The Reputation dimension rendered `absent` for almost every vendor because all three of its
// inputs were files somebody typed: 28 hand-written review summaries, 17 aggregator rows, and a
// community table that was empty for all 90 vendors. Same shape of gap as the operational signals.
//
// Peptigrity is an independent peptide-shop tracker publishing a schema.org graph on each shop
// page, including an AggregateRating. The important property is that the shop node NAMES ITS OWN
// DOMAIN, so attribution is a check rather than a guess — and attribution is where this could do
// real harm. Pinning one vendor's reputation onto another is the worst mistake available to a
// product whose entire job is telling people who to trust.
//
// A rating is a SIGNAL, never a verdict: a tracker score is somebody else's opinion, weighed
// alongside lab evidence rather than above it.

export interface ShopRating {
  domain: string;
  ratingValue: number;
  bestRating: number;
  ratingCount: number;
  reviewCount: number;
}

interface LdNode {
  "@type"?: string | string[];
  name?: string;
  url?: string;
  aggregateRating?: { ratingValue?: unknown; bestRating?: unknown; ratingCount?: unknown; reviewCount?: unknown };
}

const typesOf = (node: LdNode): string[] => {
  const t = node["@type"];
  if (Array.isArray(t)) return t.map(String);
  return typeof t === "string" ? t.split(",").map((s) => s.trim()) : [];
};

/** A shop node is a store, not the tracker's own Organization record. */
const isShop = (node: LdNode): boolean => typesOf(node).some((t) => t === "OnlineStore" || t === "Store" || t === "LocalBusiness");

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export const normalizeDomain = (d: string): string =>
  d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

const looksLikeDomain = (s: string): boolean => /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(s);

/**
 * The domain a shop node is about, or "" if the page does not state one.
 *
 * Trackers identify a shop two different ways. Peptigrity puts the domain in `name`; Trustpilot
 * puts the trading name there ("Nootropic Source") and the domain in the review URL path. Reading
 * only `name` silently resolved every live Trustpilot profile to nothing.
 *
 * A trading name is never treated as a domain. Turning "Nootropic Source" into a domain would be
 * a guess, and a guess here attaches one business's reputation to another.
 */
function domainOf(node: LdNode): string {
  const name = normalizeDomain(String(node.name ?? ""));
  if (looksLikeDomain(name)) return name;

  const url = String(node.url ?? "");
  const reviewPath = url.match(/\/review\/([^/?#]+)/i)?.[1];
  if (reviewPath) {
    const d = normalizeDomain(reviewPath);
    if (looksLikeDomain(d)) return d;
  }

  const bare = normalizeDomain(url);
  return looksLikeDomain(bare) ? bare : "";
}

/**
 * The shop's own aggregate rating from a tracker page, or null.
 *
 * Only a node typed as a store is considered — every one of these pages also carries the tracker's
 * own Organization record, and reading that would give all 555 shops the same rating. A value
 * outside its own declared scale is treated as a broken page rather than a signal.
 */
export function parseShopRating(html: string): ShopRating | null {
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  const nodes: LdNode[] = [];
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1]) as LdNode & { "@graph"?: LdNode[] };
      nodes.push(...(Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed]));
    } catch { /* a broken block is not a signal */ }
  }

  for (const node of nodes) {
    if (!isShop(node) || !node.aggregateRating) continue;
    const domain = domainOf(node);
    const ratingValue = num(node.aggregateRating.ratingValue);
    const bestRating = num(node.aggregateRating.bestRating) ?? 5;
    // Trackers publish one or the other, not always both: Peptigrity sends ratingCount and
    // reviewCount, Trustpilot sends reviewCount alone. Defaulting the missing one to zero made a
    // 110-review profile report as having no ratings behind it, which understates real evidence.
    const rawRatingCount = num(node.aggregateRating.ratingCount);
    const rawReviewCount = num(node.aggregateRating.reviewCount);
    const ratingCount = rawRatingCount ?? rawReviewCount ?? 0;
    const reviewCount = rawReviewCount ?? rawRatingCount ?? 0;
    if (!domain || ratingValue === null) continue;
    if (ratingValue <= 0 || ratingValue > bestRating) continue;
    return { domain, ratingValue, bestRating, ratingCount, reviewCount };
  }
  return null;
}

/**
 * The rating, but only if the page is genuinely about this vendor.
 *
 * A redirect, a renamed slug or a stale sitemap entry can all hand back a page describing a
 * different shop. Recording that would attach one vendor's reputation to another, so the page has
 * to say the vendor's own domain or the answer is nothing.
 */
export function ratingForDomain(rating: ShopRating | null, vendorDomain: string): ShopRating | null {
  if (!rating || !rating.domain) return null;
  return normalizeDomain(rating.domain) === normalizeDomain(vendorDomain) ? rating : null;
}

const UA = "VialGrade-Signals/1.0 (+https://vial.local/how-we-check)";

/** Fetch one tracker shop page. Returns null on any failure — an unreachable page is not a signal. */
export async function fetchShopRating(url: string): Promise<ShopRating | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow" });
    if (!res.ok) return null;
    return parseShopRating(await res.text());
  } catch {
    return null;
  }
}

export type TrustpilotState = "rated" | "removed" | "none";

/**
 * What a Trustpilot profile page actually says about a vendor.
 *
 * Order matters, and getting it wrong produced a believable, entirely false dataset. Trustpilot
 * ships its full i18n bundle inside every page, removal strings included, so searching the raw
 * HTML for "this profile has been removed" is true of every profile — live ones included. A first
 * run on that logic reported 8 of 8 vendors removed, which is a plausible claim about this market
 * and was wrong.
 *
 * So: the RATING is the evidence, and it decides first. Removal is only considered when no rating
 * was published, and only from the rendered text a reader would actually see — never the raw HTML.
 * Attribution still governs throughout: a rating naming another business is not this vendor's.
 */
export function classifyTrustpilot(input: { html: string; markdown: string; domain: string }): { state: TrustpilotState; rating: ShopRating | null } {
  const rating = ratingForDomain(parseShopRating(input.html), input.domain);
  if (rating) return { state: "rated", rating };
  if (/this profile has been removed/i.test(input.markdown)) return { state: "removed", rating: null };
  return { state: "none", rating: null };
}
