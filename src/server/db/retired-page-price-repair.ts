// Migration 55 — a listing that is no longer sold does not keep a scraped price.
//
// A page-scrape price on a listing the vendor's feed still carries is corrected by the next feed
// read (D1, migration 54). A page-scrape price on a listing the feed NO LONGER carries can never
// be: the feed does not mention it, so nothing overrules it, and the site keeps showing the promo
// banner it was scraped from as the listing's price. On 2026-08-30, after the tail-starvation fix,
// that was every umbrella-labs listing still at "$100".
//
// What real price-comparison sites show for a delisted offer is its LAST KNOWN price with its
// date, never a number nobody observed. That last known price is on the receipt: the page claim
// that set the scraped value recorded what it replaced (`previous_value_json`), and on these
// listings that was the feed's price at creation. Restore it, say the feed set it, and correct
// the observation migration 53 seeded for it. Available listings are not touched — the feed
// itself corrects those, with a receipt. Two statements, bounded by the claims table.
import type { SqlConnection } from "./client";

export async function repairRetiredPagePrices(db: SqlConnection): Promise<{ listings: number; observations: number }> {
  const listings = await db.query(
    `UPDATE listings l
     SET price = c.replaced_price, price_source = 'catalogue', previous_price = NULL
     FROM (
       SELECT DISTINCT ON (subject_id)
              subject_id,
              extractor_version,
              CASE WHEN jsonb_typeof(value_json) = 'number' THEN (value_json #>> '{}')::numeric ELSE NULL END AS claimed_price,
              CASE WHEN jsonb_typeof(previous_value_json) = 'number' THEN (previous_value_json #>> '{}')::numeric ELSE NULL END AS replaced_price
       FROM evidence_claims
       WHERE subject_type = 'listing' AND predicate = 'price' AND review_status = 'published'
       ORDER BY subject_id, COALESCE(published_at, reviewed_at, created_at) DESC, created_at DESC
     ) c
     WHERE l.id = c.subject_id
       AND l.origin = 'live'
       AND l.availability = 'Unavailable'
       AND l.price_source = 'page'
       AND c.extractor_version <> 'catalogue-feed'
       AND c.claimed_price IS NOT NULL AND ROUND(c.claimed_price, 2) = ROUND(l.price::numeric, 2)
       AND c.replaced_price IS NOT NULL AND c.replaced_price > 0`,
  );
  // The observation seeded for the scraped price now records the restored one, from the feed.
  const observations = await db.query(
    `UPDATE price_observations o
     SET price = l.price, source = 'catalogue'
     FROM listings l
     WHERE o.listing_slug = l.slug
       AND l.origin = 'live' AND l.availability = 'Unavailable' AND l.price_source = 'catalogue'
       AND o.source = 'page' AND o.price IS NOT NULL AND ROUND(o.price::numeric, 2) <> ROUND(l.price::numeric, 2)`,
  );
  return { listings: listings.rowCount ?? 0, observations: observations.rowCount ?? 0 };
}
