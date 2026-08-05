import { getCatalogSnapshot } from "@/server/catalog/repository";
import { getDatabase } from "@/server/db/client";
import { vendorPriceIndex } from "@/lib/curation";
import { listRegulatoryActions } from "@/server/regulatory/repository";
import { getFlaggedVendorSlugs } from "@/server/verify/coa-integrity";
import { composeVerdict } from "@/server/verify/trust-graph";
import type { Verdict } from "@/server/verify";
import type { ReviewSentiment, VendorDirectoryEntry } from "@/lib/vendor-ranking";

const SEVERITY_RANK: Record<string, number> = { severe: 2, caution: 1 };

export interface VendorRiskSignals {
  enforcement: Array<{ severity: string }>;
  reviewSentiment: string | null;
  reviewVolume: string | null;      // how many reports back the sentiment — gates whether a negative can force "avoid"
  reviewConfidence: string | null;  // how sure the gather was — same gate
  communitySentiment: string | null;
  links: Array<{ strength: string; linkedSlug: string }>;
  status: string;                 // vendor_status kind, or "operating"
  integrityFlagged: boolean;
}

// The directory's per-vendor risk IS the composed verdict the vendor page and /verify show — never
// a second, ad-hoc rule. redFlag (the ranking gate that sinks a vendor under every priority) is
// exactly "the verdict is avoid". composeVerdict decides every nuance in one place: negative/scam
// reviews and community/operator-network links are avoid; a borrowed-COA integrity flag or a
// caution-level enforcement record is caution (not avoid); a `blocked` status (bot protection, not
// death) is ignored. reputationDimensions/aggregators/signals are the seams NOT batched here; they
// only ever produce caution/trust reasons, never avoid, so the redFlag gate is exact — only a rare
// caution-level display nuance (e.g. an open reputation risk-flag or a very young domain) lives on
// the vendor page and not the directory card. If you ever add an AVOID reason to composeVerdict
// from a new seam, batch-load that seam in getVendorDirectory too, or the directory will miss it.
export function assessVendorRisk(
  vendor: { name: string; coaCount: number; medianPurity: number | null },
  s: VendorRiskSignals,
): { verdict: Verdict; redFlag: boolean } {
  const composed = composeVerdict({
    vendorName: vendor.name,
    coaCount: vendor.coaCount,
    medianPurity: vendor.medianPurity,
    blindCount: 0,
    enforcement: s.enforcement,
    reputationDimensions: [],
    aggregators: [],
    signals: null,
    review: s.reviewSentiment ? { sentiment: s.reviewSentiment, reviewVolume: s.reviewVolume ?? undefined, confidence: s.reviewConfidence ?? undefined } : null,
    community: s.communitySentiment ? { sentiment: s.communitySentiment } : null,
    links: s.links,
    status: { status: s.status },
    flagCount: s.integrityFlagged ? 1 : 0,
  });
  return { verdict: composed.verdict, redFlag: composed.verdict === "avoid" };
}

export async function getVendorDirectory(): Promise<VendorDirectoryEntry[]> {
  const [{ vendors, products }, db] = await Promise.all([getCatalogSnapshot(), getDatabase()]);
  const [regActions, flagged, statusRows, reviewRows, communityRows, linkRows] = await Promise.all([
    listRegulatoryActions(db, 500),
    getFlaggedVendorSlugs(db),
    db.query<{ vendor_slug: string; status: string }>(`SELECT vendor_slug, status FROM vendor_status WHERE status <> 'operating'`),
    db.query<{ vendor_slug: string; sentiment: ReviewSentiment; review_volume: string; confidence: string }>(`SELECT vendor_slug, sentiment, review_volume, confidence FROM vendor_reviews`),
    db.query<{ vendor_slug: string; sentiment: string }>(`SELECT DISTINCT ON (vendor_slug) vendor_slug, sentiment FROM community_mentions ORDER BY vendor_slug, fetched_at DESC`),
    db.query<{ vendor_slug: string; linked_slug: string; strength: string }>(`SELECT vendor_slug, linked_slug, strength FROM vendor_links`),
  ]);

  // Group the batch reads by vendor. Enforcement keeps both the full list (for the verdict) and the
  // worst severity (for the directory badge).
  const enforcementByVendor = new Map<string, Array<{ severity: string }>>();
  const worstEnforcement = new Map<string, "severe" | "caution">();
  for (const a of regActions) {
    if (!a.vendor_slug) continue;
    const arr = enforcementByVendor.get(a.vendor_slug);
    if (arr) arr.push({ severity: a.severity }); else enforcementByVendor.set(a.vendor_slug, [{ severity: a.severity }]);
    const sev = a.severity === "severe" ? "severe" : a.severity === "caution" ? "caution" : null;
    if (sev) { const cur = worstEnforcement.get(a.vendor_slug); if (!cur || SEVERITY_RANK[sev] > SEVERITY_RANK[cur]) worstEnforcement.set(a.vendor_slug, sev); }
  }
  const statusByVendor = new Map(statusRows.rows.map((r) => [r.vendor_slug, r.status]));
  const reviewByVendor = new Map(reviewRows.rows.map((r) => [r.vendor_slug, r]));
  const communityByVendor = new Map(communityRows.rows.map((r) => [r.vendor_slug, r.sentiment]));
  const linksByVendor = new Map<string, Array<{ strength: string; linkedSlug: string }>>();
  for (const r of linkRows.rows) {
    const arr = linksByVendor.get(r.vendor_slug);
    if (arr) arr.push({ strength: r.strength, linkedSlug: r.linked_slug }); else linksByVendor.set(r.vendor_slug, [{ strength: r.strength, linkedSlug: r.linked_slug }]);
  }

  const listingsByVendor = new Map<string, typeof products>();
  for (const p of products) {
    const arr = listingsByVendor.get(p.vendorSlug);
    if (arr) arr.push(p);
    else listingsByVendor.set(p.vendorSlug, [p]);
  }

  return vendors.map((vendor) => {
    const listings = listingsByVendor.get(vendor.slug) ?? [];
    const idx = vendorPriceIndex(listings, products);
    const enforcement = worstEnforcement.get(vendor.slug) ?? null;
    const statusKind = statusByVendor.get(vendor.slug) ?? "operating";
    const integrityFlagged = flagged.has(vendor.slug);
    const review = reviewByVendor.get(vendor.slug) ?? null;
    const reviewSentiment = review?.sentiment ?? null;
    const { verdict, redFlag } = assessVendorRisk(vendor, {
      enforcement: enforcementByVendor.get(vendor.slug) ?? [],
      reviewSentiment,
      reviewVolume: review?.review_volume ?? null,
      reviewConfidence: review?.confidence ?? null,
      communitySentiment: communityByVendor.get(vendor.slug) ?? null,
      links: linksByVendor.get(vendor.slug) ?? [],
      status: statusKind,
      integrityFlagged,
    });
    // "Defunct" = a genuinely dead storefront (offline/parked), matching composeVerdict's avoid.
    // A `blocked` (bot-protection) or `redirected` status is NOT death and must not read as defunct.
    const defunct = statusKind === "offline" || statusKind === "parked";
    return {
      vendor,
      priceIndex: idx.medianPctVsMarket,
      pricedListings: idx.comparedCount,
      enforcement,
      defunct,
      integrityFlagged,
      reviewSentiment,
      verdict,
      redFlag,
    };
  });
}
