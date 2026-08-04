import { getCatalogSnapshot } from "@/server/catalog/repository";
import { getDatabase } from "@/server/db/client";
import { vendorPriceIndex } from "@/lib/curation";
import { listRegulatoryActions } from "@/server/regulatory/repository";
import { getFlaggedVendorSlugs } from "@/server/verify/coa-integrity";
import type { ReviewSentiment, VendorDirectoryEntry } from "@/lib/vendor-ranking";

const SEVERITY_RANK: Record<string, number> = { severe: 2, caution: 1 };

export async function getVendorDirectory(): Promise<VendorDirectoryEntry[]> {
  const [{ vendors, products }, db] = await Promise.all([getCatalogSnapshot(), getDatabase()]);
  const [regActions, flagged, statusRows, reviewRows] = await Promise.all([
    listRegulatoryActions(db, 500),
    getFlaggedVendorSlugs(db),
    db.query<{ vendor_slug: string; status: string }>(`SELECT vendor_slug, status FROM vendor_status WHERE status <> 'operating'`),
    db.query<{ vendor_slug: string; sentiment: ReviewSentiment }>(`SELECT vendor_slug, sentiment FROM vendor_reviews`),
  ]);

  const worstEnforcement = new Map<string, "severe" | "caution">();
  for (const a of regActions) {
    if (!a.vendor_slug) continue;
    const cur = worstEnforcement.get(a.vendor_slug);
    const sev = a.severity === "severe" ? "severe" : a.severity === "caution" ? "caution" : null;
    if (!sev) continue;
    if (!cur || SEVERITY_RANK[sev] > SEVERITY_RANK[cur]) worstEnforcement.set(a.vendor_slug, sev);
  }
  const defunct = new Set(statusRows.rows.map((r) => r.vendor_slug));
  const sentiment = new Map(reviewRows.rows.map((r) => [r.vendor_slug, r.sentiment]));

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
    const isDefunct = defunct.has(vendor.slug);
    const integrityFlagged = flagged.has(vendor.slug);
    const reviewSentiment = sentiment.get(vendor.slug) ?? null;
    const redFlag = enforcement === "severe" || isDefunct || reviewSentiment === "scam" || integrityFlagged;
    return {
      vendor,
      priceIndex: idx.medianPctVsMarket,
      pricedListings: idx.comparedCount,
      enforcement,
      defunct: isDefunct,
      integrityFlagged,
      reviewSentiment,
      redFlag,
    };
  });
}
