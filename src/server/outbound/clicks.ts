import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { buildOutboundUrl } from "./affiliate";
import { deviceOf, newClickRef, tagDestination, visitorHash } from "./attribution";
import { isBotUserAgent } from "@/server/analytics/is-bot";

export interface OutboundResolution { destination: string; vendorSlug: string | null; compoundSlug: string | null; affiliateApplied: boolean; clickRef: string }

/**
 * Resolve a listing slug to the vendor's real product URL and record the click. The destination is
 * ALWAYS looked up from our own stored external_url for that listing — never taken from the request
 * — so this can't be turned into an open redirect. Only live listings with a real URL resolve.
 */
export async function resolveAndRecordClick(
  listingSlug: string,
  connection?: SqlConnection,
  visitor?: { ip?: string | null; userAgent?: string | null; landingPath?: string | null },
): Promise<OutboundResolution | null> {
  const db = connection ?? (await getDatabase());
  const row = (await db.query<QueryResultRow & { external_url: string | null; vendor_slug: string | null; compound_slug: string | null; origin: string | null }>(
    `SELECT l.external_url, o.slug vendor_slug, c.slug compound_slug, l.origin
     FROM listings l
     JOIN products p ON p.id = l.product_id
     LEFT JOIN organizations o ON o.id = p.vendor_id
     LEFT JOIN compounds c ON c.id = p.compound_id
     WHERE l.slug = $1`, [listingSlug],
  )).rows[0];
  if (!row || row.origin !== "live" || !row.external_url) return null;

  let host: string | null = null;
  try { host = new URL(row.external_url).host.replace(/^www\./, ""); } catch { return null; }

  const clickRef = newClickRef();
  const { url, affiliateApplied } = buildOutboundUrl(row.vendor_slug ?? "", row.external_url);
  // A negotiated affiliate rule already carries its own tracking; only tag the plain pass-through.
  // The UTM tags are what let a vendor confirm our traffic in THEIR analytics with no integration.
  const destination = affiliateApplied
    ? url
    : tagDestination(url, { compoundSlug: row.compound_slug, listingSlug, clickRef });

  await db.query(
    `INSERT INTO outbound_clicks(id, listing_slug, vendor_slug, compound_slug, destination_host,
       affiliate_applied, click_ref, visitor_hash, landing_path, device, is_bot)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      newId("click"), listingSlug, row.vendor_slug, row.compound_slug, host, affiliateApplied,
      clickRef,
      visitorHash(visitor?.ip ?? null, visitor?.userAgent ?? null),
      visitor?.landingPath ?? null,
      deviceOf(visitor?.userAgent ?? null),
      // Recorded, not discarded: the handoff still happens and the row is still evidence the link
      // works. It is simply excluded from anything we would say to a vendor.
      isBotUserAgent(visitor?.userAgent ?? null),
    ],
  );
  return { destination, vendorSlug: row.vendor_slug, compoundSlug: row.compound_slug, affiliateApplied, clickRef };
}

export interface VendorClickStat { vendorSlug: string; clicks: number; lastClickAt: string | null }

/** Per-vendor outbound demand — the data you show a vendor to open an affiliate conversation. */
export async function getVendorClickStats(connection?: SqlConnection, days = 90): Promise<VendorClickStat[]> {
  const db = connection ?? (await getDatabase());
  return (await db.query<QueryResultRow & { vendor_slug: string; clicks: string | number; last_click: string | null }>(
    `SELECT vendor_slug, COUNT(*) clicks, MAX(created_at) last_click
     FROM outbound_clicks WHERE vendor_slug IS NOT NULL AND created_at > NOW() - ($1 || ' days')::interval
     GROUP BY vendor_slug ORDER BY clicks DESC`, [String(days)],
  )).rows.map((r) => ({ vendorSlug: r.vendor_slug, clicks: Number(r.clicks), lastClickAt: r.last_click }));
}
