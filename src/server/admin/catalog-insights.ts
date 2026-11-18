// What the catalogue holds and how recently it was read, for the admin overview.
//
// The question this answers is the one no health probe does: are the prices on the public pages
// still being read? A collector can be "enabled, not failing" while every listing was last read
// months ago. The weekly series counts distinct listings whose price was observed in each week, so
// a collection that has quietly stopped shows as weeks with nothing in them.
import { getDatabase, type SqlConnection } from "@/server/db/client";

export interface CatalogInsights {
  listings: number;
  vendorsListed: number;
  compoundsListed: number;
  independentReports: number;
  vendorsWithReports: number;
  /** Compounds where one vendor has both a price observation and an independent lab report. */
  comparableCompounds: number;
  /** Most recent day any live price was read, YYYY-MM-DD. */
  lastPriceRead: string | null;
  listingsRead7Days: number;
  listingsRead30Days: number;
  reportsAdded30Days: number;
  /** Most recent day a lab report was added, YYYY-MM-DD. */
  lastReportAdded: string | null;
  /** Distinct listings with a live price read, per week (Monday start), oldest first, zero-filled. */
  weekly: { week: string; listings: number }[];
}

/** `weeks` consecutive Mondays ending with the week of `today` (YYYY-MM-DD), each with its count or zero. Pure. */
export function fillWeeks(counts: ReadonlyMap<string, number>, today: string, weeks: number): { week: string; listings: number }[] {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d, 12));
  const monday = new Date(at.getTime() - ((at.getUTCDay() + 6) % 7) * 86_400_000);
  const out: { week: string; listings: number }[] = [];
  for (let back = weeks - 1; back >= 0; back--) {
    const week = new Date(monday.getTime() - back * 7 * 86_400_000).toISOString().slice(0, 10);
    out.push({ week, listings: counts.get(week) ?? 0 });
  }
  return out;
}

/** Whole days between two YYYY-MM-DD dates. */
export function daysBetween(earlier: string, later: string): number {
  return Math.round((Date.parse(later + "T12:00:00Z") - Date.parse(earlier + "T12:00:00Z")) / 86_400_000);
}

export async function getCatalogInsights(options: { connection?: SqlConnection; today?: string } = {}): Promise<CatalogInsights> {
  const db = options.connection ?? (await getDatabase());
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const [counts, weekly] = await Promise.all([
    db.query<Record<string, string | number | null>>(
      `SELECT
        (SELECT COUNT(*) FROM listings WHERE origin='live') AS listings,
        (SELECT COUNT(DISTINCT vendor_slug) FROM price_observations WHERE source='live') AS vendors_listed,
        (SELECT COUNT(DISTINCT compound_slug) FROM price_observations WHERE source='live') AS compounds_listed,
        (SELECT COUNT(*) FROM lab_test_records WHERE is_independent) AS independent_reports,
        (SELECT COUNT(DISTINCT vendor_slug) FROM lab_test_records WHERE is_independent AND vendor_slug IS NOT NULL) AS vendors_with_reports,
        (SELECT COUNT(DISTINCT t.compound_slug) FROM lab_test_records t
           WHERE t.is_independent AND t.vendor_slug IS NOT NULL AND t.compound_slug IS NOT NULL
             AND EXISTS (SELECT 1 FROM price_observations o WHERE o.source='live' AND o.vendor_slug=t.vendor_slug AND o.compound_slug=t.compound_slug)) AS comparable_compounds,
        (SELECT to_char(MAX(observed_day), 'YYYY-MM-DD') FROM price_observations WHERE source='live') AS last_price_read,
        (SELECT COUNT(DISTINCT listing_slug) FROM price_observations WHERE source='live' AND observed_day > $1::date - 7) AS read7,
        (SELECT COUNT(DISTINCT listing_slug) FROM price_observations WHERE source='live' AND observed_day > $1::date - 30) AS read30,
        (SELECT COUNT(*) FROM lab_test_records WHERE created_at > $1::date - 30) AS reports30,
        (SELECT to_char(MAX(created_at), 'YYYY-MM-DD') FROM lab_test_records) AS last_report_added`, [today]),
    db.query<{ week: string; n: string | number }>(
      `SELECT to_char(date_trunc('week', observed_day::timestamp), 'YYYY-MM-DD') AS week, COUNT(DISTINCT listing_slug) AS n
       FROM price_observations WHERE source='live' AND observed_day > $1::date - 91 GROUP BY 1`, [today]),
  ]);
  const c = counts.rows[0] ?? {};
  const n = (key: string) => Number(c[key] ?? 0);
  const text = (key: string) => (c[key] == null ? null : String(c[key]));
  return {
    listings: n("listings"),
    vendorsListed: n("vendors_listed"),
    compoundsListed: n("compounds_listed"),
    independentReports: n("independent_reports"),
    vendorsWithReports: n("vendors_with_reports"),
    comparableCompounds: n("comparable_compounds"),
    lastPriceRead: text("last_price_read"),
    listingsRead7Days: n("read7"),
    listingsRead30Days: n("read30"),
    reportsAdded30Days: n("reports30"),
    lastReportAdded: text("last_report_added"),
    weekly: fillWeeks(new Map(weekly.rows.map((r) => [r.week, Number(r.n)])), today, 12),
  };
}
