import type { QueryResultRow } from "pg";
import { getDatabase } from "@/server/db/client";

export interface PublicPublication {
  id: string;
  listingSlug: string;
  productName: string;
  vendorName: string;
  version: number;
  publishedAt: string;
  publishedBy: string;
  changedFields: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; }
    catch { return {}; }
  }
  return {};
}

export async function getPublications(limit = 40): Promise<PublicPublication[]> {
  const db = await getDatabase();
  const result = await db.query<QueryResultRow & {
    id: string; entity_id: string; version: number; published_at: Date | string; published_by: string;
    before_json: unknown; after_json: unknown; listing_slug: string; product_name: string; vendor_name: string;
  }>(`SELECT pe.id, pe.entity_id, pe.version, pe.published_at, pe.published_by,
      pe.before_json, pe.after_json, l.slug AS listing_slug, p.name AS product_name, o.display_name AS vendor_name
    FROM publication_events pe
    JOIN listings l ON l.id = pe.entity_id
    JOIN products p ON p.id = l.product_id
    JOIN organizations o ON o.id = p.vendor_id
    WHERE pe.entity_type = 'listing'
    ORDER BY pe.published_at DESC LIMIT $1`, [limit]);

  return result.rows.map((row) => {
    const before = parseObject(row.before_json);
    const after = parseObject(row.after_json);
    const changedFields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    return {
      id: row.id,
      listingSlug: row.listing_slug,
      productName: row.product_name,
      vendorName: row.vendor_name,
      version: Number(row.version),
      publishedAt: new Date(row.published_at).toISOString(),
      publishedBy: row.published_by,
      changedFields,
      before,
      after,
    };
  });
}

export async function getEvidenceLibraryStats() {
  const db = await getDatabase();
  const result = await db.query<QueryResultRow & {
    reports: string | number; confirmed: string | number; linked: string | number; issuers: string | number; stale: string | number;
  }>(`SELECT
      COUNT(*) FILTER (WHERE report_date <> '' AND report_date <> 'Not recorded') AS reports,
      COUNT(*) FILTER (WHERE report_confirmed = TRUE) AS confirmed,
      COUNT(*) FILTER (WHERE batch_linked = TRUE) AS linked,
      COUNT(DISTINCT NULLIF(report_issuer, '')) AS issuers,
      COUNT(*) FILTER (WHERE evidence_level = 'stale') AS stale
    FROM listings`);
  const row = result.rows[0];
  return { reports: Number(row?.reports ?? 0), confirmed: Number(row?.confirmed ?? 0), linked: Number(row?.linked ?? 0), issuers: Number(row?.issuers ?? 0), stale: Number(row?.stale ?? 0) };
}
