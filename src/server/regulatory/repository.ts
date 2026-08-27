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

export type EnforcementFilter = "all" | "matched" | "severe";

export interface EnforcementPage {
  items: RegulatoryFeedItem[];
  /** Rows matching the active filter AND the active search — what "Showing N-M of T" counts. */
  total: number;
  /** Rows matching the active SEARCH only, per chip. Each is what clicking that chip would yield. */
  matched: number;
  severe: number;
  all: number;
}

/** The joined source every count and read on this page shares. `organizations.slug` is UNIQUE, so
 *  the LEFT JOIN can never multiply a row and the counts stay exact. */
const ENFORCEMENT_FROM = `FROM regulatory_actions ra LEFT JOIN organizations o ON o.slug=ra.vendor_slug`;

/**
 * A page of the enforcement record.
 *
 * The openFDA feed brings hundreds of recalls, most naming companies we do not track. A buyer cares
 * first about the ones that touch a vendor they might actually buy from, so matched records sort
 * ahead of unmatched within each severity band — and the whole list is paged rather than silently
 * truncated at 200, which was hiding two thirds of the record.
 *
 * `q` is the buyer's most likely reason to be here at all: they know a company name and want to
 * know whether it is on the government paper trail. It is matched server-side, against the same
 * SQL that pages the list, so the counts and the page stay one thing. The term is bound as a
 * PARAMETER and compared with strpos() rather than LIKE — a reader typing "%" is searching for a
 * percent sign, not asking for a wildcard that matches the entire record.
 *
 * Search and filter INTERSECT. The chip counts are scoped to the search (not to the other chips),
 * so a chip's number is exactly what clicking it returns while the search stays on.
 */
export async function listEnforcementPage(
  options: { filter?: EnforcementFilter; page?: number; perPage?: number; q?: string; connection?: SqlConnection } = {},
): Promise<EnforcementPage> {
  const db = options.connection ?? (await getDatabase());
  const filter = options.filter ?? "all";
  const perPage = Math.min(100, Math.max(10, options.perPage ?? 50));
  const page = Math.max(1, options.page ?? 1);
  const term = (options.q ?? "").trim().toLowerCase();

  // Matched against the company as the AGENCY named it (subject_name), the company as WE know it
  // (organizations.display_name — the two often differ, e.g. "Swisschems" vs "Swiss Chems"), and
  // the title of the action.
  const searchParams: unknown[] = [];
  let searchWhere = "";
  if (term) {
    searchParams.push(term);
    const n = searchParams.length;
    searchWhere = `WHERE (strpos(lower(ra.subject_name), $${n}) > 0 OR strpos(lower(ra.title), $${n}) > 0 OR strpos(lower(COALESCE(o.display_name, '')), $${n}) > 0)`;
  }

  const filterClause = filter === "matched" ? "ra.vendor_slug IS NOT NULL"
    : filter === "severe" ? "ra.severity = 'severe'" : "";
  const where = filterClause
    ? (searchWhere ? `${searchWhere} AND ${filterClause}` : `WHERE ${filterClause}`)
    : searchWhere;

  const counts = (await db.query<QueryResultRow & Record<string, string | number>>(
    `SELECT COUNT(*) total,
            COUNT(*) FILTER (WHERE ra.vendor_slug IS NOT NULL) matched,
            COUNT(*) FILTER (WHERE ra.severity='severe') severe
     ${ENFORCEMENT_FROM} ${searchWhere}`,
    searchParams,
  )).rows[0]!;

  const filtered = (await db.query<QueryResultRow & { n: string | number }>(
    `SELECT COUNT(*) AS n ${ENFORCEMENT_FROM} ${where}`,
    searchParams,
  )).rows[0]!;

  const items = (await db.query<RegulatoryFeedItem>(
    `SELECT ${COLS.split(",").map((c) => `ra.${c}`).join(",")}, o.display_name vendor_name
     ${ENFORCEMENT_FROM}
     ${where}
     ORDER BY CASE ra.severity WHEN 'severe' THEN 0 WHEN 'caution' THEN 1 ELSE 2 END,
              CASE WHEN ra.vendor_slug IS NOT NULL THEN 0 ELSE 1 END,
              ra.action_date DESC NULLS LAST
     LIMIT $${searchParams.length + 1} OFFSET $${searchParams.length + 2}`,
    [...searchParams, perPage, (page - 1) * perPage],
  )).rows;

  return {
    items,
    total: Number(filtered.n),
    matched: Number(counts.matched),
    severe: Number(counts.severe),
    all: Number(counts.total),
  };
}

export async function getRegulatoryStats(connection?: SqlConnection): Promise<{ total: number; severe: number; vendorsAffected: number; agencies: number }> {
  const db = connection ?? (await getDatabase());
  const r = (await db.query<QueryResultRow & Record<string, string | number>>(
    `SELECT COUNT(*) total, COUNT(*) FILTER (WHERE severity='severe') severe, COUNT(DISTINCT vendor_slug) FILTER (WHERE vendor_slug IS NOT NULL) vendors, COUNT(DISTINCT agency) agencies FROM regulatory_actions`,
  )).rows[0];
  return { total: Number(r.total), severe: Number(r.severe), vendorsAffected: Number(r.vendors), agencies: Number(r.agencies) };
}
