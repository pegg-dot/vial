// The evidence pack you put in front of a vendor.
//
// The pitch is: "we sent you N click-throughs last month, for free. Here is how to check that in
// your own dashboard. Now let's talk about a cut." Everything is designed to survive a sceptic:
// every number is one they can independently corroborate, and the report says exactly how.
import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { UTM_SOURCE } from "./attribution";
import { countingDaySql } from "@/server/analytics/counting-day";

export interface PartnerReport {
  vendorSlug: string;
  vendorName: string;
  periodDays: number;
  clicks: number;
  /** Distinct daily visitor hashes — VISITOR-DAYS. A person returning tomorrow counts twice. */
  visitorDays: number;
  listingsClicked: number;
  topCompounds: { compound: string; clicks: number }[];
  daily: { day: string; clicks: number }[];
  devices: { device: string; clicks: number }[];
  firstClickAt: string | null;
  lastClickAt: string | null;
  // Closed-loop figures. Zero until the vendor supplies a coupon code or a postback.
  conversions: number;
  revenueCents: number;
  couponCode: string | null;
  status: string;
  // How the vendor can verify our claim WITHOUT trusting us.
  verification: { utmSource: string; where: string[] };
}

export async function getPartnerReport(
  vendorSlug: string,
  options: { days?: number; connection?: SqlConnection } = {},
): Promise<PartnerReport | null> {
  const db = options.connection ?? await getDatabase();
  const days = options.days ?? 30;
  const window = `${days} days`;

  const vendor = (await db.query<QueryResultRow & { display_name: string }>(
    `SELECT display_name FROM organizations WHERE slug=$1`, [vendorSlug],
  )).rows[0];
  if (!vendor) return null;

  const totals = (await db.query<QueryResultRow & {
    clicks: string | number; people: string | number; listings: string | number;
    first_at: string | null; last_at: string | null;
    conversions: string | number; revenue: string | number | null;
  }>(
    `SELECT COUNT(*) clicks,
            COUNT(DISTINCT visitor_hash) people,
            COUNT(DISTINCT listing_slug) listings,
            MIN(created_at) first_at, MAX(created_at) last_at,
            COUNT(converted_at) conversions,
            COALESCE(SUM(order_value_cents),0) revenue
     FROM outbound_clicks
     WHERE vendor_slug=$1 AND NOT is_bot AND created_at > NOW() - $2::interval`,
    [vendorSlug, window],
  )).rows[0]!;

  const topCompounds = (await db.query<QueryResultRow & { compound_slug: string; n: string | number }>(
    `SELECT compound_slug, COUNT(*) AS n FROM outbound_clicks
     WHERE vendor_slug=$1 AND NOT is_bot AND compound_slug IS NOT NULL AND created_at > NOW() - $2::interval
     GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
    [vendorSlug, window],
  )).rows.map(r => ({ compound: r.compound_slug, clicks: Number(r.n) }));

  const daily = (await db.query<QueryResultRow & { day: string; n: string | number }>(
    `SELECT ${countingDaySql("created_at")} AS day, COUNT(*) AS n FROM outbound_clicks
     WHERE vendor_slug=$1 AND NOT is_bot AND created_at > NOW() - $2::interval
     GROUP BY 1 ORDER BY 1`,
    [vendorSlug, window],
  )).rows.map(r => ({ day: r.day, clicks: Number(r.n) }));

  const devices = (await db.query<QueryResultRow & { device: string | null; n: string | number }>(
    `SELECT COALESCE(device,'unknown') AS device, COUNT(*) AS n FROM outbound_clicks
     WHERE vendor_slug=$1 AND NOT is_bot AND created_at > NOW() - $2::interval
     GROUP BY 1 ORDER BY 2 DESC`,
    [vendorSlug, window],
  )).rows.map(r => ({ device: r.device ?? "unknown", clicks: Number(r.n) }));

  const program = (await db.query<QueryResultRow & { coupon_code: string | null; status: string }>(
    `SELECT coupon_code, status FROM partner_programs WHERE vendor_slug=$1`, [vendorSlug],
  )).rows[0];

  return {
    vendorSlug,
    vendorName: vendor.display_name,
    periodDays: days,
    clicks: Number(totals.clicks),
    visitorDays: Number(totals.people),
    listingsClicked: Number(totals.listings),
    topCompounds, daily, devices,
    firstClickAt: totals.first_at, lastClickAt: totals.last_at,
    conversions: Number(totals.conversions),
    revenueCents: Number(totals.revenue ?? 0),
    couponCode: program?.coupon_code ?? null,
    status: program?.status ?? "prospect",
    verification: {
      utmSource: UTM_SOURCE,
      where: [
        `Shopify: Analytics → Reports → Sessions by referrer → "${UTM_SOURCE}"`,
        `Google Analytics 4: Reports → Acquisition → Traffic acquisition → Session source = "${UTM_SOURCE}"`,
        `WooCommerce (with GA or Jetpack): Referrers report → "vialgrade.com"`,
        `Any platform: server logs will show Referer: https://vialgrade.com/`,
      ],
    },
  };
}

/** Every vendor we have sent traffic to, ranked — the pipeline of who is worth approaching. */
export async function getAttributionOverview(
  options: { days?: number; connection?: SqlConnection } = {},
): Promise<{
  /**
   * `clickers` is the CANONICAL count of people who clicked through to a vendor: distinct daily
   * hashes in outbound_clicks. Every surface reads this one — never re-derive it by joining page
   * views, which silently drops anyone whose view-tracking was blocked.
   */
  totals: { clicks: number; clickers: number; vendors: number; conversions: number; revenueCents: number };
  vendors: { vendorSlug: string; vendorName: string; clicks: number; visitorDays: number; conversions: number; revenueCents: number; status: string; lastClickAt: string | null }[];
}> {
  const db = options.connection ?? await getDatabase();
  const window = `${options.days ?? 30} days`;

  const totals = (await db.query<QueryResultRow & Record<string, string | number | null>>(
    `SELECT COUNT(*) clicks, COUNT(DISTINCT visitor_hash) people,
            COUNT(DISTINCT vendor_slug) vendors, COUNT(converted_at) conversions,
            COALESCE(SUM(order_value_cents),0) revenue
     FROM outbound_clicks WHERE NOT is_bot AND created_at > NOW() - $1::interval`, [window],
  )).rows[0]!;

  const vendors = (await db.query<QueryResultRow & Record<string, string | number | null>>(
    `SELECT c.vendor_slug, COALESCE(o.display_name, c.vendor_slug) vendor_name,
            COUNT(*) clicks, COUNT(DISTINCT c.visitor_hash) people,
            COUNT(c.converted_at) conversions, COALESCE(SUM(c.order_value_cents),0) revenue,
            MAX(c.created_at) last_at, COALESCE(pp.status,'prospect') status
     FROM outbound_clicks c
     LEFT JOIN organizations o ON o.slug = c.vendor_slug
     LEFT JOIN partner_programs pp ON pp.vendor_slug = c.vendor_slug
     WHERE c.vendor_slug IS NOT NULL AND NOT c.is_bot AND c.created_at > NOW() - $1::interval
     GROUP BY c.vendor_slug, o.display_name, pp.status
     ORDER BY clicks DESC`, [window],
  )).rows.map(r => ({
    vendorSlug: String(r.vendor_slug), vendorName: String(r.vendor_name),
    clicks: Number(r.clicks), visitorDays: Number(r.people),
    conversions: Number(r.conversions), revenueCents: Number(r.revenue ?? 0),
    status: String(r.status), lastClickAt: r.last_at ? String(r.last_at) : null,
  }));

  return {
    totals: {
      clicks: Number(totals.clicks), clickers: Number(totals.people),
      vendors: Number(totals.vendors), conversions: Number(totals.conversions),
      revenueCents: Number(totals.revenue ?? 0),
    },
    vendors,
  };
}
