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
// has the honest verdict for it: `unbacked` — "Testing unverified". This detects the claim so those
// listings stop rendering as a silent "No lab test".
//
// It must stay conservative: the output becomes a published statement about a real business. It fires
// only on an explicit assertion that an OUTSIDE party did the testing — never on in-house testing,
// purity guarantees, or generic "lab grade" copy.

const LAB_NAMES: { pattern: RegExp; issuer: string }[] = [
  { pattern: /janoshik/i, issuer: "Janoshik" },
  { pattern: /mz\s*biolabs?/i, issuer: "MZ Biolabs" },
  { pattern: /colmaric/i, issuer: "Colmaric" },
];

// An outside party did the testing. "third-party tested", "independent lab testing", "tested by an
// independent laboratory". Requires BOTH the outsider word and a testing word near it.
const THIRD_PARTY_CLAIM = /\b(third[\s-]?party|independent(?:ly)?)\b[^.]{0,60}\b(test|tested|testing|assay|assayed|verified|analysis|analyzed|coa|certificate of analysis|lab|laborator)/i;
const TESTING_BY_OUTSIDER = /\b(test|tested|testing|assay|assayed|verified|analy[sz]ed)\b[^.]{0,60}\b(third[\s-]?party|independent(?:ly)?)\b/i;

// Kill switches — copy that mentions the words but is not an outside-testing claim.
const IN_HOUSE = /\b(in[\s-]?house|our own|on[\s-]?site)\b[^.]{0,30}\b(lab|laborator|test)/i;
const NEGATED = /\b(no|not|without|lacks?|never)\b[^.]{0,30}\b(third[\s-]?party|independent)\b/i;

function plainText(html: string): string {
  return html
    .replace(/&#45;/g, "-").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ")
    .replace(/&#8217;/g, "'").replace(/&#8211;/g, "-")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

export interface AdvertisedTesting {
  issuer: string;
}

/**
 * Detects a storefront's claim that an INDEPENDENT party tested the product.
 *
 * Returns the named laboratory when one is identified, otherwise a generic "Third-party lab" for an
 * unnamed claim. Returns null when the copy makes no outside-testing claim — a gap must never be
 * upgraded into a claim the vendor did not make.
 */
export function detectAdvertisedTesting(html: string | null | undefined): AdvertisedTesting | null {
  if (!html) return null;
  const text = plainText(html);
  if (NEGATED.test(text)) return null;

  // A named independent lab is the strongest form of the claim and stands on its own.
  for (const { pattern, issuer } of LAB_NAMES) {
    if (pattern.test(text)) return { issuer };
  }

  if (IN_HOUSE.test(text)) return null;
  if (THIRD_PARTY_CLAIM.test(text) || TESTING_BY_OUTSIDER.test(text)) return { issuer: "Third-party lab" };
  return null;
}
