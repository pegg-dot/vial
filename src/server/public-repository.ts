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
  // The real "lab reports" are the independent certificates (lab_test_records), not listing-level
  // report metadata (which live listings never populate — that's why this used to read all zeros).
  const result = await db.query<QueryResultRow & {
    reports: string | number; confirmed: string | number; linked: string | number; issuers: string | number; stale: string | number;
  }>(`SELECT
      COUNT(*) AS reports,
      COUNT(*) FILTER (WHERE is_independent = TRUE) AS confirmed,
      COUNT(*) FILTER (WHERE batch_code IS NOT NULL AND batch_code <> '') AS linked,
      COUNT(DISTINCT lab) AS issuers,
      COUNT(*) FILTER (WHERE tested_at IS NULL OR tested_at = '') AS stale
    FROM lab_test_records`);
  const row = result.rows[0];
  return { reports: Number(row?.reports ?? 0), confirmed: Number(row?.confirmed ?? 0), linked: Number(row?.linked ?? 0), issuers: Number(row?.issuers ?? 0), stale: Number(row?.stale ?? 0) };
}

/** How the certificates we hold were sampled — the blind vs vendor-submitted split that actually
 *  matters for trust. Customer-sealed and multi-source models don't apply to aggregated COAs. */
/**
 * THE canonical count of independent certificates VIAL holds: one row per verify_url — a distinct
 * COA (UNIQUE(verify_url) + the ingest ON CONFLICT guarantee one row per certificate). This is the
 * single site-wide "certificates on record" figure. Per-compound (compound.coaCount) and per-vendor
 * (vendor.coaCount) counts are SCOPED SUBSETS: a certificate whose manufacturer or compound didn't
 * resolve to a tracked entity is real evidence we hold but is absent from those subsets, so summing
 * them undercounts the corpus. Never sum a subset into a headline total — use this.
 */
export async function getCertificatesOnRecord(): Promise<number> {
  const db = await getDatabase();
  const r = (await db.query<QueryResultRow & { n: string | number }>(`SELECT COUNT(*) n FROM lab_test_records`)).rows[0];
  return Number(r?.n ?? 0);
}

export async function getSamplingStats(): Promise<{ total: number; blind: number; vendorSelected: number; passports: number }> {
  const db = await getDatabase();
  const total = await getCertificatesOnRecord();   // same source as every other "certificates on record" figure
  const r = (await db.query<QueryResultRow & { blind: string | number; passports: string | number }>(
    `SELECT (SELECT COUNT(*) FROM lab_test_records WHERE is_blind) blind,
            (SELECT COUNT(*) FROM batch_passports WHERE origin='live' AND status='published') passports`,
  )).rows[0];
  const blind = Number(r?.blind ?? 0);
  return { total, blind, vendorSelected: total - blind, passports: Number(r?.passports ?? 0) };
}

/** Distinct laboratories named on the certificates we hold, with how many each issued. */
export async function getObservedIssuers(): Promise<{ lab: string; count: number }[]> {
  const db = await getDatabase();
  return (await db.query<QueryResultRow & { lab: string; n: string | number }>(
    `SELECT lab, COUNT(*) n FROM lab_test_records WHERE lab IS NOT NULL AND lab <> '' GROUP BY lab ORDER BY n DESC`,
  )).rows.map((r) => ({ lab: r.lab, count: Number(r.n) }));
}
