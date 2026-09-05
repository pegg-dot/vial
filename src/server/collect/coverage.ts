// Which storefronts can never earn a grade, and why.
//
// The admin page already answers "is a collector failing?". It cannot answer the question one level
// up: a vendor with NO catalog collector enqueued at all is not failing — it is absent. Every
// health signal stays green while the vendor sits at zero listings forever, and because the grade
// scale needs something to rate, it can never be graded either. That is the same blind spot the
// per-collector table was built to close ("a collector that never RUNS is indistinguishable from
// one that runs and finds nothing"), one level higher up.
//
// A storefront gets a catalog collector only if the curated list marks a working import method
// (`productsJsonWorks` | `wooWorks` | `rscWorks` — see `syncCollectionTargets`). So a zero-listing
// storefront is in exactly one of three states, and they call for different work:
//
//   uncurated   — surfaced from lab records, never added to the curated list. Nothing has ever
//                 looked at its storefront.
//   no-method   — curated, polled for status/domain/ratings, but no import method was ever
//                 identified, so its catalogue is never read.
//   collecting  — a catalog collector exists; zero listings means it has not succeeded YET, and
//                 the "collectors needing attention" table is the place that says why.
//
// Read-only. This reports on coverage; it never registers a source or fetches anything — live
// ingestion stays gated behind explicit approval and the hostname allowlist.
import { getDatabase, type SqlConnection } from "@/server/db/client";
import knownVendors from "@/server/verify/known-vendors.json";

export type CoverageState = "uncurated" | "no-method" | "collecting";

export interface UngradableStorefront {
  slug: string;
  name: string;
  state: CoverageState;
  coaCount: number;
  /** Why no importer can read this storefront, recorded on the curated entry when we probed it. */
  note: string | null;
}

export interface CatalogCoverage {
  storefronts: number;
  withListings: number;
  ungradable: UngradableStorefront[];
  counts: Record<CoverageState, number>;
}

interface CuratedVendor {
  slug?: string; domain?: string; redFlag?: boolean;
  productsJsonWorks?: boolean; wooWorks?: boolean; rscWorks?: boolean;
  /** Set when a storefront was probed and found unreadable, so nobody re-probes it blind. */
  catalogNote?: string;
}

function curated(): CuratedVendor[] {
  const raw = knownVendors as unknown;
  const list = Array.isArray(raw) ? raw : ((raw as { vendors?: unknown[] }).vendors ?? []);
  return (list as CuratedVendor[]).filter((v) => v?.slug && v?.domain);
}

/** Has the curated list identified a way to read this storefront's catalogue? */
export function hasImportMethod(vendor: CuratedVendor): boolean {
  return Boolean(vendor.productsJsonWorks || vendor.wooWorks || vendor.rscWorks);
}

/**
 * Classify one zero-listing storefront. Exported for tests: the three states drive different work,
 * so mislabelling one sends the reader to fix the wrong thing.
 */
export function coverageState(slug: string, list: CuratedVendor[] = curated()): CoverageState {
  const entry = list.find((v) => v.slug === slug);
  if (!entry) return "uncurated";
  // A red-flagged vendor is deliberately excluded from every collector by `syncCollectionTargets`,
  // so it is never "collecting" however its import flags read.
  if (entry.redFlag) return "no-method";
  return hasImportMethod(entry) ? "collecting" : "no-method";
}

export async function getCatalogCoverage(connection?: SqlConnection): Promise<CatalogCoverage> {
  const db = connection ?? await getDatabase();
  // Same listings predicate the vendor surfaces count with (`p.status='active'`), so this panel and
  // the directory can never disagree about who has a catalogue.
  const rows = (await db.query<{ slug: string; display_name: string; listings: string; coas: string }>(
    `SELECT o.slug, o.display_name,
            (SELECT COUNT(*) FROM listings l JOIN products p ON p.id=l.product_id
              WHERE p.vendor_id=o.id AND p.status='active') listings,
            (SELECT COUNT(*) FROM lab_test_records t
              WHERE t.vendor_slug=o.slug AND t.is_independent) coas
       FROM organizations o
      WHERE o.organization_type='vendor' AND COALESCE(o.vendor_kind,'storefront') <> 'manufacturer'
      ORDER BY o.display_name`,
  )).rows;

  const list = curated();
  const counts: Record<CoverageState, number> = { uncurated: 0, "no-method": 0, collecting: 0 };
  const ungradable: UngradableStorefront[] = [];
  let withListings = 0;

  for (const row of rows) {
    if (Number(row.listings) > 0) { withListings += 1; continue; }
    const state = coverageState(row.slug, list);
    counts[state] += 1;
    const note = list.find((v) => v.slug === row.slug)?.catalogNote ?? null;
    ungradable.push({ slug: row.slug, name: row.display_name, state, coaCount: Number(row.coas), note });
  }

  // Worst first: a curated vendor we poll but never read is a smaller fix than curating a new one,
  // and a collector already trying is the admin table's business, not this panel's.
  const order: Record<CoverageState, number> = { "no-method": 0, uncurated: 1, collecting: 2 };
  ungradable.sort((a, b) => order[a.state] - order[b.state] || b.coaCount - a.coaCount || a.name.localeCompare(b.name));

  return { storefronts: rows.length, withListings, ungradable, counts };
}
