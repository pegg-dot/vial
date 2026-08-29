# A3 — SOTA research: price-history / price-observation pipeline for VialGrade

Date: 2026-08-29. Scope: how mature trackers model price observations, how they present deltas on sparse data, what Postgres storage fits ~1k series × daily, what the peptide-comparison field does today, and honest-presentation patterns — then concrete recommendations for VialGrade (schema, write rule, cadence, dedupe, delta rules, backfill, copy, SQL).

Ground truth about VialGrade's current state (read from `/Users/natepegg/vial`, not edited):

- `price_observations` exists (migration 18, `src/server/db/price-observations-schema.ts`): `(id, listing_slug, vendor_slug, compound_slug, price NUMERIC NOT NULL, source 'live'|'wayback', observed_day DATE, observed_at TIMESTAMPTZ, created_at, UNIQUE(listing_slug, observed_day))` + indexes on `(listing_slug, observed_day)` and `(compound_slug, observed_day)`. Only writers are three ad-hoc scripts (`scripts/ingest-market.mjs`, `scripts/ingest-wayback-prices.mjs`, `scripts/backfill-prices-wayback.mjs`) calling `recordPriceObservation()` one row per round trip. The cron (`/api/internal/cron/collect`, hourly, `TICK_MAX_TARGETS = 8`, 45 s budget) never writes it.
- `listings.price_history JSONB` is write-once: `recordCatalogListing` sets it to `[price]` only `WHEN price_history = '[]'` (`src/server/ingest/live-sources.ts:367`). It never grows from the cron; it only grows when a script calls `rebuildListingPriceHistory()`, which projects observations back into an undated array.
- `compounds.price_change` = median of per-listing `(h[last]-h[0])/h[0]` over that undated array (`src/server/intelligence/cascade.ts:112-121`). The product page computes the same from `priceHistory[0]` (`src/app/products/[slug]/page.tsx:95-97`). The compound page averages arrays index-wise across listings (`src/app/compounds/[slug]/page.tsx:78-81`) — index ≠ date, so it averages prices observed on different days.
- Hard rule (`docs/HANDOFF.md:43`): boot/cron work must be a fixed number of round trips, never per-row.

---

## 1. Observation modelling in mature price trackers

### 1.1 Keepa (Amazon) — sparse change-list per price type, per ASIN

Keepa's public backend structs are the closest thing to a published data model:

- `csv`: "two dimensional price history array. First dimension: CsvType. Second dimension: Each array has the format timestamp, price, […] … A price of '-1' means that there was no offer at the given timestamp (e.g. out of stock)." Prices are integers in the smallest currency unit ("4900 => $ 49.00 … if domainId is 5, Japan, then price: 4900 => ¥ 4900"). Timestamps are "Keepa Time minutes". `trackingSince`: "the time we have started tracking this product". `parentAsin`: "The ASIN of the parent product (if the product has variations, otherwise null)" — i.e. each variation is its own ASIN and its own series. Source: https://raw.githubusercontent.com/keepacom/api_backend/master/src/main/java/com/keepa/api/backend/structs/Product.java
- `stats`: `current` ("prices / ranks … of the time we last updated it"), `avg30/avg90/avg180/avg365` ("weighted mean for the last N days"), `min`/`max` ("lowest/highest prices registered"), `minInInterval`/`maxInInterval`, `outOfStockPercentage30/90`, `lastOffersUpdate`; -1 = insufficient data / no offer, -2 = field not set. Source: https://raw.githubusercontent.com/keepacom/api_backend/master/src/main/java/com/keepa/api/backend/structs/Stats.java
- The Python client parses each type into paired value/`*_time` arrays and renders step charts. Source: https://keepaapi.readthedocs.io/en/latest/product_history.html

What to take from it: (a) out-of-stock is an explicit sentinel *inside the series* (-1), not a gap and not a carried-forward price; (b) "average" is time-weighted over the interval, so a change-list representation still produces a defensible mean; (c) "lowest ever" is bounded by `trackingSince` and reported as "registered", not "ever"; (d) variants are separate series.

**Flag (inference):** the `[timestamp, value, …]` format is a change-list (a point only when the value changes) — that is how the step charts are drawn — but Keepa's product-object discussion page (https://keepa.com/#!discuss/t/product-object/116) returned 403 to every fetch, so I could not quote a sentence that says "only on change". Update frequency claims ("tracked products updated at least hourly") only appear in third-party guides (e.g. https://www.sellersprite.com/en/help/keepa-tips-of-extension) — treat as unverified.

### 1.2 camelcamelcamel — polled at variable cadence; OOS drawn as a dotted line; stale types hidden after 90 days

- Cadence and honesty about misses (their own blog): "Newegg and Best Buy are checked every few hours … zZounds and Backcountry … a couple of times per day … Amazon … prices appear to change as often as we can check them … we sometimes miss price changes." Prioritisation: products with a price watch form a "tracked" sub-group updated faster. Source: https://camelcamelcamel.com/blog/how-our-price-checking-system-works/ (linked from https://camelcamelcamel.com/support/price_checks). Earlier: "we can check the prices of each tracked product four or five times per day." https://camelcamelcamel.com/blog/price-updating-frequency-increased-rss/
- Out of stock: "Whenever a product goes out of stock, it is now reflected in our charts as a horizontal dotted line." https://camelcamelcamel.com/blog/our-price-history-charts-now-display-dotted-lines-when-items-are-out-of-stock-plus-8-years-of-the-camels/
- Staleness rule: "we've started hiding price types that have been out of stock for more than 90 days … You won't create price watches for price types … that may not ever come back in stock." https://camelcamelcamel.com/support/no_recent_prices

### 1.3 PCPartPicker — per-SKU polling; daily category aggregates with min/max/avg

"PCPartPicker Price Trends are daily generated graphs … Thousands of components are grouped into logical categories and combined with price data … presented as an intensity graph of price distributions with minimum, maximum, and average price trends." https://pcpartpicker.com/forums/topic/394577-introducing-pcpartpicker-price-trends — Note the cautionary forum thread where a user could not reconcile the graph with what they paid (rebates, promo codes, card discounts): the graph is *list price as observed*, not paid price, and the site never clarified. https://pcpartpicker.com/forums/topic/126310-understanding-the-pcpartpicker-price-history-graph

### 1.4 Honey / Google Shopping / Google Flights / idealo / PriceSpy — windows and "typical"

- Honey: "Honey tracks price changes for items on Amazon for 30, 60, 90, or 120 days." https://help.joinhoney.com/article/46-can-i-use-honey-on-amazon
- Google Shopping: price is "low, typical, or high, and how its price changed in recent months"; the "30-day low" is "based on the item's total price, which usually consists of item price, discount, and shipping cost"; typical price is "based on info from sellers across the web"; and the explicit disclaimer "This feature doesn't predict how a price may change in the future." https://support.google.com/faqs/answer/10675605 ; the window is "how stores have priced it over the past three months." https://blog.google/products-and-platforms/products/shopping/save-money-price-insights-price-alerts/
- Google Flights defines "typical" as "the median of the cheapest prices found for that route over the past 12 months, taking into account … time of year, trip length, and cabin class", and badges a deal only at ≥20% below typical. https://support.google.com/travel/answer/16497283
- idealo: "check out how much an item cost over the course of the last year". https://www.idealo.co.uk/info/uk/pricealerts/ PriceSpy: "see when and how often shops change the price of a product" and "how often there is a campaign price". https://pricespy.co.uk/price-history--ecYSSD4hIAACEAXXWu
- SteamDB: "We keep track of lowest prices for each game … these lowest recorded prices" — 'recorded', and pre-2016 history for some regions came from IsThereAnyDeal, i.e. lows are bounded by tracking start. https://steamdb.info/faq/

### 1.5 GoodRx (health-adjacent)

GoodRx's public methodology is about *derivation transparency*, not a per-drug price series: they name each data source, the multipliers used to project a sample to national totals, and the corrections ("We also adjusted for missing claims due to outages at Change Healthcare"). https://www.goodrx.com/healthcare-access/research/tracking-prescription-out-of-pocket-spending-goodrx-research-methodology — I found no published GoodRx rule for per-drug price-history windows or minimum sample sizes.

### 1.6 Statistical agencies on "unavailable": never carry forward silently

- ABS: carry-forward assumes "no transactions … hence there can be no price change" and "consistently biases the index towards zero (that is, biased downward when prices are rising and biased upward when prices are falling)." https://www.abs.gov.au/statistics/detailed-methodology-information/concepts-sources-methods/producer-and-international-trade-price-indexes-concepts-sources-and-methods/2022/chapter-3-technical-methodology/imputation-theory-and-methodology
- BLS CPI: "Carry forward imputation is used if it is not possible to use other methods of imputation, or in cases where prices are fixed"; when an item is unavailable "the observation … is left out of the index calculation for period t". https://www.bls.gov/opub/hom/cpi/calculation.htm

Synthesis for Q1: the mature pattern is **append the observation, including the unavailable state, at each check; derive runs at read time; keep variants as separate series; store the price in its observed currency/unit; bound every superlative by the tracking start date.** Nobody carries a last price forward as if it were observed.

---

## 2. Delta semantics with SPARSE data

Windows in the wild: 30/60/90/120 d (Honey); "past three months" + "30-day low" (Google Shopping); 12-month median (Google Flights, idealo); 30/90/180/365-day weighted means plus all-time and in-interval min/max (Keepa); 90-day OOS hide (camelcamelcamel); 7-day rolling median over a 90-day study (The Peptide Catalog, below).

Minimum-N / minimum-span: **no consumer tracker publishes a formal rule** (flag). Practice is implicit: Keepa returns -1 for "insufficient data"; Google shows nothing rather than a weak insight; Pepticker renders "0 vendors tracked · 0 live prices · Last crawl: warming up" rather than a fabricated number (https://pepticker.com/peptides/bpc-157). The nearest formal analogues are disclosure-control thresholds: ONS suppresses cell counts under 3 in births/deaths tables and the Secure Research Service checks outputs against "a low count threshold of 10" (https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/methodologies/comparisonofposttabularstatisticaldisclosurecontrolmethods); Pew declines to break out subgroups when "relatively small sample sizes" make estimates imprecise (https://www.pewresearch.org/science/2022/02/09/covid-19-response-methodology/).

Avoiding the fake 0% / fake spike:
- The fake 0% is a *construction* bug: a series seeded with one point, then `(last-first)/first`. VialGrade has exactly this (write-once `[price]`). Cure: a delta needs two observations on *different days* with a real span.
- The fake spike is a *matching* bug: comparing a kit to a vial, a sale price to a list price, or a coupon-adjusted price to a list price. Cure: one series per (vendor, compound, size, pack); store list price; never bake coupons in (MyPeptidePrice shows "Prices shown after known SAMMYC discounts" — a derived number that changes when a code expires; PeptideCritic stacks "Coupon 15% + Automatic Sitewide 30% = Total 45%". https://mypeptideprice.com/ , https://peptidecritic.com/peptides/bpc-157).
- Typical / lowest: Google Flights uses a *median of cheapest* over 12 months; Keepa's `min` is "lowest … registered" since `trackingSince`; SteamDB says "lowest recorded". The honest label is "lowest we've observed since {date}", never "lowest ever".

Copy when history is thin: camelcamelcamel "No Recent Prices"; Google "doesn't predict"; Peptide Grades "Price snapshot · August 2026 — Prices change often — confirm the current price on the vendor's site before buying" (https://peptidegrades.com/topics/peptide-guides/best-bpc-157/); Disclosed Labs marks staleness per row — "price updated today" vs "⚠ price updated 3w ago" (https://www.disclosedlabs.com/prices/bpc-157).

---

## 3. Postgres storage at ~1k series × daily (~330k rows/yr)

### 3.1 Plain table vs array column vs Timescale

- Plain table is the right answer at this scale. Postgres' own guidance on partitioning: benefits "will normally be worthwhile only when a table would otherwise be very large … a rule of thumb is that the size of the table should exceed the physical memory of the database server." https://www.postgresql.org/docs/current/ddl-partitioning.html — 330k rows/yr × ~120 B ≈ 40 MB/yr.
- Timescale hypertables default to 7-day chunks sized so "the indexes of chunks currently being ingested into fit within 25% of main memory (shared_buffers)" (https://www.tigerdata.com/docs/learn/hypertables/sizing-hypertable-chunks). At 900 rows/day that is a chunk of ~6k rows — the machinery is pure overhead here; revisit only past ~10M rows. (Flag: I believe Neon offers the `timescaledb` extension, but I did not verify it; it is unnecessary regardless.)
- Array/JSONB column: Postgres docs — "Arrays are not sets; searching for specific array elements can be a sign of database misdesign. Consider using a separate table with a row for each item that would be an array element." https://www.postgresql.org/docs/current/arrays.html — and VialGrade's array is undated, so every delta from it has an unknown span.
- Run-length (`valid_from/valid_to`) vs append-only: SCD-2 makes every "as of" query a range predicate and turns backfills sequential ("To fix November 15th, you'd need to: Rerun November 1st … keep going for 30 days, sequentially"); datestamped snapshots are idempotent and parallel-backfillable. https://blog.dataexpert.io/p/stop-using-slowly-changing-dimensions — and a `valid_to` update is a second writer on an existing row, which the codebase has been burned by before.

### 3.2 Index/immutability notes

- `timestamptz::date` depends on the session `TimeZone`, so it is STABLE, not IMMUTABLE, and cannot be an index expression: "All functions and operators used in an index definition must be 'immutable'" (https://www.postgresql.org/docs/current/sql-createindex.html); "a function that manipulates timestamps might well have results that depend on the TimeZone setting. For safety, such functions should be labeled STABLE" (https://www.postgresql.org/docs/current/xfunc-volatility.html). Either keep a real `observed_day DATE` column (current schema — correct) or use `(observed_at AT TIME ZONE 'UTC')::date`, which is immutable because `AT TIME ZONE` yields a `timestamp without time zone` "as the time would appear in that zone" (https://www.postgresql.org/docs/current/functions-datetime.html). Generated columns have the same rule: "can only use immutable functions" (https://www.postgresql.org/docs/current/ddl-generated-columns.html).
- Covering index: "an index-only scan can return the contents of non-key columns without having to visit the index's table" via `INCLUDE` (https://www.postgresql.org/docs/current/sql-createindex.html).

### 3.3 The three queries (reference semantics cited inline)

Docs used: `DISTINCT ON` "keeps only the first row of each set … must match the leftmost ORDER BY" (https://www.postgresql.org/docs/current/sql-select.html); `LATERAL` sub-selects evaluated per row and `LEFT JOIN LATERAL … ON true` (same page); window functions "permitted only in the SELECT list and the ORDER BY clause … use a sub-select" to filter on them (https://www.postgresql.org/docs/current/tutorial-window.html); `percentile_cont(0.5) WITHIN GROUP (ORDER BY …)` (https://www.postgresql.org/docs/current/functions-aggregate.html); `FILTER (WHERE …)` — "only the input rows for which the filter_clause evaluates to true are fed to the aggregate" (https://www.postgresql.org/docs/current/sql-expressions.html); multi-array `unnest(anyarray, anyarray [, …])` "only allowed in a query's FROM clause" (https://www.postgresql.org/docs/current/functions-array.html); `ON CONFLICT` arbiter inference and the cardinality rule "will not be allowed to affect any single existing row more than once" (https://www.postgresql.org/docs/current/sql-insert.html); UNNEST batch inserts "2.13x faster" than multi-row VALUES at 1,000 rows (https://www.tigerdata.com/blog/boosting-postgres-insert-performance).

**(a) Latest N *distinct* price points per listing (run-length derived at read time), one query:**

```sql
-- $1 = text[] of listing slugs, $2 = N
WITH obs AS (
  SELECT listing_slug, observed_day, price, available,
         LAG(price)     OVER w AS prev_price,
         LAG(available) OVER w AS prev_available
  FROM price_observations
  WHERE listing_slug = ANY($1::text[])
  WINDOW w AS (PARTITION BY listing_slug ORDER BY observed_day)
), changes AS (
  SELECT listing_slug, observed_day, price, available,
         ROW_NUMBER() OVER (PARTITION BY listing_slug ORDER BY observed_day DESC) AS rn
  FROM obs
  WHERE prev_price IS DISTINCT FROM price          -- first row (prev NULL) counts as a change
     OR prev_available IS DISTINCT FROM available
)
SELECT listing_slug, observed_day, price, available
FROM changes
WHERE rn <= $2
ORDER BY listing_slug, observed_day;
```

For "latest N *rows* per listing" (no run-length), the LATERAL form is cheaper on the `(listing_slug, observed_day)` index:

```sql
SELECT l.slug, o.observed_day, o.price, o.available
FROM listings l
LEFT JOIN LATERAL (
  SELECT observed_day, price, available
  FROM price_observations p
  WHERE p.listing_slug = l.slug
  ORDER BY observed_day DESC
  LIMIT $2
) o ON true
WHERE l.slug = ANY($1::text[]);
```

**(b) 30-day change per compound, one query (matched per-listing changes, then median):**

```sql
-- Window: baseline = last in-stock price on/before (today-30d) but no older than 7 days before it;
-- latest  = last in-stock price within the last 2 days. Both must exist for a listing to count.
WITH p AS (
  SELECT CURRENT_DATE AS today, CURRENT_DATE - 30 AS start_day
), latest AS (
  SELECT DISTINCT ON (o.listing_slug) o.listing_slug, o.compound_slug, o.observed_day, o.price
  FROM price_observations o, p
  WHERE o.available AND o.price IS NOT NULL AND o.observed_day >= p.today - 2
  ORDER BY o.listing_slug, o.observed_day DESC
), baseline AS (
  SELECT DISTINCT ON (o.listing_slug) o.listing_slug, o.observed_day, o.price
  FROM price_observations o, p
  WHERE o.available AND o.price IS NOT NULL
    AND o.observed_day <= p.start_day AND o.observed_day >= p.start_day - 7
  ORDER BY o.listing_slug, o.observed_day DESC
), per_listing AS (
  SELECT l.compound_slug, l.listing_slug,
         b.price AS base_price, l.price AS latest_price,
         ((l.price - b.price) / b.price * 100)::float8 AS pct,
         (l.observed_day - b.observed_day) AS span_days
  FROM latest l JOIN baseline b USING (listing_slug)
  WHERE b.price > 0
)
SELECT compound_slug,
       COUNT(*)                                            AS n_listings,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY pct)    AS median_pct_30d,
       COUNT(*) FILTER (WHERE pct <> 0)                    AS n_moved,
       MIN(span_days)                                      AS min_span_days,
       MAX(span_days)                                      AS max_span_days
FROM per_listing
GROUP BY compound_slug
HAVING COUNT(*) >= 3;          -- compound-level minimum; listing-level rows come from per_listing
```

Drop the final aggregate to get the per-listing 30-day deltas (same CTEs). Replace `CURRENT_DATE - 30` with `- 90` for the 90-day window.

**(c) Idempotent daily batch write, one round trip.** Two variants.

Variant 1 — zero marshalling, run once at the end of a collect tick (`$1` = tick start). It projects what the importers just wrote into `listings`, so there is exactly one writer of observations:

```sql
INSERT INTO price_observations
  (id, listing_slug, vendor_slug, compound_slug, price, currency, available, source, observed_day, observed_at)
SELECT 'priceobs:' || l.slug || ':' || to_char((l.observed_at AT TIME ZONE 'UTC')::date, 'YYYYMMDD'),
       l.slug, o.slug, c.slug,
       CASE WHEN l.price > 0 THEN l.price END,           -- NULL when the page showed no price
       l.currency,
       l.availability <> 'Unavailable',
       'live',
       (l.observed_at AT TIME ZONE 'UTC')::date,
       l.observed_at
FROM listings l
JOIN products p      ON p.id = l.product_id
JOIN organizations o ON o.id = p.vendor_id
JOIN compounds c     ON c.id = p.compound_id
WHERE l.origin = 'live' AND p.status = 'active'
  AND l.observed_at >= $1::timestamptz
  AND (l.price > 0 OR l.availability = 'Unavailable')
ON CONFLICT (listing_slug, observed_day) DO UPDATE
  SET price = EXCLUDED.price, available = EXCLUDED.available,
      observed_at = EXCLUDED.observed_at, source = 'live'
  WHERE EXCLUDED.observed_at >= price_observations.observed_at;   -- last check of the day wins
```

Variant 2 — explicit rows via UNNEST (use when the importer carries data `listings` does not, e.g. a `source_snapshot_id`). Arrays are one parameter per column regardless of batch size:

```sql
INSERT INTO price_observations
  (id, listing_slug, vendor_slug, compound_slug, price, currency, available, source, source_snapshot_id, observed_day, observed_at)
SELECT 'priceobs:' || u.listing_slug || ':' || to_char(u.observed_day, 'YYYYMMDD'),
       u.listing_slug, u.vendor_slug, u.compound_slug, u.price, u.currency, u.available,
       'live', u.snapshot_id, u.observed_day, u.observed_at
FROM unnest($1::text[], $2::text[], $3::text[], $4::numeric[], $5::text[], $6::boolean[],
            $7::text[], $8::date[], $9::timestamptz[])
     AS u(listing_slug, vendor_slug, compound_slug, price, currency, available, snapshot_id, observed_day, observed_at)
ON CONFLICT (listing_slug, observed_day) DO UPDATE
  SET price = EXCLUDED.price, available = EXCLUDED.available,
      observed_at = EXCLUDED.observed_at, source_snapshot_id = EXCLUDED.source_snapshot_id
  WHERE EXCLUDED.observed_at >= price_observations.observed_at;
```

Caveat from the docs: a batch containing the same `(listing_slug, observed_day)` twice raises a cardinality error under `DO UPDATE` — dedupe in JS (or `SELECT DISTINCT ON (listing_slug, observed_day) … ORDER BY observed_at DESC` inside the INSERT's SELECT) before sending. VialGrade uses `pg` `Pool` over TCP (`src/server/db/client.ts:42`), so "one round trip" means one statement; Neon's own guidance is the same either way: "each round trip will add at least the minimum observed latency" (https://neon.com/blog/how-to-minimise-the-impact-of-database-latency).

### 3.4 Backfilling the existing `price_history` array without inventing timestamps

- Length-1 arrays are the write-once `[price]` from first live ingest. The only real timestamps attached to that value are `listings.created_at`/`observed_at`; the association is inferred from code paths, not stored. **Recommendation: discard the array; write one real observation for today from the current `price`/`availability` (Variant 1 with `$1 = '-infinity'` once).** Optional and flagged: also insert `(price_history[0], created_at::date, source='backfill-first-seen')` for `origin='live'` listings where `created_at < today` — a real DB timestamp, but a reconstructed pairing; if done, label it in the UI as "first seen (reconstructed)".
- Length ≥2 arrays were produced by `rebuildListingPriceHistory()` *from* `price_observations`, so the dated originals already exist there (source `wayback` with Wayback capture timestamps — the `available` API returns "a single closest snapshot" to the requested `YYYYMMDDhhmmss` https://archive.org/help/wayback_api.php). Discard the arrays; keep the observations.
- Seeded/demo listings (`origin <> 'live'`): never write observations; their arrays are fiction.
- Then stop writing `price_history` and drop it in a later migration once `src/app/products/[slug]/page.tsx`, `src/app/compounds/[slug]/page.tsx`, `src/components/market/compound-market-table.tsx`, `cascade.ts`, `repository.ts`, `seed.ts`, `review/repository.ts` no longer read it (verify every call site).

---

## 4. Peptide-specific market

What exists (all "research use only" framed; all normalise to $/mg; none I could reach shows a per-listing price-history chart):

| Site | Units / cadence | Trend or change shown | Nudges / pitfalls |
|---|---|---|---|
| The Peptide Catalog Q1-2026 report — https://thepeptidecatalog.com/articles/peptide-pricing-report-q1-2026 | "A daily scraper … writes a snapshot row to an `offer_price_history` table"; $/mg = "price_cents ÷ (mg_per_vial × vial_count)"; 3,596 obs / 9 vendors / 56 peptides / 91 days | "7-day rolling median per-mg price"; "Median and range figures … computed from in-stock observations only; stockout rates … from all observations" | Honest caveats: cohort shifted mid-window (6→8 vendors), "assumes purity parity", stock-status semantics vary by vendor. Best methodology write-up in the field. |
| PeptideScouter — https://peptidescouter.com/ , /price-changes | "refreshed once daily"; "Shipping is not included"; "Prices updated X hours ago" per vendor | Daily digest: "5 back in stock · 6 out of stock · 10 price movers · 1 new listing" | "no rankings, no editor's picks"; affiliate Buy button disclosed. Cleanest neutral framing. |
| Pep-Index — https://pep-index.com/ | $/mg, "Prices refreshed 2026-08-29"; sizes listed separately ("10mg · $35", "100 × 10mg · $1875") | /trends page exists (not inspected) | "[Buy $X →]" affiliate links; "does not score or grade vendors". |
| PeptideCritic — https://peptidecritic.com/peptide-price-index , /peptides/bpc-157 | $/mg range per peptide; "Price Change" column; sorts "Biggest price drop / Biggest price rise" | Change indicator without a stated window (I could not find the definition) | Counter-example: coupon stacking baked into the shown $/mg ("Coupon 15% … Automatic Sitewide … Total: 45%"), "Buy" affiliate links. |
| MyPeptidePrice — https://mypeptideprice.com/ | "$/mg … after-code price ÷ total milligrams"; "refreshed on a schedule" | None | Counter-example: "Prices shown after known SAMMYC discounts where available" — a derived price that silently changes when a code dies. |
| Disclosed Labs — https://www.disclosedlabs.com/prices/bpc-157 | $/mg with per-row freshness "price updated today" / "⚠ price updated 3w ago"; "27% more per mg vs cheapest"; "Apply discount codes" toggle (off by default) | None | Good: staleness flag per row and discounts as an opt-in overlay; mild nudge: "Best value / Lowest price" sorts. |
| Peptide Grades — https://peptidegrades.com/topics/peptide-guides/best-bpc-157/ | $/mg and $/vial, "Price snapshot · August 2026" | None | Copy worth borrowing: "Prices change often — confirm the current price on the vendor's site before buying." Mild nudge: "Lowest Grade A price". |
| PeptideDeck — https://www.peptidedeck.com/blog/bpc-157-for-sale | $/mg bands by vial size | None | Counter-example: "Top Pick", "The sweet spot", "Non-negotiable". |
| Pepticker — https://pepticker.com/peptides/bpc-157 | $/mg (currently "0 vendors tracked · 0 live prices · Last crawl: warming up") | Price alerts ("Email me the moment BPC-157 drops by at least…") | Honest empty state; alert copy is a soft buy nudge. |
| Path to Peptides — https://www.pathtopeptides.com/PeptidePricing | "weekly updates", 20+ vendors | (403 on fetch; not inspected) | — |

Pitfalls to design around (from the above plus VialGrade's own data): kit vs single vial and N-packs (normalise per mg × count and keep each pack as its own series); bulk tiers (record the single-unit list price; tiers are a separate fact); subscription/coupon prices (never in the series; at most an opt-in overlay like Disclosed Labs); shipping (exclude and say so — Google includes it in its 30-day low, so state the convention); BAC-water bundles (a bundle SKU is not the vial's price); "research use only" (keep the disclaimer; VialGrade must go further and never render "deal/drop/opportunity/buy" language).

---

## 5. Honest presentation patterns

- Say what the number is made of: "based on N checks over D days, first {date} → latest {date}" (Peptide Catalog reports observation counts and cohort shifts; GoodRx enumerates sources and corrections).
- Say what it is *not*: "doesn't predict how a price may change in the future" (Google); "Real observed prices, not a projection" (already in VialGrade's product page copy at `page.tsx:268` — keep).
- Bound superlatives by tracking start: "lowest recorded" (SteamDB), `min` since `trackingSince` (Keepa).
- Render unavailability as its own state, not a price: dotted line (camelcamelcamel), -1 sentinel (Keepa), stockout rate (Peptide Catalog); never carry forward (ABS/BLS).
- Flag staleness per row (Disclosed Labs "⚠ price updated 3w ago").
- Suppress rather than fabricate below a threshold (ONS/Pew practice; Pepticker's empty state).

Accessibility for sparklines:
- The chart is an image: `role="img"` + `aria-label` gives a canvas/SVG an accessible name (Chart.js: https://www.chartjs.org/docs/latest/general/accessibility.html); TanStack Charts requires `ariaLabel`, keeps `aria-hidden` descendants, and says essential context "belongs in HTML … easier to navigate, select, translate, and print than text embedded in SVG" (https://tanstack.com/charts/latest/docs/guides/accessibility).
- Complex-image rule: a short text alternative that names the chart and points to a long description, plus the long description itself — a data table, `<figure>/<figcaption>`, or `aria-describedby` (https://www.w3.org/WAI/tutorials/images/complex/).
- Motion: honour `prefers-reduced-motion: reduce` — MDN's pattern swaps a transform animation for an opacity change (https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion); WCAG 2.3.3 asks that non-essential motion be disableable and suggests "Take advantage of the reduce motion feature in the user agent or operating system" (https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html). A sparkline's draw-in is never essential.

---

## Recommendations for VialGrade

### R1. Schema (new migration version 53 — never edit v18's SQL; an ALTER added to an applied version never runs)

```sql
ALTER TABLE price_observations ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE price_observations ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE price_observations ADD COLUMN IF NOT EXISTS source_snapshot_id TEXT REFERENCES source_snapshots(id);
ALTER TABLE price_observations ALTER COLUMN price DROP NOT NULL;               -- NULL only when unavailable with no price shown
ALTER TABLE price_observations ADD CONSTRAINT price_obs_price_or_unavailable CHECK (price IS NOT NULL OR available = FALSE);
ALTER TABLE price_observations ADD CONSTRAINT price_obs_price_positive        CHECK (price IS NULL OR price > 0);
ALTER TABLE price_observations ADD CONSTRAINT price_obs_source_known          CHECK (source IN ('live','wayback','backfill-first-seen'));
-- Existing UNIQUE(listing_slug, observed_day) + idx on (listing_slug, observed_day) and (compound_slug, observed_day) stay.
-- Add a covering index only if EXPLAIN on query (b) shows heap fetches:
CREATE INDEX IF NOT EXISTS idx_price_obs_compound_day_cov
  ON price_observations (compound_slug, observed_day) INCLUDE (listing_slug, price, available);
```

Keep `observed_day` as a real column written by the writer in UTC (do not switch to an expression index; `timestamptz::date` is not immutable). Keep `id` but make new ids deterministic (`priceobs:<slug>:<YYYYMMDD>`) so a replayed batch is a no-op by construction. `source_snapshot_id` is nullable and best-effort (flag: the catalogue importers may not create `source_snapshots`; the provenance cron does).

### R2. Write rule: append-only per check, one row per listing per UTC day, last check of the day wins — NOT on-change

Reasons: (1) the fact is "we checked on day D and saw P / saw unavailable"; an unchanged price is still evidence and a missing day must mean "not checked", which on-change storage cannot distinguish from "no change"; (2) run-length is derivable at read time (query a) but the reverse is not; (3) SCD-2 needs a second writer to close `valid_to` and makes backfills sequential; (4) scale is ~40 MB/yr — nothing to optimise. Unavailable is written as `available=false` with the displayed price if any, else `price NULL` — never a carried-forward price (ABS/BLS).

Hook point: one statement (Variant 1) at the end of `runCollectionTick` after the importers, `$1 = tick start`. That is one extra round trip per tick, never per row, and there is exactly one writer of observation rows. Retire `recordPriceObservation()` for cron use (keep for scripts, or port the scripts to the batch form). Stop writing `listings.price_history`.

### R3. Cadence and dedupe

Cadence is whatever the collector achieves (hourly ticks × 8 targets; each catalogue ~every 12 h per `REFRESH_DEFAULT_INTERVAL_MINUTES = 720`); the series granularity is one point per UTC day. Dedupe = the existing `UNIQUE(listing_slug, observed_day)` + JS-side dedupe of any batch before `DO UPDATE`. Days without a successful check are gaps and render as gaps.

### R4. Delta windows and minimum-evidence rule (flag: thresholds are my judgment; no tracker publishes a formal rule)

- Listing level: show a **30-day** change (primary) and **90-day** (secondary) only when: baseline in-stock observation exists within 7 days *before* the window start; latest in-stock observation is ≤2 days old; actual span ≥ 14 days for 30d (≥ 45 for 90d); ≥ 2 distinct observation days. Otherwise show "since first seen" *with the date and the count*, never a percentage that implies a window.
- Compound level: `median` of per-listing matched deltas (query b), only when ≥3 listings qualify; always print `k of n listings had comparable history`. Do not difference two daily medians (cohort shifts, per the Peptide Catalog caveat).
- Superlatives: "lowest we've observed since {first_seen}" only; "typical" = median of in-stock $/mg over 90 days, shown only with ≥ 30 observation days.
- Sparkline: step line (Keepa-style) on dated points; dotted/hollow segment when `available=false`; gaps for unchecked days; no draw-in animation under `prefers-reduced-motion`.

### R5. Backfill policy

1. One-off: run Variant 1 with `$1 = '-infinity'` for `origin='live'` listings → one real observation per listing for today.
2. Keep every `source='wayback'` row (real capture timestamps).
3. Discard `price_history` contents entirely (length-1 = write-once seed; length ≥2 = projection of rows already in `price_observations`). Optional/flagged: the `backfill-first-seen` reconstruction from `created_at`; default is not to do it.
4. Never write observations for `origin <> 'live'`.
5. Replace `cascade.ts` `price_change` with query (b) (one query for all compounds per tick, not per compound), replace the compound page's index-wise average with a dated daily median that carries `n`, and drop `price_history` after all seven readers are migrated.

### R6. Display copy per state (no buy language anywhere)

- **No history (1 point):** "Price checked once, on {date}. No trend yet — a change needs at least two checks on different days."
- **Insufficient (2+ points, rule not met):** "{n} checks since {first_seen} — too short a span for a 30-day change. Latest: ${price} on {date}."
- **Trending (rule met):** "−8.2% over 30 days · {n} checks · ${base} on {base_date} → ${latest} on {latest_date}. Vendor list price before shipping or discounts. Observed, not projected."
- **Unavailable at last check:** "Not available when last checked ({date}). Last observed price ${x} on {date}."
- **Stale:** append "⚠ last checked {d} days ago" when the latest observation is > 3 days old.
- **Compound:** "Median of {k} listings' 30-day changes; {n−k} listings excluded for insufficient history." When k < 3: "Not enough listings with 30 days of checks to summarise a change."
- **Sparkline text alternative:** the same sentence as the visible copy in `aria-label`, plus a `<details>` table of `(date, price, available)` for the long description.

### R7. Things I'm unsure of (explicit)

- Thresholds in R4 (7-day baseline tolerance, 2-day freshness, 14/45-day min span, ≥3 listings): reasonable, unsourced; tune after a month of real rows.
- Keepa's on-change storage is inferred from its format; the authoritative page was unreachable.
- Whether to synthesise `backfill-first-seen` points from `created_at` (I lean no).
- `source_snapshot_id` linkage may be NULL for catalogue-JSON imports; verify which importers create snapshots.
- Dropping `NOT NULL` on `price` means every reader that does `Number(price)` will turn NULL into 0 — audit `getCompoundPriceSeries`, `getListingPriceMeta`, and any `array_agg(price)` before shipping, and use `FILTER (WHERE available AND price IS NOT NULL)` in every aggregate.
- Neon + Timescale availability: unverified and irrelevant at this scale.

---

## Sources

Keepa: https://raw.githubusercontent.com/keepacom/api_backend/master/src/main/java/com/keepa/api/backend/structs/Product.java · https://raw.githubusercontent.com/keepacom/api_backend/master/src/main/java/com/keepa/api/backend/structs/Stats.java · https://keepaapi.readthedocs.io/en/latest/product_history.html · https://keepa.com/api-docs/
camelcamelcamel: https://camelcamelcamel.com/blog/how-our-price-checking-system-works/ · https://camelcamelcamel.com/blog/price-updating-frequency-increased-rss/ · https://camelcamelcamel.com/blog/our-price-history-charts-now-display-dotted-lines-when-items-are-out-of-stock-plus-8-years-of-the-camels/ · https://camelcamelcamel.com/support/no_recent_prices · https://camelcamelcamel.com/support/price_checks
PCPartPicker: https://pcpartpicker.com/forums/topic/394577-introducing-pcpartpicker-price-trends · https://pcpartpicker.com/forums/topic/126310-understanding-the-pcpartpicker-price-history-graph
Honey: https://help.joinhoney.com/article/46-can-i-use-honey-on-amazon
Google: https://support.google.com/faqs/answer/10675605 · https://blog.google/products-and-platforms/products/shopping/save-money-price-insights-price-alerts/ · https://support.google.com/travel/answer/16497283
idealo / PriceSpy / SteamDB: https://www.idealo.co.uk/info/uk/pricealerts/ · https://pricespy.co.uk/price-history--ecYSSD4hIAACEAXXWu · https://steamdb.info/faq/
GoodRx: https://www.goodrx.com/healthcare-access/research/tracking-prescription-out-of-pocket-spending-goodrx-research-methodology
Statistical agencies: https://www.abs.gov.au/statistics/detailed-methodology-information/concepts-sources-methods/producer-and-international-trade-price-indexes-concepts-sources-and-methods/2022/chapter-3-technical-methodology/imputation-theory-and-methodology · https://www.bls.gov/opub/hom/cpi/calculation.htm · https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/methodologies/comparisonofposttabularstatisticaldisclosurecontrolmethods · https://www.pewresearch.org/science/2022/02/09/covid-19-response-methodology/
Postgres docs: https://www.postgresql.org/docs/current/sql-insert.html · https://www.postgresql.org/docs/current/sql-select.html · https://www.postgresql.org/docs/current/tutorial-window.html · https://www.postgresql.org/docs/current/functions-aggregate.html · https://www.postgresql.org/docs/current/sql-expressions.html · https://www.postgresql.org/docs/current/functions-array.html · https://www.postgresql.org/docs/current/sql-createindex.html · https://www.postgresql.org/docs/current/xfunc-volatility.html · https://www.postgresql.org/docs/current/functions-datetime.html · https://www.postgresql.org/docs/current/ddl-generated-columns.html · https://www.postgresql.org/docs/current/ddl-partitioning.html · https://www.postgresql.org/docs/current/arrays.html
Timescale / batch ingest / Neon: https://www.tigerdata.com/docs/learn/hypertables/sizing-hypertable-chunks · https://www.tigerdata.com/blog/boosting-postgres-insert-performance · https://neon.com/blog/how-to-minimise-the-impact-of-database-latency · https://neon.com/docs/serverless/serverless-driver
SCD-2 critique: https://blog.dataexpert.io/p/stop-using-slowly-changing-dimensions
Wayback: https://archive.org/help/wayback_api.php
Peptide sites: https://thepeptidecatalog.com/articles/peptide-pricing-report-q1-2026 · https://peptidescouter.com/ · https://peptidescouter.com/price-changes · https://pep-index.com/ · https://peptidecritic.com/peptide-price-index · https://peptidecritic.com/peptides/bpc-157 · https://mypeptideprice.com/ · https://www.disclosedlabs.com/prices/bpc-157 · https://peptidegrades.com/topics/peptide-guides/best-bpc-157/ · https://www.peptidedeck.com/blog/bpc-157-for-sale · https://pepticker.com/peptides/bpc-157 · https://www.pathtopeptides.com/PeptidePricing
Accessibility: https://www.chartjs.org/docs/latest/general/accessibility.html · https://tanstack.com/charts/latest/docs/guides/accessibility · https://www.w3.org/WAI/tutorials/images/complex/ · https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion · https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
