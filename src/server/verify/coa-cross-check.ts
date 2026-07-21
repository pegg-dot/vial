// COA cross-verification — the check that catches a vendor whose paperwork doesn't hold up.
//
// A listing ADVERTISES third-party testing (an issuer like Janoshik, a batch code, a
// "report confirmed" flag). That's the vendor's own claim. This module cross-checks that
// claim against the INDEPENDENT lab_test_records we ingested straight from the lab's public
// feed — evidence the vendor can't edit. Two scams fall out of that comparison:
//
//   1. Unbacked claim — the vendor says "Janoshik tested" but no independent Janoshik record
//      references this vendor for this compound. The certificate might be real and just
//      un-indexed, or it might be fabricated; either way the claim is currently unbacked.
//   2. Borrowed certificate — the batch the vendor cites resolves to an independent record
//      whose actual manufacturer is a DIFFERENT vendor. A recycled cert from someone else's
//      product. This is the strongest red flag we can raise from documents alone.
//
// It never asserts a product is safe or pure — only whether the vendor's paperwork is
// consistent with independent evidence, or where it diverges.

import type { SqlConnection } from "@/server/db/client";
import type { Signal } from "./index";

export type CrossCheckStatus = "verified" | "batch-verified" | "unbacked" | "mismatch" | "low-purity" | "no-claim";

export interface CoaCrossCheck {
  status: CrossCheckStatus;
  headline: string;
  detail: string;
  signals: Signal[];
  independentPurity?: number | null;
  independentUrl?: string;
  claimedIssuer?: string;
}

export interface ListingCoaInput {
  vendorSlug: string;
  vendorName?: string;
  compoundSlug: string;
  compoundName?: string;
  reportIssuer?: string;
  reportConfirmed?: boolean;
  batchCode?: string;
}

// Issuers that name a real independent lab (as opposed to "in-house", "COA on file", none).
const REAL_LAB = /janoshik|jano|mz\b|mz biolabs|colmaric|peptide test|third[\s-]?party|independent/i;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

interface LabRow {
  vendor_slug: string | null; manufacturer: string; compound_slug: string | null;
  batch_code: string | null; purity_pct: string | number | null; verify_url: string; sample_name: string;
}

/**
 * Cross-check a listing's advertised testing against independent lab records.
 * Pure read; never mutates. Returns a verdict a non-expert can act on.
 */
export async function crossCheckCoa(db: SqlConnection, input: ListingCoaInput): Promise<CoaCrossCheck> {
  const vendorLabel = input.vendorName ?? input.vendorSlug.replace(/-/g, " ");
  const compoundLabel = input.compoundName ?? input.compoundSlug.replace(/-/g, " ");
  const claimsTesting = Boolean(input.reportConfirmed) && REAL_LAB.test(input.reportIssuer ?? "");

  // Independent records for this vendor + compound (evidence the vendor can't edit).
  const independent = (await db.query<LabRow>(
    `SELECT vendor_slug,manufacturer,compound_slug,batch_code,purity_pct,verify_url,sample_name
       FROM lab_test_records
      WHERE compound_slug = $1 AND (vendor_slug = $2 OR LOWER(manufacturer) LIKE $3)
      ORDER BY purity_pct DESC NULLS LAST`,
    [input.compoundSlug, input.vendorSlug, `%${input.vendorSlug.replace(/-/g, "%")}%`],
  )).rows;

  // 1. Borrowed-certificate check: does the cited batch resolve to a record made by SOMEONE ELSE?
  if (input.batchCode && input.batchCode.trim().length >= 4) {
    const bc = norm(input.batchCode);
    const byBatch = (await db.query<LabRow>(
      `SELECT vendor_slug,manufacturer,compound_slug,batch_code,purity_pct,verify_url,sample_name
         FROM lab_test_records
        WHERE batch_code IS NOT NULL AND REGEXP_REPLACE(LOWER(batch_code),'[^a-z0-9]','','g') = $1
        LIMIT 1`,
      [bc],
    )).rows[0];
    if (byBatch) {
      const sameVendor = byBatch.vendor_slug === input.vendorSlug || norm(byBatch.manufacturer).includes(norm(input.vendorSlug));
      if (!sameVendor && (byBatch.vendor_slug || byBatch.manufacturer)) {
        return {
          status: "mismatch",
          claimedIssuer: input.reportIssuer,
          headline: "Cited certificate belongs to a different manufacturer",
          detail: `The batch this listing cites resolves to an independent record made by ${byBatch.manufacturer}, not ${vendorLabel}. A certificate borrowed from another maker is one of the clearest counterfeit signals — do not treat it as proof of this vendor's product.`,
          independentUrl: byBatch.verify_url,
          signals: [
            { ok: false, label: "Certificate attribution", detail: `Batch traces to ${byBatch.manufacturer}, not ${vendorLabel}.` },
            { ok: false, label: "As proof of this product", detail: "A borrowed COA proves nothing about what's actually in this vial." },
          ],
        };
      }
      // Exact batch, right maker — the strongest positive we can give from documents.
      const p = byBatch.purity_pct != null ? Number(byBatch.purity_pct) : null;
      return {
        status: "batch-verified",
        claimedIssuer: input.reportIssuer,
        independentPurity: p,
        independentUrl: byBatch.verify_url,
        headline: `This exact batch was independently tested${p != null ? ` at ${p.toFixed(2)}%` : ""}`,
        detail: `The batch this listing cites matches an independent record from the lab's own feed, attributed to ${vendorLabel}. That's the same batch, tested by a third party — the best documentary evidence available. It still isn't a promise about the vial you'll receive.`,
        signals: [
          { ok: true, label: "Certificate attribution", detail: `Batch resolves to an independent record for ${vendorLabel}.` },
          { ok: p != null ? p >= 95 : null, label: "Measured purity", detail: p != null ? `Independently measured at ${p.toFixed(2)}%.` : "Purity not printed on the certificate." },
        ],
      };
    }
  }

  // 2. Backing check: they advertise real-lab testing — is there ANY independent record for them?
  const best = independent[0];
  const bestPurity = best?.purity_pct != null ? Number(best.purity_pct) : null;

  if (claimsTesting) {
    if (!best) {
      return {
        status: "unbacked",
        claimedIssuer: input.reportIssuer,
        headline: `${input.reportIssuer} testing advertised, but not independently confirmed`,
        detail: `This listing advertises ${input.reportIssuer} testing, yet no independent ${input.reportIssuer} record in our index references ${vendorLabel} for ${compoundLabel}. That doesn't prove the certificate is fake — but until it resolves at the lab, treat the testing claim as unbacked, not verified.`,
        signals: [
          { ok: null, label: "Vendor claim", detail: `Advertises ${input.reportIssuer} testing${input.batchCode ? ` (batch ${input.batchCode})` : ""}.` },
          { ok: false, label: "Independent confirmation", detail: `No ${input.reportIssuer} record found for ${vendorLabel}. Verify the certificate at the lab before trusting it.` },
        ],
      };
    }
    // Advertised AND independently backed. Surface the measured purity honestly.
    const low = bestPurity != null && bestPurity < 95;
    return {
      status: low ? "low-purity" : "verified",
      claimedIssuer: input.reportIssuer,
      independentPurity: bestPurity,
      independentUrl: best.verify_url,
      headline: low
        ? `Independently tested — but measured ${bestPurity!.toFixed(2)}%`
        : `Testing claim is backed by an independent record`,
      detail: low
        ? `${vendorLabel} does have an independent record for ${compoundLabel}, but the measured purity (${bestPurity!.toFixed(2)}%) is below the ~98–99% these products usually advertise. Lower-than-claimed purity is exactly what independent testing exists to catch.`
        : `An independent record for ${vendorLabel}'s ${compoundLabel} exists in the lab's own feed${bestPurity != null ? `, measured at ${bestPurity.toFixed(2)}%` : ""}. The advertised testing is backed by evidence the vendor can't edit — though not necessarily the exact batch you'll receive.`,
      signals: [
        { ok: true, label: "Independent confirmation", detail: `A third-party record references ${vendorLabel} for ${compoundLabel}.` },
        { ok: bestPurity != null ? bestPurity >= 95 : null, label: "Measured purity", detail: bestPurity != null ? `Independently measured at ${bestPurity.toFixed(2)}%.` : "Purity not printed on the certificate." },
      ],
    };
  }

  // 3. No testing claim to check. If we happen to hold an independent record anyway, surface it.
  if (best) {
    return {
      status: "verified",
      independentPurity: bestPurity,
      independentUrl: best.verify_url,
      headline: `Independent test on record${bestPurity != null ? ` — ${bestPurity.toFixed(2)}%` : ""}`,
      detail: `This listing doesn't advertise third-party testing, but we do hold an independent record for ${vendorLabel}'s ${compoundLabel}${bestPurity != null ? `, measured at ${bestPurity.toFixed(2)}%` : ""}. Bonus evidence, not a guarantee of this specific batch.`,
      signals: [{ ok: true, label: "Independent record", detail: `A third-party test references ${vendorLabel} for ${compoundLabel}.` }],
    };
  }

  return {
    status: "no-claim",
    headline: "No third-party testing to cross-check",
    detail: `This listing doesn't advertise independent lab testing, and we don't hold an independent record for ${vendorLabel}'s ${compoundLabel}. Absence of a certificate isn't proof of anything — but there's nothing here to verify.`,
    signals: [{ ok: false, label: "Independent testing", detail: "No third-party COA advertised or on record." }],
  };
}
