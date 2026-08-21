-- VialGrade traffic reality-check. All read-only SELECTs; nothing is modified.
-- Run in the Neon SQL Editor. Run QUERY 1 first — it's the one that answers the question.
-- The day expression matches what the admin page now uses (4am America/New_York boundary).


-- ============================================================================
-- QUERY 1 — THE ONE THAT MATTERS: what does a typical day actually look like?
-- ============================================================================
-- readers_that_day = 1 with a high most_pages_by_one_reader means one person
-- browsing a lot. That pattern, repeated across most days, is you.
-- Several readers each reading 1-3 pages is real outside traffic.

WITH w AS (
  SELECT * FROM page_views
  WHERE NOT is_bot AND created_at > NOW() - INTERVAL '30 days'
),
per_reader_day AS (
  SELECT TO_CHAR((created_at AT TIME ZONE 'America/New_York') - INTERVAL '4 hours', 'YYYY-MM-DD') AS d,
         visitor_hash,
         COUNT(*) AS views
  FROM w
  GROUP BY 1, 2
)
SELECT d                        AS day,
       COUNT(*)                 AS readers_that_day,
       SUM(views)               AS pages_read,
       MAX(views)               AS most_pages_by_one_reader,
       ROUND(AVG(views), 1)     AS avg_pages_per_reader
FROM per_reader_day
GROUP BY d
ORDER BY d;


-- ============================================================================
-- QUERY 2 — How deep did people go? The shape of the distribution.
-- ============================================================================
-- A long tail of 1-2 page readers = real discovery traffic.
-- A few hashes with 15+ pages = an operator (you) or a determined researcher.

SELECT views_by_this_reader,
       COUNT(*) AS how_many_reader_days
FROM (
  SELECT visitor_hash, COUNT(*) AS views_by_this_reader
  FROM page_views
  WHERE NOT is_bot AND created_at > NOW() - INTERVAL '30 days'
  GROUP BY visitor_hash
) t
GROUP BY views_by_this_reader
ORDER BY views_by_this_reader DESC;


-- ============================================================================
-- QUERY 3 — Where they came from, and on what.
-- ============================================================================
-- '(direct)' + 'desktop' dominating is consistent with your own browsing.
-- Real discovery shows google.com / reddit.com and a mobile share.

SELECT COALESCE(referrer_host, '(direct)') AS source,
       COALESCE(device, 'unknown')         AS device,
       COUNT(*)                            AS pages,
       COUNT(DISTINCT visitor_hash)        AS reader_days
FROM page_views
WHERE NOT is_bot AND created_at > NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY pages DESC;


-- ============================================================================
-- QUERY 4 — The 4 outbound clicks, in full.
-- ============================================================================
-- These are the ones that matter for a vendor conversation.

SELECT TO_CHAR(created_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD HH24:MI') AS clicked_at_et,
       vendor_slug,
       listing_slug,
       destination_host,
       COALESCE(device, 'unknown') AS device,
       landing_path,
       is_bot,
       converted_at IS NOT NULL AS vendor_confirmed_an_order
FROM outbound_clicks
ORDER BY created_at DESC
LIMIT 50;


-- ============================================================================
-- QUERY 5 — Sanity check: how much is being excluded, and since when?
-- ============================================================================

SELECT (SELECT COUNT(*) FROM page_views)                                          AS page_views_all_time,
       (SELECT COUNT(*) FROM page_views WHERE is_bot)                             AS excluded_as_automated,
       (SELECT MIN(created_at) FROM page_views WHERE NOT is_bot)                   AS first_counted_view,
       (SELECT COUNT(*) FROM outbound_clicks)                                      AS clicks_all_time,
       (SELECT COUNT(*) FROM outbound_clicks WHERE is_bot)                         AS clicks_excluded,
       (SELECT COUNT(*) FROM outbound_clicks WHERE converted_at IS NOT NULL)       AS orders_confirmed_by_a_vendor;
