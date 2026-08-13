// Storefront-published COA linking — the coverage wedge.
//
// VialGrade holds a vendor-specific independent test for only ~11% of listings, because the tested
// companies (manufacturers on the Janoshik feed) and the selling storefronts are largely different
// sets, and the scraped listings carry no batch/testing data. But most storefronts publish their own
// Janoshik COA — usually a verify.janoshik.com link — right on the product page. This reads those
// links out of the product body and, when they resolve to a certificate VialGrade ALREADY INDEPENDENTLY
// HOLDS for that product's compound, stamps the listing's testing claim (issuer + batch) so the
// hardened crossCheckCoa can produce the honest verdict.
//
// Honesty rules this enforces:
//  - It never invents evidence: it only links to Janoshik records already in lab_test_records — the
//    immutable verify URL, not the storefront's (editable) image. An unresolvable link is ignored
//    (fail toward unknown), never trusted.
//  - It never launders a foreign COA as the storefront's own, and never manufactures a counterfeit
//    accusation: it stamps the cited BATCH only when the resolved certificate is the storefront's OWN
//    (same vendor). A different maker's cert (a reseller publishing its supplier's COA) yields an
//    issuer-only claim, which the cross-check reports honestly as "unbacked" — never "mismatch".
//  - It only stamps when the resolved record is for the SAME compound as the product, and it keys its
//    result by compound+URL so a boilerplate footer link can't leak one compound's claim onto another.

import type { SqlConnection } from "@/server/db/client";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface JanoshikRef {
  verifyUrl: string; // canonical https://verify.janoshik.com/tests/<path>
  testId: string;    // leading id segment, e.g. "202438"
}

/** Compound+URL key for a resolved claim. A verify link shared across products of DIFFERENT compounds
 *  (a boilerplate footer) must only resolve for the product whose compound the cert is actually for. */
export function coaKey(compoundSlug: string, verifyUrl: string): string {
  return `${compoundSlug}␟${verifyUrl}`; // U+241F (unit separator symbol) — never appears in a slug or URL
}

/**
 * Pull every Janoshik verify-link reference out of an arbitrary blob of product text (a Shopify
 * product's body_html, a description, etc.). Pure; deduped by canonical verify URL. Returns [] for
 * empty/absent text. Only the immutable verify.janoshik.com/tests/ form is trusted — an image alone
 * (which a storefront can edit) is not a reference.
 */
export function extractJanoshikRefs(text: string | null | undefined): JanoshikRef[] {
  if (!text) return [];
  // Decode the handful of HTML entities that show up inside hrefs so a &amp;-encoded URL still matches.
  const decoded = text.replace(/&amp;/gi, "&").replace(/&#38;/g, "&");
  const re = /https?:\/\/verify\.janoshik\.com\/tests\/([A-Za-z0-9][A-Za-z0-9._%-]*)/gi;
  const byUrl = new Map<string, JanoshikRef>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(decoded)) !== null) {
    const path = m[1];
    const verifyUrl = `https://verify.janoshik.com/tests/${path}`;
    if (byUrl.has(verifyUrl)) continue;
    // The path is usually "<id>-<COMPOUND>_<KEY>"; the id is the leading run before the first - or _.
    const testId = /^([A-Za-z0-9]+)(?:[-_]|$)/.exec(path)?.[1] ?? path;
    byUrl.set(verifyUrl, { verifyUrl, testId });
  }
  return [...byUrl.values()];
}

export interface StorefrontCoaClaim {
  batchCode: string | null; // the storefront's OWN cited batch (null when the cert is a foreign maker's)
  verifyUrl: string;        // which held record backed the claim (provenance)
}

/**
 * Resolve products' Janoshik references against the certificates VialGrade ALREADY HOLDS, scoped to each
 * product's own compound. Returns a map keyed by `coaKey(compoundSlug, verifyUrl)` → the testing claim
 * to stamp; call once per import.
 *
 * We only stamp the cited BATCH when the resolved certificate is attributed to THIS storefront (its
 * own tested batch) — which lets the cross-check reach "batch-verified". When the certificate belongs
 * to a DIFFERENT maker (a reseller publishing its supplier's real COA), stamping that foreign batch
 * would fabricate a batch claim the storefront never made and read as a counterfeit "mismatch". So a
 * foreign cert yields an issuer-only claim (batchCode null): the vendor advertises a Janoshik test,
 * which the cross-check reports honestly as "unbacked" — never an accusation. Fail toward unknown.
 *
 * @param vendorSlug the storefront being imported (to decide same-vendor vs foreign)
 * @param refsByCompound map from compoundSlug -> the verify URLs a product for that compound published
 */
export async function resolveStorefrontCoaClaims(
  db: SqlConnection,
  vendorSlug: string,
  refsByCompound: Map<string, Set<string>>,
): Promise<Map<string, StorefrontCoaClaim>> {
  const out = new Map<string, StorefrontCoaClaim>(); // keyed by coaKey(compound, url)
  const allUrls = [...new Set([...refsByCompound.values()].flatMap((s) => [...s]))];
  if (allUrls.length === 0) return out;
  const vTok = norm(vendorSlug);

  // Only INDEPENDENT records VialGrade holds for the CITED compound count — never a self-published row, and
  // never a certificate for a different compound than the product it's embedded on.
  const rows = (await db.query<{ verify_url: string; compound_slug: string | null; batch_code: string | null; vendor_slug: string | null; manufacturer: string | null }>(
    `SELECT verify_url, compound_slug, batch_code, vendor_slug, manufacturer
       FROM lab_test_records
      WHERE is_independent AND verify_url = ANY($1)`,
    [allUrls],
  )).rows;

  const heldByUrl = new Map(rows.map((r) => [r.verify_url, r]));
  for (const [compoundSlug, urls] of refsByCompound) {
    for (const url of urls) {
      const held = heldByUrl.get(url);
      if (!held || held.compound_slug !== compoundSlug) continue; // compound must match the product
      const key = coaKey(compoundSlug, url);
      if (out.has(key)) continue;
      // Same-vendor → the storefront's OWN tested batch (batch-verified is legitimate). Foreign maker →
      // issuer-only (batchCode null), so we never manufacture a borrowed-cert accusation from a resell.
      const sameVendor = held.vendor_slug === vendorSlug || (held.manufacturer != null && norm(held.manufacturer).includes(vTok));
      const batchCode = sameVendor && held.batch_code && norm(held.batch_code).length >= 6 ? held.batch_code : null;
      out.set(key, { batchCode, verifyUrl: url });
    }
  }
  return out;
}

// ── Advertised-testing detection ────────────────────────────────────────────────────────────────
//
// The 2026-08-12 coverage audit found the wedge above cannot lift coverage for this catalog: across
// 20 live WooCommerce storefronts there are ZERO `verify.janoshik.com` links. What vendors publish
// instead is a marketing CLAIM — "every lot supported by an independent Janoshik COA" — with the
// certificates on a separate page, unlinked per product.
//
// That gap is itself the product's subject. A listing whose vendor advertises third-party testing we
// cannot confirm is meaningfully different from one that claims nothing, and the trust graph already
// has the honest verdict for it: `unbacked` — "Testing unverified".
//
// This output is a PUBLISHED STATEMENT ABOUT A REAL COMPANY, so it is deliberately hard to trigger.
// An adversarial audit of the first version found it firing on a nav link, a sentence about animal
// studies, a smear about a competitor's "fake Janoshik certificates", and an explicit denial ("we do
// not pay for Janoshik reports"). Three rules fix that class:
//
//   1. Evaluate SEGMENTS, not the whole document. Flattened HTML has almost no sentence periods, so
//      a character window silently spanned list items, headings and nav links.
//   2. Require an ASSERTION ("tested by", "verified by", "conducted by"), not a label. "Independent
//      Labs" in a nav is a menu item; "third-party tested" is a claim.
//   3. A named lab is not a claim by itself. It must appear in a segment that asserts testing and is
//      not negated, hypothetical, disparaging, in-house, or about literature/reviews.

const LAB_NAMES: { pattern: RegExp; issuer: string }[] = [
  { pattern: /janoshik/i, issuer: "Janoshik" },
  { pattern: /mz\s*biolabs?/i, issuer: "MZ Biolabs" },
  { pattern: /colmaric/i, issuer: "Colmaric" },
];

// Somebody other than the vendor.
const OUTSIDER = /\b(third[\s-]?party|independent(?:ly)?)\b/i;
// An assertion that testing HAPPENED — not a noun label like "Testing FAQ" or "Independent Labs".
const ASSERTION = /\b(tested|testing\s+is|verified|assayed|analy[sz]ed|screened|conducted|perform(?:s|ed))\b/i;
// A named lab also counts when the segment cites its paperwork.
const PAPERWORK = /\b(coa|certificate of analysis|certificates? of analysis)\b/i;

// Segment-scoped kill switches. Each is checked against the sentence carrying the claim, never the
// whole page — document-scoped negation let one unrelated "no" suppress a genuine claim elsewhere.
const NEGATED = /\b(no|not|never|without|none|don'?t|doesn'?t|cannot|can'?t|isn'?t|aren'?t|lacks?)\b/i;
const HYPOTHETICAL = /\b(coming soon|will be|shall be|plan(?:s|ned)? to|upcoming|when available|once available|pending|soon)\b/i;
const DISPARAGING = /\b(fake|counterfeit|fraudulent|forged|scam|unlike|beware|others?\s+claim)\b/i;
// Scientific literature and marketing about the MOLECULE, not testing of this vendor's product.
const LITERATURE = /\b(stud(?:y|ies)|literature|trials?|peer[\s-]?review|animal|clinical|in vitro|in vivo|research (?:has|have|show|suggest|indicat|demonstrat)|research library|research use)\b/i;
// Social proof and corporate boilerplate that happen to use the same words.
const SOCIAL = /\b(reviews?|buyers?|customers?|researchers?|testimonial|affiliat|partner(?:ed|ship)?|reseller)\b/i;
const IN_HOUSE = /\b(in[\s-]?house|our own|on[\s-]?site|we\s+(?:do|perform|run|conduct))\b/i;

// Page chrome carries menu labels that read like claims out of context.
const CHROME = /<(nav|header|footer|script|style|select|option)\b[^>]*>[\s\S]*?<\/\1>/gi;
// Block-level boundaries. Inline tags (b, i, a, span, strong) are deliberately NOT split on — a
// claim legitimately reads "third-party lab <i>tested</i> by <a>Janoshik</a>".
const BLOCK = /<\/?(p|div|li|ul|ol|h[1-6]|br|tr|td|th|table|section|article|aside|blockquote|dl|dt|dd|form|figure)\b[^>]*>/gi;

function segmentsOf(html: string): string[] {
  return html
    .replace(CHROME, " ")
    .replace(BLOCK, "\u0001")
    .replace(/&#45;/g, "-").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ")
    .replace(/&#8217;/g, "'").replace(/&#8211;/g, "-").replace(/&#8212;/g, "-")
    .replace(/<[^>]+>/g, " ")
    .split(/[\u0001.!?;\u2014\u2013]|\n{2,}/)
    .map(part => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function disqualified(segment: string): boolean {
  return NEGATED.test(segment) || HYPOTHETICAL.test(segment) || DISPARAGING.test(segment)
    || LITERATURE.test(segment) || SOCIAL.test(segment) || IN_HOUSE.test(segment);
}

export interface AdvertisedTesting {
  issuer: string;
}

/**
 * Detects a storefront's claim that an INDEPENDENT party tested the product.
 *
 * Returns the named laboratory when one is identified, otherwise a generic "Third-party lab" for an
 * unnamed claim. Returns null when the copy makes no such claim — a gap must never be upgraded into
 * a claim the vendor did not make.
 */
export function detectAdvertisedTesting(html: string | null | undefined): AdvertisedTesting | null {
  if (!html) return null;
  let generic: AdvertisedTesting | null = null;

  for (const segment of segmentsOf(html)) {
    if (disqualified(segment)) continue;
    const asserts = ASSERTION.test(segment);

    // A named lab is the strongest form, but only inside a segment that actually asserts testing
    // or cites the lab's paperwork. A bare mention is not a claim.
    if (asserts || PAPERWORK.test(segment)) {
      for (const { pattern, issuer } of LAB_NAMES) {
        if (pattern.test(segment)) return { issuer };
      }
    }
    // Unnamed claim: keep looking for a named lab elsewhere on the page before settling for it.
    if (!generic && asserts && OUTSIDER.test(segment)) generic = { issuer: "Third-party lab" };
  }

  return generic;
}
