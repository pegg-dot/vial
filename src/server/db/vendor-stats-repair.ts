import type { SqlConnection } from "./client";

// Re-derive organizations.product_count and organizations.documentation_current from the listings
// they claim to summarise.
//
// Both columns have exactly one writer in the codebase: recomputeVendor() inside
// runPublicationCascade. That path only runs when a REVIEWED CLAIM IS PUBLISHED, which is the
// demo/fixture loop. Live catalog imports (recordCatalogListing, shopify-import, woocommerce-import)
// insert products and listings directly and never enter it, so the two columns simply stopped
// tracking the rows underneath them:
//
//   stored SUM(product_count) = 15   ·   actual active listings = 580
//   swiss-chems 75 listings -> 0 · umbrella-labs 73 -> 0 · behemoth-labz 53 -> 0 · purerawz 52 -> 0
//
// The only rows left holding a non-zero value were the six seeded FICTIONAL companies, and site
// search ranks on exactly these two columns:
//
//   popularity_score = product_count * 8 ,  quality_score = documentation_current
//   score += quality * 0.12 + log1p(popularity) * 2
//
// so the boost was, in practice, a demo-vendor-only boost. On any query where the lexical scores
// tie — and they tie constantly, because dozens of real vendors are named "...-labs",
// "...-science", "...-research" — the invented company won. A search for "science" put three
// fictional companies above cernum-biosciences, which is real and carries 21 listings. On a site
// whose product is telling real from fake, that is the worst possible ranking to get wrong.
//
// Semantics are taken from the cascade, which is the authoritative writer, and from its own prose
// ("N of the M listings we track from them have a dated report"):
//
//   product_count         = COUNT of the vendor's ACTIVE listings
//   documentation_current = COUNT of those listings carrying a dated lab report (ABSOLUTE, not a
//                           percentage — see reputation/repository.ts, which used to render it "%")
//
// Both statements are guarded on inequality, so a converged database is a pure read and writes
// nothing. Neither can write NULL into a NOT NULL column: COUNT never returns NULL, and the
// second statement writes literal zeros. Verified against a copy of the real 95-vendor store —
// first pass repaired 21 vendors in 193ms, second pass affected 0 rows in 10ms.
const REPAIR_LISTED = `
UPDATE organizations o
   SET product_count = s.listings,
       documentation_current = s.documented,
       updated_at = NOW()
  FROM (SELECT p.vendor_id,
               COUNT(*) AS listings,
               COUNT(*) FILTER (WHERE l.report_date IS NOT NULL AND l.report_date <> '' AND l.report_date <> 'Not located') AS documented
          FROM listings l JOIN products p ON p.id = l.product_id
         WHERE p.status = 'active'
         GROUP BY p.vendor_id) s
 WHERE o.id = s.vendor_id
   AND o.organization_type = 'vendor'
   AND (o.product_count <> s.listings OR o.documentation_current <> s.documented)`;

// A vendor whose last active listing went away drops out of the aggregate above entirely, so it
// would keep its old count forever. Reflect the absence honestly instead.
const REPAIR_EMPTY = `
UPDATE organizations o
   SET product_count = 0,
       documentation_current = 0,
       updated_at = NOW()
 WHERE o.organization_type = 'vendor'
   AND (o.product_count <> 0 OR o.documentation_current <> 0)
   AND NOT EXISTS (SELECT 1 FROM products p JOIN listings l ON l.product_id = p.id
                    WHERE p.vendor_id = o.id AND p.status = 'active')`;

// search_documents is a STORED COPY of the two columns above (popularity_score = product_count * 8,
// quality_score = documentation_current), so repairing the source leaves the index still serving
// the old numbers. It is only rebuilt by the collect tick, and only when a catalog import actually
// changed something — which could be days, or never.
//
// Rather than restate the derivation in SQL here (a second copy of the formula is how this whole
// class of bug starts), the migration declares the derived index stale by emptying it. `initialize`
// calls ensureSearchIndex a few lines after runMigrations on the same boot, and ensureSearchIndex
// already exists to rebuild an empty index from the catalog — so the rebuild happens once, through
// the one function that owns the derivation, before getDatabase() resolves and any request can be
// served. That rebuild also applies the status filter and the prune, which is what finally drops
// the retired collided-molecule listings out of search.
const INVALIDATE_SEARCH_INDEX = `DELETE FROM search_documents`;

// Migration form. `runMigrations` splits on ";", so no statement may contain one.
export const vendorStatsRepairSql = `${REPAIR_LISTED};
${REPAIR_EMPTY};
${INVALIDATE_SEARCH_INDEX};`;

// Callable form, for the places that already recompute derived catalog stats: the collect tick
// (next to recomputeCompoundStats, and before the search index is rebuilt from these columns) and
// the tail of the fixture seed, so demo vendors are DERIVED rather than hand-authored.
export async function recomputeVendorStats(db: SqlConnection): Promise<void> {
  await db.query(REPAIR_LISTED);
  await db.query(REPAIR_EMPTY);
}
