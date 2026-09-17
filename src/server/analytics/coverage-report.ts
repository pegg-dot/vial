import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";

// What VialGrade holds, and — the half that matters — what it does not.
//
// A directory's trustworthiness cannot be asserted. Every site in this market says it is thorough
// and impartial, so the word is worth nothing; the only version of the claim a reader can check is
// the arithmetic. This module counts what is on record and, in the same breath and from the same
// query, counts what is missing.
//
// The gaps are phrased as OURS throughout. `absence.ts` and the test beside it exist because
// publishing "no independent verification found" under a heading about a named business turns a
// hole in our capture into an accusation about them — the exact failure the product exists to
// catch. "We hold no certificate for this vendor" is a fact about us. "This vendor is untested"
// is a claim about them, and nothing here is entitled to make it.
//
// Nothing is hardcoded. Every figure is a live count, so the page cannot drift from the database
// the way a number typed into marketing copy does the day after it is written.

export interface CoverageReport {
  compounds: number;
  compoundsWithTestedPurity: number;
  vendors: number;
  storefronts: number;
  makers: number;
  gradedVendors: number;
  gradedStorefronts: number;
  listings: number;
  listingsWithPrice: number;
  independentCertificates: number;
  labs: number;
  enforcementRecords: number;
  vendorsNamedInEnforcement: number;
  /** Most recent SUCCESSFUL catalogue collector run — when a storefront was last re-read. */
  lastReadAt: string | null;
}

const n = (v: unknown) => Number(v ?? 0);

export async function getCoverageReport(connection?: SqlConnection): Promise<CoverageReport> {
  const db = connection ?? await getDatabase();

  // One round trip. Each figure is a scalar subquery so a table that does not exist yet in a fresh
  // database cannot take the whole page down with it.
  const r = await db.query<QueryResultRow & Record<string, string | number | null>>(
    `SELECT
       (SELECT COUNT(*) FROM compounds) AS compounds,
       (SELECT COUNT(DISTINCT compound_slug) FROM lab_test_records
         WHERE is_independent AND purity_pct IS NOT NULL AND compound_slug IS NOT NULL) AS compounds_tested,
       (SELECT COUNT(*) FROM organizations WHERE organization_type='vendor') AS vendors,
       (SELECT COUNT(*) FROM organizations WHERE organization_type='vendor' AND vendor_kind <> 'manufacturer') AS storefronts,
       (SELECT COUNT(*) FROM organizations WHERE organization_type='vendor' AND vendor_kind = 'manufacturer') AS makers,
       (SELECT COUNT(*) FROM organizations WHERE organization_type='vendor' AND grade_letter IS NOT NULL) AS graded,
       (SELECT COUNT(*) FROM organizations WHERE organization_type='vendor' AND vendor_kind <> 'manufacturer' AND grade_letter IS NOT NULL) AS graded_storefronts,
       (SELECT COUNT(*) FROM listings) AS listings,
       (SELECT COUNT(*) FROM listings WHERE price IS NOT NULL) AS listings_priced,
       (SELECT COUNT(*) FROM lab_test_records WHERE is_independent) AS certificates,
       (SELECT COUNT(DISTINCT lab) FROM lab_test_records WHERE is_independent) AS labs,
       (SELECT COUNT(*) FROM regulatory_actions) AS enforcement,
       (SELECT COUNT(DISTINCT subject_name) FROM regulatory_actions) AS enforcement_subjects,
       -- listings.last_checked is a human string ("36 minutes ago"), not a timestamp, so the
       -- honest source for "when did we last re-read a catalogue" is the collector's own run log.
       (SELECT MAX(ran_at) FROM collector_runs WHERE ok AND collector LIKE 'catalog-%') AS last_read`,
  );
  const row = r.rows[0] ?? {};
  return {
    compounds: n(row.compounds),
    compoundsWithTestedPurity: n(row.compounds_tested),
    vendors: n(row.vendors),
    storefronts: n(row.storefronts),
    makers: n(row.makers),
    gradedVendors: n(row.graded),
    gradedStorefronts: n(row.graded_storefronts),
    listings: n(row.listings),
    listingsWithPrice: n(row.listings_priced),
    independentCertificates: n(row.certificates),
    labs: n(row.labs),
    enforcementRecords: n(row.enforcement),
    vendorsNamedInEnforcement: n(row.enforcement_subjects),
    lastReadAt: row.last_read ? new Date(row.last_read as string).toISOString() : null,
  };
}

export interface CoverageGap {
  /** Stated as a limit of ours, never as a property of a vendor or compound. */
  weDoNotHold: string;
  count: number;
  outOf: number;
  why: string;
}

/**
 * The gaps, derived from the same counts rather than written down beside them.
 *
 * Deriving them is the point: a hand-written "we cover almost everything" is true until the day it
 * is not, and nothing tells you which day that was.
 */
export function coverageGaps(report: CoverageReport): CoverageGap[] {
  const gaps: CoverageGap[] = [
    {
      weDoNotHold: "an independently tested purity figure for every compound",
      count: report.compounds - report.compoundsWithTestedPurity,
      outOf: report.compounds,
      why: "No third-party certificate we can read has reported a purity for these yet. It is a hole in what we hold, not a statement that anything is impure.",
    },
    {
      weDoNotHold: "a grade for every storefront",
      count: report.storefronts - report.gradedStorefronts,
      outOf: report.storefronts,
      why: "A grade needs evidence to weigh. Where we have not gathered enough, we publish no letter rather than a confident-looking one.",
    },
    {
      weDoNotHold: "a price for every listing",
      count: report.listings - report.listingsWithPrice,
      outOf: report.listings,
      why: "Some storefronts block automated reading, and a price we cannot re-read is one we will not show as current.",
    },
  ];
  // A gap of zero is not a gap. Reporting "0 of 60 missing" as a row pads the list and trains the
  // reader to skim it.
  return gaps.filter((g) => g.count > 0);
}
