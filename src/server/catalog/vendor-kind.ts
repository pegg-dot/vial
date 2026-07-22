// Distinguish a retail STOREFRONT (a place a buyer can actually shop) from a MANUFACTURER — an
// upstream factory/wholesaler we only know about because it ordered a third-party lab test. Both
// were being shown identically on /vendors, which misleads: "Zztai Peptide" (a factory that
// appears in a Janoshik "Made By" field) is not somewhere a normal buyer purchases, the way
// "Peptide Pros" is. A vendor is a storefront if it has a shoppable catalog OR is one of the
// curated retail vendors (from the vendor list / the vendors that publish their own COAs);
// everything else — vendors surfaced purely from the lab feed — is an upstream manufacturer.

import type { SqlConnection } from "@/server/db/client";

export type VendorKind = "storefront" | "manufacturer";

export function classifyVendorKind(input: { slug: string; hasListings: boolean; retailSlugs: Set<string> }): VendorKind {
  if (input.hasListings) return "storefront";
  if (input.retailSlugs.has(input.slug)) return "storefront";
  return "manufacturer";
}

/**
 * Classify every live vendor as storefront or manufacturer and store it. `retailSlugs` is the set of
 * curated retail vendors (from the vendor list + the vendors that publish their own COAs); a vendor
 * with a shoppable catalog is always a storefront. Idempotent; returns how many landed in each kind.
 */
export async function reconcileVendorKinds(db: SqlConnection, retailSlugs: Set<string>): Promise<{ storefront: number; manufacturer: number; changed: number }> {
  const rows = (await db.query<{ slug: string; vendor_kind: string; has_listings: boolean }>(
    `SELECT o.slug, o.vendor_kind, EXISTS(SELECT 1 FROM products p WHERE p.vendor_id=o.id) has_listings
     FROM organizations o WHERE o.origin='live' AND o.organization_type='vendor'`,
  )).rows;
  let storefront = 0, manufacturer = 0, changed = 0;
  for (const r of rows) {
    const kind = classifyVendorKind({ slug: r.slug, hasListings: Boolean(r.has_listings), retailSlugs });
    if (kind === "storefront") storefront++; else manufacturer++;
    if (kind !== r.vendor_kind) { await db.query(`UPDATE organizations SET vendor_kind=$1, updated_at=NOW() WHERE slug=$2`, [kind, r.slug]); changed++; }
  }
  return { storefront, manufacturer, changed };
}
