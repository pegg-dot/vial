// Listing trust — the compact verdict that rides on EVERY product, everywhere it appears.
//
// The product page runs the full crossCheckCoa() (one listing, precise, with prose). But a
// buyer scanning the market grid, the compare table, or search results needs the same verdict
// at a glance without a query per card. This computes all of them in ONE lab-records read and
// attaches a small chip + optional price flag to each product, using the SAME decision core
// (coaStatusFrom) as the full panel — so the glance and the detail always agree.

import type { SqlConnection } from "@/server/db/client";
import type { ListingTrust, ListingTrustStatus } from "@/lib/types";
import { coaStatusFrom, claimsRealTesting } from "./coa-cross-check";
import { getFlaggedVendorSlugs } from "./coa-integrity";

export type { ListingTrust };

export interface TrustInput {
  slug: string;
  vendorSlug: string;
  compoundSlug: string;
  reportIssuer?: string;
  reportConfirmed?: boolean;
  advertisesTesting?: boolean;
  batchCode?: string;
  price?: number;
  previousPrice?: number;
  pricePerMg?: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// tone drives BOTH color and whether the chip is "high-signal" (pops on cards). The two
// positives and the two real red/amber flags pop; the everyday "we can't confirm this yet"
// states stay quiet gray so a grid shows verification state everywhere without a wall of amber.
const CHIP: Record<ListingTrustStatus, { tone: ListingTrust["tone"]; label: string; detail: string }> = {
  "batch-verified": { tone: "good", label: "Batch tested", detail: "The exact cited batch resolves to an independent lab record for this vendor." },
  verified: { tone: "good", label: "Independently tested", detail: "An independent lab record backs this vendor's testing for this compound." },
  "low-purity": { tone: "warn", label: "Tested below claim", detail: "Independently measured purity is below what these products usually advertise." },
  mismatch: { tone: "bad", label: "Cert mismatch", detail: "The cited certificate resolves to a different manufacturer — a counterfeit signal." },
  unbacked: { tone: "neutral", label: "Testing unverified", detail: "Advertises third-party testing, but no independent record confirms it yet — treat as unproven, not verified." },
  "no-claim": { tone: "neutral", label: "No lab test", detail: "No independent third-party COA is advertised or on record for this listing." },
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

interface LabRow { vendor_slug: string | null; manufacturer: string; compound_slug: string | null; batch_code: string | null; purity_pct: string | number | null; is_independent: boolean }

/** Compute a compact trust verdict for many listings in one lab-records read. */
export async function computeListingTrustMap(db: SqlConnection, listings: TrustInput[]): Promise<Map<string, ListingTrust>> {
  const out = new Map<string, ListingTrust>();
  if (listings.length === 0) return out;

  const flaggedVendors = await getFlaggedVendorSlugs(db);
  const compoundSlugs = [...new Set(listings.map((l) => l.compoundSlug))];
  const records = (await db.query<LabRow>(
    `SELECT vendor_slug,manufacturer,compound_slug,batch_code,purity_pct,is_independent
       FROM lab_test_records WHERE compound_slug = ANY($1)`,
    [compoundSlugs],
  )).rows;

  // Borrowed-certificate detection must see the WHOLE lab corpus, not just the compounds in
  // this set: a cited batch can resolve to a record for a compound that isn't actively listed
  // (the lab feed is broader than the catalog). Scope this exactly like the full crossCheckCoa()
  // batch query, or the grid chip would miss a counterfeit the product page flags red. Ordered
  // so a batch shared by multiple records resolves deterministically.
  const batchRecords = (await db.query<LabRow>(
    `SELECT vendor_slug,manufacturer,compound_slug,batch_code,purity_pct,is_independent
       FROM lab_test_records
      WHERE batch_code IS NOT NULL
      ORDER BY tested_at DESC NULLS LAST, id`,
  )).rows;
  // ALL records per normalized batch code, so a listing's cited batch is judged against the RIGHT
  // one: a positive needs the vendor's OWN independent record for THIS compound; a different maker's
  // record is the borrowed-cert signal. Floor ≥6 so short/date-like codes can't collide.
  const batchByCode = new Map<string, LabRow[]>();
  for (const r of batchRecords) {
    if (r.batch_code) { const k = norm(r.batch_code); if (k.length >= 6) { const a = batchByCode.get(k); if (a) a.push(r); else batchByCode.set(k, [r]); } }
  }

  // Compound-level independent evidence: how many COAs (and their median measured purity) we
  // hold for each compound, across ALL manufacturers. Real market intelligence a buyer can use
  // to judge a vendor's claim, even when the vendor itself has no COA.
  const coasByCompound = new Map<string, { count: number; purities: number[] }>();
  for (const r of records) {
    if (!r.compound_slug || !r.is_independent) continue;   // "independent COAs" must exclude self-published
    const agg = coasByCompound.get(r.compound_slug) ?? { count: 0, purities: [] };
    agg.count += 1;
    if (r.purity_pct != null) agg.purities.push(Number(r.purity_pct));
    coasByCompound.set(r.compound_slug, agg);
  }

  // Per-compound median $/mg for the too-cheap detector.
  const perMgByCompound = new Map<string, number[]>();
  for (const l of listings) {
    if (l.pricePerMg && l.pricePerMg > 0) {
      const arr = perMgByCompound.get(l.compoundSlug) ?? [];
      arr.push(l.pricePerMg); perMgByCompound.set(l.compoundSlug, arr);
    }
  }

  for (const l of listings) {
    // Independent records for this vendor + compound.
    const vTok = norm(l.vendorSlug);
    const independent = records.filter((r) => r.is_independent && r.compound_slug === l.compoundSlug && (r.vendor_slug === l.vendorSlug || (r.manufacturer && norm(r.manufacturer).includes(vTok))));
    const purities = independent.map((r) => (r.purity_pct != null ? Number(r.purity_pct) : null)).filter((p): p is number => p != null);
    const bestPurity = purities.length ? Math.max(...purities) : null;

    const bc = l.batchCode && norm(l.batchCode).length >= 6 ? norm(l.batchCode) : null;
    const batchRows = bc ? (batchByCode.get(bc) ?? []) : [];
    const isSameVendor = (r: LabRow) => r.vendor_slug === l.vendorSlug || (Boolean(r.manufacturer) && norm(r.manufacturer).includes(vTok));
    // Positive: the vendor's OWN independent record for THIS compound. Borrowed: a different maker's
    // INDEPENDENT record (an editable self-published foreign COA sharing a batch code must not accuse).
    const batchHit = batchRows.find((r) => isSameVendor(r) && r.compound_slug === l.compoundSlug && r.is_independent)
                  ?? batchRows.find((r) => !isSameVendor(r) && r.is_independent && (r.vendor_slug || r.manufacturer))
                  ?? null;

    const status = coaStatusFrom({
      claimsTesting: claimsRealTesting(l.reportIssuer, l.reportConfirmed, l.advertisesTesting),
      batchCode: l.batchCode,
      byBatch: batchHit ? { vendor_slug: batchHit.vendor_slug, manufacturer: batchHit.manufacturer } : null,
      vendorSlug: l.vendorSlug,
      hasIndependent: independent.length > 0,
      bestPurity,
    });

    // Price flags — a genuine deal (drop) vs. a suspicious one (far below market rate).
    let priceFlag: ListingTrust["priceFlag"] = null;
    let priceNote: string | null = null;
    const perMg = perMgByCompound.get(l.compoundSlug) ?? [];
    if (l.pricePerMg && perMg.length >= 4 && l.pricePerMg < median(perMg) * 0.45) {
      priceFlag = "too-cheap";
      priceNote = "Priced far below the market rate for this compound — often underdosing or a fake, not a deal.";
    } else if (l.previousPrice && l.price != null && l.previousPrice > l.price) {
      const pct = Math.round(((l.previousPrice - l.price) / l.previousPrice) * 100);
      if (pct >= 8) { priceFlag = "price-drop"; priceNote = `Price dropped ${pct}% from ${l.previousPrice}.`; }
    }

    const agg = coasByCompound.get(l.compoundSlug);
    const compoundCoas = agg?.count ?? 0;
    const compoundMedianPurity = agg && agg.purities.length ? median(agg.purities) : null;

    // Real cost per active mg: prefer THIS vendor's measured purity, fall back to the compound
    // median. Only computed where we have a real purity and a real $/mg.
    const effectivePurity = bestPurity ?? compoundMedianPurity;
    const purityBasis: "vendor" | "compound" | null = bestPurity != null ? "vendor" : compoundMedianPurity != null ? "compound" : null;
    const adjustedPricePerMg = l.pricePerMg && l.pricePerMg > 0 && effectivePurity && effectivePurity > 0 ? l.pricePerMg / (effectivePurity / 100) : null;

    const chip = CHIP[status];
    out.set(l.slug, { status, tone: chip.tone, label: chip.label, detail: chip.detail, priceFlag, priceNote, compoundCoas, compoundMedianPurity, vendorFlagged: flaggedVendors.has(l.vendorSlug), adjustedPricePerMg, purityBasis });
  }

  return out;
}
