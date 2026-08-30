// Migration 54 — say who actually set each listing's price.
//
// Migration 53 added `listings.price_source` with DEFAULT 'catalogue' and no backfill. Every
// listing whose CURRENT price had been set by an approved page-scrape claim before that column
// existed was therefore stamped as if the vendor's own feed had set it — including the 27
// umbrella-labs "$100" promo-banner prices the column was introduced to distinguish. The Phase-3
// rule that a scrape-set price never holds off its own correction (catalogue-claims.ts,
// `previousSource === "page"`) never matched them: on the next feed read they were held for a
// person again as a ÷6 move, and the junk stayed on the site.
//
// The column must be derived from the receipts, not defaulted. A listing is 'page' when its most
// recently published price claim came from a page extractor AND that value is still the listing's
// price. A price set by the feed — at creation (direct write) or by a 'catalogue-feed' claim —
// stays 'catalogue'. Two statements, bounded by the claim table; migrations run on the boot path.
import type { SqlConnection } from "./client";

export async function repairPriceSourceForPagePrices(db: SqlConnection): Promise<{ listings: number; observations: number }> {
  const listings = await db.query(
    `UPDATE listings l
     SET price_source = 'page'
     FROM (
       SELECT DISTINCT ON (subject_id)
              subject_id,
              extractor_version,
              CASE
                WHEN jsonb_typeof(value_json) = 'number' THEN (value_json #>> '{}')::numeric
                WHEN jsonb_typeof(value_json) = 'string' AND (value_json #>> '{}') ~ '^[0-9]+(\\.[0-9]+)?$' THEN (value_json #>> '{}')::numeric
                ELSE NULL
              END AS claimed_price
       FROM evidence_claims
       WHERE subject_type = 'listing' AND predicate = 'price' AND review_status = 'published'
       ORDER BY subject_id, COALESCE(published_at, reviewed_at, created_at) DESC, created_at DESC
     ) c
     WHERE l.id = c.subject_id
       AND l.origin = 'live'
       AND l.price_source = 'catalogue'
       AND c.extractor_version <> 'catalogue-feed'
       AND c.claimed_price IS NOT NULL
       AND ROUND(c.claimed_price, 2) = ROUND(l.price::numeric, 2)`,
  );
  // Migration 53 seeded one observation per live listing with `source = price_source` — the same
  // default. The observation is the dated record of that price, so it names the same writer.
  const observations = await db.query(
    `UPDATE price_observations o
     SET source = 'page'
     FROM listings l
     WHERE o.listing_slug = l.slug
       AND l.price_source = 'page'
       AND o.source = 'catalogue'
       AND o.price IS NOT NULL
       AND ROUND(o.price::numeric, 2) = ROUND(l.price::numeric, 2)`,
  );
  return { listings: listings.rowCount ?? 0, observations: observations.rowCount ?? 0 };
}
