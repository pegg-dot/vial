import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { severityForAction, resolveActionToVendor, verdictFromSeverities, type RegulatoryActionInput, type RegSeverity, type VendorRef } from "./actions";

export interface RegulatoryActionRow {
  id: string; action_type: string; agency: string; subject_name: string; vendor_slug: string | null;
  match_confidence: string; outcome: string | null; title: string; summary: string;
  action_date: string | null; source_url: string; is_primary_source: boolean; severity: string;
}

/** Record one enforcement action, resolving it to a vendor (strictly) and deriving its severity. */
export async function recordRegulatoryAction(db: SqlConnection, input: RegulatoryActionInput, vendors: VendorRef[]): Promise<{ vendorSlug: string | null; severity: RegSeverity }> {
  const { vendorSlug, confidence } = resolveActionToVendor(input.subjectName, vendors, input.subjectDomain);
  const severity = severityForAction(input);
  await db.query(
    `INSERT INTO regulatory_actions (id, action_type, agency, subject_name, vendor_slug, match_confidence, outcome, title, summary, action_date, source_url, is_primary_source, severity)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (source_url, subject_name) DO UPDATE
       SET action_type=EXCLUDED.action_type, agency=EXCLUDED.agency, vendor_slug=EXCLUDED.vendor_slug,
           match_confidence=EXCLUDED.match_confidence, outcome=EXCLUDED.outcome, title=EXCLUDED.title,
           summary=EXCLUDED.summary, action_date=EXCLUDED.action_date, severity=EXCLUDED.severity, updated_at=NOW()`,
    [newId("reg"), input.actionType, input.agency, input.subjectName, vendorSlug, confidence, input.outcome ?? null,
     input.title, input.summary, input.actionDate ?? null, input.sourceUrl, input.isPrimarySource ?? true, severity],
  );
  return { vendorSlug, severity };
}

const COLS = `id,action_type,agency,subject_name,vendor_slug,match_confidence,outcome,title,summary,action_date,source_url,is_primary_source,severity`;

/** Enforcement records attributed to one vendor, most serious first. */
export async function getVendorRegulatoryActions(vendorSlug: string, connection?: SqlConnection): Promise<RegulatoryActionRow[]> {
  const db = connection ?? (await getDatabase());
  return (await db.query<RegulatoryActionRow>(
    `SELECT ${COLS} FROM regulatory_actions WHERE vendor_slug=$1 ORDER BY CASE severity WHEN 'severe' THEN 0 WHEN 'caution' THEN 1 ELSE 2 END, action_date DESC NULLS LAST`,
    [vendorSlug],
  )).rows;
}

/** The verdict a vendor's enforcement record implies (avoid / caution / null), for the banner. */
export async function getVendorRegulatoryVerdict(vendorSlug: string, connection?: SqlConnection): Promise<"avoid" | "caution" | null> {
  const rows = await getVendorRegulatoryActions(vendorSlug, connection);
  return verdictFromSeverities(rows.map((r) => r.severity as RegSeverity));
}

export interface RegulatoryFeedItem extends RegulatoryActionRow { vendor_name: string | null }

/** The market-wide enforcement feed — every action, matched or not, newest first. */
export async function listRegulatoryActions(connection?: SqlConnection, limit = 200): Promise<RegulatoryFeedItem[]> {
  const db = connection ?? (await getDatabase());
  return (await db.query<RegulatoryFeedItem>(
    `SELECT ${COLS.split(",").map((c) => `ra.${c}`).join(",")}, o.display_name vendor_name
     FROM regulatory_actions ra LEFT JOIN organizations o ON o.slug=ra.vendor_slug
     ORDER BY CASE ra.severity WHEN 'severe' THEN 0 WHEN 'caution' THEN 1 ELSE 2 END, ra.action_date DESC NULLS LAST LIMIT $1`,
    [limit],
  )).rows;
}

export async function getRegulatoryStats(connection?: SqlConnection): Promise<{ total: number; severe: number; vendorsAffected: number; agencies: number }> {
  const db = connection ?? (await getDatabase());
  const r = (await db.query<QueryResultRow & Record<string, string | number>>(
    `SELECT COUNT(*) total, COUNT(*) FILTER (WHERE severity='severe') severe, COUNT(DISTINCT vendor_slug) FILTER (WHERE vendor_slug IS NOT NULL) vendors, COUNT(DISTINCT agency) agencies FROM regulatory_actions`,
  )).rows[0];
  return { total: Number(r.total), severe: Number(r.severe), vendorsAffected: Number(r.vendors), agencies: Number(r.agencies) };
}
