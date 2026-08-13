// Who is arriving, where from, and do they turn into buyers for a vendor.
import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { deviceOf, visitorHash } from "@/server/outbound/attribution";

/** Coarse page type, so the funnel can be read without parsing paths in SQL. */
export function pageKind(path: string): string {
  if (path === "/") return "home";
  if (path.startsWith("/products/")) return "product";
  if (path.startsWith("/vendors/")) return "vendor";
  if (path.startsWith("/compounds/")) return "compound";
  if (path.startsWith("/market")) return "market";
  if (path.startsWith("/verify")) return "verify";
  if (path.startsWith("/enforcement") || path.startsWith("/news")) return "trust";
  return "other";
}

/** Bare host of a referrer, or null for direct traffic. Never stores the full URL or any query. */
export function referrerHost(referrer: string | null | undefined, selfHost?: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).host.replace(/^www\./, "");
    if (selfHost && host === selfHost.replace(/^www\./, "")) return null; // internal navigation
    return host;
  } catch {
    return null;
  }
}

export async function recordPageView(
  input: { path: string; referrer?: string | null; ip?: string | null; userAgent?: string | null; selfHost?: string },
  connection?: SqlConnection,
): Promise<void> {
  const db = connection ?? await getDatabase();
  await db.query(
    `INSERT INTO page_views(id, path, page_kind, referrer_host, visitor_hash, device)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [
      newId("pv"),
      input.path.slice(0, 300),
      pageKind(input.path),
      referrerHost(input.referrer, input.selfHost),
      visitorHash(input.ip ?? null, input.userAgent ?? null),
      deviceOf(input.userAgent ?? null),
    ],
  );
}

export interface VisitorSummary {
  visits: number;
  people: number;
  clickedOut: number;          // distinct people who went on to a vendor
  clickThroughRate: number;    // clickedOut / people
  topSources: { source: string; people: number }[];
  topPages: { path: string; visits: number }[];
  byKind: { kind: string; visits: number }[];
  daily: { day: string; people: number }[];
}

/**
 * The inbound picture.
 *
 * `clickedOut` joins visits to outbound clicks on the SAME-DAY visitor hash. That is deliberately
 * conservative: someone who browses today and buys tomorrow is not counted, because the hash has
 * rotated. Under-reporting is the right direction of error for a number used in a negotiation.
 */
export async function getVisitorSummary(
  options: { days?: number; connection?: SqlConnection } = {},
): Promise<VisitorSummary> {
  const db = options.connection ?? await getDatabase();
  const window = `${options.days ?? 30} days`;

  const totals = (await db.query<QueryResultRow & { visits: string | number; people: string | number }>(
    `SELECT COUNT(*) AS visits, COUNT(DISTINCT visitor_hash) AS people
     FROM page_views WHERE created_at > NOW() - $1::interval`, [window],
  )).rows[0]!;

  const converted = (await db.query<QueryResultRow & { n: string | number }>(
    `SELECT COUNT(DISTINCT pv.visitor_hash) AS n
     FROM page_views pv
     JOIN outbound_clicks oc ON oc.visitor_hash = pv.visitor_hash
     WHERE pv.created_at > NOW() - $1::interval`, [window],
  )).rows[0]!;

  const topSources = (await db.query<QueryResultRow & { source: string | null; n: string | number }>(
    `SELECT COALESCE(referrer_host,'direct') AS source, COUNT(DISTINCT visitor_hash) AS n
     FROM page_views WHERE created_at > NOW() - $1::interval
     GROUP BY 1 ORDER BY 2 DESC LIMIT 10`, [window],
  )).rows.map(r => ({ source: r.source ?? "direct", people: Number(r.n) }));

  const topPages = (await db.query<QueryResultRow & { path: string; n: string | number }>(
    `SELECT path, COUNT(*) AS n FROM page_views WHERE created_at > NOW() - $1::interval
     GROUP BY 1 ORDER BY 2 DESC LIMIT 12`, [window],
  )).rows.map(r => ({ path: r.path, visits: Number(r.n) }));

  const byKind = (await db.query<QueryResultRow & { page_kind: string | null; n: string | number }>(
    `SELECT COALESCE(page_kind,'other') AS page_kind, COUNT(*) AS n
     FROM page_views WHERE created_at > NOW() - $1::interval
     GROUP BY 1 ORDER BY 2 DESC`, [window],
  )).rows.map(r => ({ kind: r.page_kind ?? "other", visits: Number(r.n) }));

  const daily = (await db.query<QueryResultRow & { day: string; n: string | number }>(
    `SELECT TO_CHAR(created_at,'YYYY-MM-DD') AS day, COUNT(DISTINCT visitor_hash) AS n
     FROM page_views WHERE created_at > NOW() - $1::interval
     GROUP BY 1 ORDER BY 1`, [window],
  )).rows.map(r => ({ day: r.day, people: Number(r.n) }));

  const people = Number(totals.people);
  const clickedOut = Number(converted.n);
  return {
    visits: Number(totals.visits),
    people,
    clickedOut,
    clickThroughRate: people > 0 ? clickedOut / people : 0,
    topSources, topPages, byKind, daily,
  };
}
