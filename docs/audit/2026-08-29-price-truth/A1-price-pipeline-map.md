# A1 — VialGrade price-history pipeline, as built (2026-08-29)

Repo: /Users/natepegg/vial @ b062199 (main). READ-ONLY audit. Every `file:line` below is relative to the repo root.

Legend — **[V]** verified by reading the cited code · **[I]** inferred (mechanism supported by code, occurrence not observed) · **[H]** HANDOFF claim about production data that cannot be checked without the DB.

One probe was run (pure function, no DB, no server): `scratchpad/audit/extract-probe.mjs` calls `extractClaimCandidates` from `src/server/agents/extract.ts` via `node --import tsx`. Its output is quoted in §C.4.

---

## A. Cron topology

### A.1 Schedules (`vercel.json:1-20`) [V]

| Path | Schedule | Handler | Does |
|---|---|---|---|
| `/api/internal/cron/collect` | `0 * * * *` (**hourly**) | `src/app/api/internal/cron/collect/route.ts` | catalogue/vendor collectors, compound+vendor stat recompute, search reindex, grade sweep |
| `/api/internal/cron/provenance` | `*/15 * * * *` | `src/app/api/internal/cron/provenance/route.ts` | refresh sweep (snapshot→claims) + auto-triage (→ publish) |
| `/api/internal/cron/refresh` | `30 5 * * *` (daily 05:30 UTC) | `src/app/api/internal/cron/refresh/route.ts` | intelligence sweep, retention, cost canary |
| `/api/internal/cron/notifications` | `30 */6 * * *` | `src/app/api/internal/cron/notifications/route.ts` | watchlist/follow alerts, saved-search alerts, digests, push |

**There is no 04:30 UTC cron any more.** `git log -S'"0 * * * *"' -- vercel.json` → commit `56b95aa` (2026-08-24, "The collectors were running at 8% of the cadence they declare") changed collect from `30 4 * * *` to `0 * * * *` [V]. `docs/HANDOFF.md:96` ("daily collect cron (04:30 UTC)") and the comment at `src/server/collect/scheduler.ts:380` ("The cron is now daily") are both stale [V].

### A.2 Auth + perimeter [V]

- Every cron handler authenticates itself: `CRON_SECRET` bearer via `secretMatches` (`collect/route.ts:14-25`, `refresh/route.ts:11-23`, `provenance/route.ts:21-31`, `notifications/route.ts:30-40`). Missing secret in production → `console.warn` + 401 `{"error":"Unauthorized"}`; outside production → allowed.
- Perimeter allowlist `PUBLIC_API_EXACT` at `src/server/auth/access-policy.ts:44-69` lists all four cron paths (`:47,:51,:56,:60`). A path missing there is 401'd by the perimeter *before* the handler (`:48-55` comment). Diagnostic: handler 401 body is `{"error":"Unauthorized"}`; perimeter 401 body is `{"error":"Authentication required","requestId":…}` (`docs/HANDOFF.md:70-72`).
- Guard test: `tests/unit/cron-routes-reachable.test.ts:15-36` reads `vercel.json` and requires every cron path to appear as a quoted string in `access-policy.ts` and to have `src/app<path>/route.ts` on disk. **Any new cron path must be added to `PUBLIC_API_EXACT` or this test goes red.**

### A.3 Collect tick (hourly) [V]

```
vercel cron ─► GET /api/internal/cron/collect              collect/route.ts:27
   ├─ isLiveIngestApproved()  (VIALGRADE_LIVE_INGEST_APPROVED=true)   :31-36  → 200 {skipped} if not
   ├─ runCollectionTick({ budgetMs: 45_000, maxTargets: TICK_MAX_TARGETS })   :38
   │      TICK_MAX_TARGETS = 8                              collect/schedule-capacity.ts:16
   │      maxDuration = 120                                 collect/route.ts:12
   └─ revalidateTag(CATALOG_CACHE_TAG, "max")               :44   (catalog cache is 6h, repository.ts:67-70)

runCollectionTick                                            collect/scheduler.ts:301-391
   ├─ syncCollectionTargets(db)                              :307 → :81-113
   │     targets from src/server/verify/known-vendors.json (34 vendors, 27 non-redFlag;
   │     catalogue collectors today: 1 shopify + 14 woo + 1 rsc = 16)   [counted via node one-liner]
   │     per vendor: catalog-shopify|catalog-woo|catalog-rsc (one), vendor-status, domain-age, tracker-ratings
   │     market-wide: enforcement-openfda, news-feeds        :36, :99
   │     cadences CADENCE_MINUTES                            :50-66  (catalog 6h, status 24h, openfda 24h, news 12h, domain-age 30d, ratings 7d)
   ├─ claimDueTargets(db, 200)  (enabled AND next_due_at<=NOW() ORDER BY next_due_at)   :320 → :120-129
   ├─ fair share: one slot per collector kind, cheapest kind first, then by age; cap maxTargets   :321-341
   ├─ for each target (stop BEFORE starting if over budget)  :342-359
   │     runOne(db,t)                                        :226-285
   │        catalog-shopify → importShopifyCatalog           :281-283
   │        catalog-woo     → importWooCommerceCatalog       :283
   │        catalog-rsc     → collectRscCatalog              :277-278 → :170-223 (sitemap → importRscCatalog → recordLabTest)
   │     settle(db,t,ok,items,error)                         :137-150
   │        UPDATE collection_targets (last_run_at,last_ok,last_items,consecutive_failures,
   │               enabled=false after 12 failures / 3 refusals, next_due_at = NOW()+delay)   :140-148
   │        recordCollectorRun(db,{collector,target,items,ok})   :149 → health/data-health.ts:58-63
   │            INSERT collector_runs(id,collector,target,items,ok)   schema: db/collector-runs-schema.ts:5-13
   │     catalogChanged = ok && (shopify || woo)   ← NOT rsc         :352
   ├─ if catalogChanged: recomputeCompoundStats → recomputeVendorStats → rebuildSearchIndex   :364-373
   └─ recomputeAllVendorGrades({ budgetMs: 45_000, limit: 200 })  every tick   :388
```

Collector run health: `getBrokenCollectors` / `detectBrokenCollectors` (`data-health.ts:38-72`) flags a (collector,target) whose latest run yielded 0 after a run that yielded >0. `collector_runs` retention 60 days (`db/retention.ts:40`).

Capacity arithmetic: `schedule-capacity.ts:27-77` (`ticksPerDay`, `dailyDemand`, `dailyCapacity`, `headroom`); `tests/unit/schedule-capacity.test.ts:33-46` reads the collect cron out of `vercel.json` and requires headroom > 1.5; `:50-54` is the positive control that `30 4 * * *` fails.

### A.4 Provenance tick (every 15 min) [V]

```
GET /api/internal/cron/provenance                            provenance/route.ts:33
   ├─ isLiveIngestApproved() gate                             :37-39
   ├─ runRefreshSweep(PROVENANCE_SWEEP_JOBS=20)               :41   (schedule-capacity.ts:88; default budget 90s, refresh/scheduler.ts:280)
   │     enqueueDueRefreshJobs()   refresh/repository.ts:231-257
   │        due = source_refresh_policies enabled AND next_run_at<=now AND no queued/retrying/running job
   │        idempotencyKey = `${policy.id}:scheduled:${next_run_at}`   :252
   │     loop: claimNextRefreshJob()  :259-286 (FOR UPDATE, attempt_count+1) → processClaimedRefreshJob   refresh/scheduler.ts:89-272
   │        INSERT refresh_attempts (one per attempt)          :97-102        ← "one attempt receipt per claim"
   │        loadPayload: fixture or safeFetch(allowedHostnames, size/type/timeout, etag)   :52-87
   │        notModified → succeeded, next_run_at += interval   :110-135
   │        runSourceIngestion({ parserProfile: policy.parserProfile, captureMode:'scheduled', … })   :137-157
   │        events source.refresh.started/succeeded/failed, metrics, policy next_run_at = NOW()+interval_minutes   :159-207, :209-271
   └─ triagePendingClaims()                                   :45 → refresh/auto-triage.ts:75-109
         SELECT pending claims on origin='live' listings; triageClaim():
            STOREFRONT_NOISE {batchCode,reportDate,reportIssuer,reportConfirmed} → reject   :31,:52-54
            price: number in [PRICE_MIN=10, PRICE_MAX=500] → APPROVE, else hold    :34-35,:55-59
            availability|shipping → approve                                         :60-62
            anything else → hold                                                    :65
         approve/reject via reviewClaim({ role:"admin", actor:"system:refresh-triage" })   :99
```

Every catalogue listing is enrolled in this pipeline at `PROVENANCE_INTERVAL_MINUTES = 1440` (daily) with `parser_profile='jsonld'` and an allowlist of exactly the listing URL's hostname (`src/server/ingest/live-sources.ts:290-326`). Ceiling: `provenanceListingCeiling` (`schedule-capacity.ts:111-114`) = 96 ticks × 20 jobs / 1 run per listing per day = 1,920 listings/day.

### A.5 Refresh (daily 05:30) and notifications (6-hourly) [V]

- `refresh/route.ts:31-41`: `runIntelligenceSweep("system:cron")` (`intelligence/scanner.ts:31`; emits price-dispersion from current `listings.price`, not history, `:133-158`), `applyRetention(db)` (`db/retention.ts`), `reviewCostSignals(db)`.
- **Cost canary** `src/server/observability/cost-signals.ts`: single metric `catalog-compute`, `DAILY_LIMIT = 200` (`:19-21`); `countCostSignal` increments `cost_signals(day,metric)` (`:24-35`) — called from `catalog/repository.ts:50` inside the uncached catalog compute; `reviewCostSignals` (`:45-67`) → `reportError({severity:"critical"})` when today's count > limit. It counts nothing about collectors, provenance, or price writes.
- `notifications/route.ts:47` → `runNotificationSweep({ maxUsers: 200, budgetMs: 90_000 })` → `notifications/sweep.ts:116-160`: per reader `syncWatchlistNotifications` (`:135`), `runSavedSearchAlerts` (`:139`), `generateMarketChangeSummary` (`:144`). Receipt via `recordCollectorRun(...,"notification-sweep")` on failure (`:108`).

---

## B. Where listing prices are written

`listings` DDL: `src/server/db/schema.ts:69-98` — `price NUMERIC(12,2) NOT NULL` (:73), `previous_price NUMERIC(12,2)` (:74), `last_checked TEXT` (:86), `price_history JSONB NOT NULL DEFAULT '[]'` (:91), `observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` (:95), `updated_at` (:97). [V]

| # | Writer | Called from | `listings.price` | `price_history` | `previous_price` | `observed_at` | Review queue / receipt | `price_observations` |
|---|---|---|---|---|---|---|---|---|
| 1 | `recordCatalogListing` `src/server/ingest/live-sources.ts:328-379` [V] | `recordAllSizes` `ingest/shopify-import.ts:107-145` (`:133-140`) ← `importShopifyCatalog`, `importWooCommerceCatalog` (`woocommerce-import.ts:316`), `importRscCatalog` (`rsc-storefront-import.ts:261`) ← collect tick; also `scripts/ingest-market.mjs` | **overwrites unconditionally** `SET price=$2` (`:366`) | **seed-once**: `CASE WHEN price_history='[]' THEN [price] ELSE price_history END` (`:367`) — never appends | untouched | `observed_at=NOW()` (`:374`), `last_checked='just now'` (`:367`) | **none** — direct write, no claim, no publication event, no domain event. Compensating record = `enrolListingForRefresh` (`:357`, `:292-326`) which creates the daily provenance policy | **never** |
| 2 | `applyApprovedClaim` case `"price"` `src/server/review/repository.ts:126-146` [V] | `reviewClaim` `:315-416` ← `/admin/review` (human), `triagePendingClaims` (`refresh/auto-triage.ts:99`, every 15 min), `approveSaneLiveClaims` (`ingest/bpc157.ts:165-170`, script) | `price=$2` (`:136`) | **push + cap**: `history.push(price)` then `slice(-24)` (`:131-143`) | `previous_price = price` (`:135`) | `observed_at=NOW()` (`:140`) | **yes, one transaction** (`withTransaction` `:322`): `review_decisions` (`:354-358`) → listing update → `publication_events` version+1 with before/after (`:384-396`) → `runPublicationCascade` (`:397-405`) → `evidence_claims.review_status='published'` (`:407-412`) | **never** |
| 3 | `rebuildListingPriceHistory` `src/server/ingest/price-history.ts:34-43` [V] | scripts only: `ingest-market.mjs:233`, `backfill-prices-wayback.mjs:98`, `ingest-wayback-prices.mjs:84`. **No caller in `src/`** | untouched | **replaced wholesale** with `[price…]` from `price_observations ORDER BY observed_day ASC`; no cap | untouched | untouched | none | reads |
| 4 | `seedDatabase` `src/server/db/seed.ts:180-205` [V] | boot when seeding is on (`db/client.ts:44`: `VIALGRADE_SEED_FIXTURES!=='false' && (NODE_ENV!=='production' || flag==='true')`) | demo values | `JSON.stringify(product.priceHistory)` from `src/lib/data.ts` (8 bare numbers, e.g. `:263 [61,59,60,58,58,57,54,54]`) | demo | default | none (demo) | never |
| 5 | `upsertLiveListing` `live-sources.ts:108-133` [V] | writer 1, `provisionRealBpc157` | INSERT `price 0`, `price_history '[]'` (`:123-126`); `ON CONFLICT` touches only `external_url, origin, checkout_mode` (`:127-128`) | — | — | — | none | never |

Not writers of price: `recomputeCompoundStats` (`live-sources.ts:208-231`) writes `compounds.listing_count/median_price/documentation_coverage` only — **not** `price_change`. The `market-data/*` modules (`seed.ts, normalize.ts, benchmarks.ts, quality.ts, graph.ts`) contain no `price_history`/`price_change` reference at all (grep empty) [V].

Complete `price_history` reference set in `src/` (grep) [V]: `app/compounds/[slug]/page.tsx`, `app/products/[slug]/page.tsx`, `components/market/compound-market-table.tsx`, `components/market/compound-ticker-card.tsx` (comment only), `lib/data.ts`, `lib/types.ts`, `server/catalog/repository.ts`, `server/db/schema.ts`, `server/db/seed.ts`, `server/ingest/live-sources.ts`, `server/ingest/price-history.ts`, `server/intelligence/cascade.ts`, `server/review/repository.ts`.

`observed_at` read side: `catalog/repository.ts:20` → `lastChecked: relativeTime(r.observed_at) ?? r.last_checked`, `observedAt` ISO. `getDataFreshness` buckets live listings by `updated_at`, not `observed_at` (`health/data-health.ts:81`).

### B.1 How writers 1 and 2 interact (the flap) [V for mechanism]

1. Collector (6h cadence) writes `price=34.95`; first time only, `price_history=[34.95]`.
2. Daily provenance job fetches the listing's product page (`policy.parser_profile='jsonld'`), `runSourceIngestion` (`agents/pipeline.ts:93-257`):
   - short-circuits on identical content hash (`idempotency_key` includes `contentHash`, `:96-107`) — byte-identical pages produce no new run;
   - `currentValue(target,"price") = Number(listings.price)` (`:45-47`); a candidate becomes a claim only if `!sameValue(previous, candidate)` (`:199-210`);
   - a >30% move is downgraded to `riskLevel:"material"`, confidence ≤0.75 (`:204-207`).
3. `triageClaim("price", P)` approves any `10 ≤ P ≤ 500` **regardless of riskLevel** (`auto-triage.ts:55-58`) → writer 2 pushes P, sets `price=P`, `previous_price=34.95`.
4. Next collector run overwrites `price=34.95`, leaves `price_history=[34.95,P]`.
5. Next day, if the page bytes changed (nonce/token/cart) and the extractor again yields P ≠ 34.95 → a new claim → approved → `[34.95,P,P]`. Repeat.

---

## C. Observation substrate

### C.1 Table — migration 18 `price-observations` (`src/server/db/migrations.ts:5`; DDL `src/server/db/price-observations-schema.ts:8-21`) [V]

```
price_observations(
  id TEXT PK, listing_slug TEXT, vendor_slug TEXT, compound_slug TEXT,
  price NUMERIC(12,2), source TEXT DEFAULT 'live'  -- live | wayback
  observed_day DATE, observed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_slug, observed_day) )
idx_price_obs_listing (listing_slug, observed_day) · idx_price_obs_compound (compound_slug, observed_day)
```
- Slug-keyed, **no FK** to `listings`. Vendor merge repoints `vendor_slug` (`server/vendors/merge.ts:52`). `scripts/delete-demos.mjs:52` deletes rows for demo listings.
- **Never purged**: `db/retention.ts:17-18` states it; `RULES` (`:30-68`) do not include it.
- Introduced in `eb1a722` (2026-07-22, "Real price history from archived catalogs (Wayback) + forward observations"); untouched since.

### C.2 Functions `src/server/ingest/price-history.ts` [V]

| fn | lines | semantics |
|---|---|---|
| `recordPriceObservation(db,{listingSlug,vendorSlug,compoundSlug,price,source='live',observedAt})` | 21-30 | returns silently if `price` non-finite or ≤0; `day = observedAt.toISOString().slice(0,10)` (**UTC calendar day**); `INSERT … ON CONFLICT (listing_slug, observed_day) DO UPDATE SET price, source, observed_at` → **last write for a day wins; no dedupe on unchanged price** (a row per day per listing regardless of change); units = dollars as passed, stored `NUMERIC(12,2)`; no cap |
| `rebuildListingPriceHistory(db, listingSlug)` | 34-43 | `SELECT price … ORDER BY observed_day ASC` → `UPDATE listings SET price_history = $2::jsonb` with `JSON.stringify(series)` (bare numbers, **oldest-first, no timestamps, no cap**); returns count; **no-op when 0 rows** (leaves whatever junk is there) |
| `getCompoundPriceSeries(db, compoundSlug)` | 48-60 | per `observed_day`: median/low/high/n across all listings of the compound. **Dead in `src/`** — only `tests/integration/price-history.test.ts:37` calls it |
| `getListingPriceMeta(db, listingSlug)` | 63-69 | `COUNT(*)`, `MIN(observed_day)` → `{days, since}`; used by `app/products/[slug]/page.tsx:89,268` |

`src/server/ingest/wayback-prices.ts` [V]: `extractArchivedPrice(html)` (`:14-33`) tries OG `product:price:amount`, `itemprop=price`, `"price":`, `"priceAmount":`, `woocommerce-Price-amount`, `product-price|price-item` class; first value in `[5, 2000]` wins, rounded to cents. `parseCdx` (`:38-45`), `snapshotDate(ts)` → noon UTC of the snapshot day (`:48-51`).

### C.3 Callers [V]

- **`src/`: none call `recordPriceObservation` or `rebuildListingPriceHistory`.** (Confirms HANDOFF root cause.)
- `scripts/ingest-market.mjs:227-234`: after the catalogue import, `SELECT slug, vendor, compound, price FROM listings … WHERE origin='live'`, records **today's `listings.price`** as a `'live'` observation with a single `nowTs`, then rebuilds every live listing's `price_history`.
- `scripts/backfill-prices-wayback.mjs:71-98`: per catalogue vendor, CDX snapshots of `/products.json` or `/wp-json/wc/store/v1/products` (~10 spread over time), `extractPrices` = **cheapest price per compound** (`:52-63`), written as `'wayback'` to `listingSlug = ${v.slug}-${compound}` (`:86-87`) — i.e. the canonical cheapest-size slug, whatever size the archived cheapest actually was.
- `scripts/ingest-wayback-prices.mjs:52-84`: per live listing with an `external_url`, closest snapshot to six target dates 2024-01→2026-02 (`:21`), `extractArchivedPrice` → `'wayback'` rows at noon UTC.
- All three: gated `VIALGRADE_LIVE_INGEST_APPROVED=true`; `acquireStoreLock` (file PGlite is single-writer); DB = whatever `getDatabase()` resolves (`db/client.ts:21-38`: `DATABASE_URL` if set, else `.data/pglite`).
- Tests: `tests/integration/price-history.test.ts` (day dedupe, non-positive ignored, compound median).

### C.4 Data shape of `listings.price_history` and the junk pattern

- Shape [V]: JSONB array of **bare numbers**, **oldest-first** by every writer's convention (review push appends the newest; rebuild orders `observed_day ASC`; seed arrays are chronological); no timestamps; read by `jsonArray<number>` (`catalog/repository.ts:20`), `parseJsonArray` (`review/repository.ts:102-105`), and `cascade.ts:117` (accepts array or JSON string).
- Cap disagreement [V]: review path keeps the last 24; rebuild is uncapped.

**How `[34.95, 150, 150]` forms** — extractor mechanism [V], production occurrence [I]:

`src/server/agents/extract.ts` — `findOffer` (`:49-62`) returns `record.offers` whenever it is an object. A JSON-LD `offers` **array** (the shape Shopify/WooCommerce/Yoast emit for multi-variant products) is an object, so the array itself is returned; `Number(offer.price ?? offer.lowPrice)` on an array is `NaN` (`:75`) → no structured price → fallback (`:85-88`) takes the **first `$NNN` in the visible text** (second regex `/\$\s*([0-9]+…)/`). On storefronts the first dollar figure is very often a "Free shipping over $150" banner.

Probe output (`scratchpad/audit/extract-probe.mjs`):
```
offers OBJECT price 34.95, banner $150              → 34.95 (conf 0.98, structured)
offers ARRAY [34.95, 59.95], banner $150, "Price: $34.95" → 34.95 (conf 0.86, text — labeled form matched)
offers ARRAY, no "Price:" label, "$150" first        → 150   (conf 0.86, "A labeled currency amount…")
AggregateOffer lowPrice 34.95 highPrice 150          → 34.95
no JSON-LD, "$150 free ship" then "Price: $34.95"    → 34.95
```
Then §B.1 steps 3-5 push 150 (in band, auto-approved despite `riskLevel:"material"`) while the collector keeps restoring 34.95 — the exact `[34.95,150,150]` shape. `tests/unit/extract.test.ts:8,11` and `agents/golden.ts` only cover `offers` as a single object; no test pins the array case [V].

Other candidate sources considered and excluded [V]: `market-data/seed.ts` etc. write no price history; demo seed values are 8-point arrays of nearby numbers, not `[x,150,150]`; `backfill-prices-wayback` could attach another size's (cheapest) price to the canonical slug [I] — plausible-but-wrong values, not round-number repeats.

---

## D. Derivation chain

- `compounds.price_change NUMERIC(8,2) DEFAULT 0` (`db/schema.ts:43`). **Sole writer**: `recomputeCompound` in `src/server/intelligence/cascade.ts:98-125` [V]:
  - rows = all listings of the compound with `products.status='active'` (`:99-104`) — demo and live alike;
  - per listing `h = price_history`; `move = (h[last]-h[0])/h[0]*100` when `h.length ≥ 2 && h[0] > 0` (`:115-120`);
  - `price_change = median(moves)` to 1 dp, else 0 (`:121`). **No time window; whole array; first→last.**
  - written with `listing_count, median_price, documentation_coverage` (`:122-125`), then `compound.metrics.recalculated` event + metrics (`:126-136`).
- **When**: only inside `runPublicationCascade` (`:176-339`), i.e. when a claim is **approved** for any listing of that compound (any predicate) — via `reviewClaim` (`review/repository.ts:397`). In practice: every 15-min provenance tick's auto-triage approvals, and human approvals. Not on collect, not on a cron of its own. `recomputeCompoundStats` (collect) leaves it alone, so a compound with no approved claims keeps its seeded `lib/data.ts` value (`seed.ts:114-127`) or 0. [V]
- Readers of `price_change` → `Compound.priceChange` (`catalog/repository.ts:17`, `lib/types.ts:29`): `lib/curation.ts:39-46` `trendScore` adds `|priceChange|` (drives the default "trending" sort of the terminal table `compound-market-table.tsx:62` and the trending row in `compounds-experience.tsx`); table sort `"change"` (`:68`) and Δ cell (`:96,:121-126`); compound hero pill (`app/compounds/[slug]/page.tsx:130`). [V]
- Readers of `price_history`: cascade (above) and the render surfaces in §E. `market-data/quality.ts`, `graph.ts`, `benchmarks.ts`: none [V].
- **Alerts** [V wiring]: `cascade.ts:47-49` → `createAlert(category:"price-change", "…moved from $B to $A")` on **every approved price claim** (`:201-212`). Delivery: `consumer-intelligence/service.ts:217-265` `syncWatchlistNotifications` → `getAlertsForListingSlugs` (`intelligence/repository.ts:233-255`) → `decideDelivery` (`notifications/policy.ts:62-69`: `"price-change"` governed by `priceAlerts`, default **true** `:42`) → `upsertUserNotification` + `sendPushToUser` (`:247-261`). Runs every 6 h from the notifications cron (`sweep.ts:135`) and on `/for-you` / `/account/notifications` loads. **A junk approval therefore reaches watchers/followers as "$35 → $150" in-app and by web push.** No separate "price drop" rule exists; the only price notification is this cascade alert.
- **Opportunity signals** [V]: `cascade.ts:319-336` `listing-price-outlier` compares `after.price` (the just-approved value) to the compound median → a junk 150 fires "priced far from everyone else"; `price-dispersion` (`:214-228`, and daily `scanner.ts:133-158`) uses current `listings.price`. `/signals` renders opportunity signals (`app/signals/page.tsx:35`). Nothing reads `price_history` for signals.

---

## E. Render surfaces

| Surface | file:line | What it shows | Field read |
|---|---|---|---|
| `/compounds` terminal table (`compounds-experience.tsx:149`, page `app/compounds/page.tsx:54` passes the full `CatalogSnapshot`) | `components/market/compound-market-table.tsx:86` Δ header; `:96` `delta = c.priceChange ?? 0`; `:121-126` "—" when 0 else `abs%` with ▲/▼ (**delta>0 coloured green, <0 red**); `:68` sort by \|Δ\|; `:62` default "trending" (uses \|Δ\|); `:42-53` sparkline series = **cheapest priced listing's `priceHistory`** per compound, fallback `[medianPrice]` (`:97`); `:130` `<PriceSparkline height=32>` "7-pt" column (`:90` header) | Δ + sparkline | `compounds.price_change`, `listings.price_history` |
| Compound ticker tiles (`/compounds`, `/market`) | `components/market/compound-ticker-card.tsx:14-19` | delta **removed 2026-08-27**; nothing history-derived | — |
| Quick view modal | `components/market/quick-view-modal.tsx:71-73, :142-153` → `price-spread.tsx:20` | "Every listing on one line" = current prices (replaced a sparkline, comment `:5-7`) | `listings.price` |
| `/compounds/[slug]` hero | `app/compounds/[slug]/page.tsx:130` pill `+N%` (green if <0 else red); `:78-81` `averageHistory` = **positional mean across listings' arrays, indexed by `listings[0]`'s length**; `:132` sparkline. Listings from `loadCompoundPublicData` (`:53-60`, `unstable_cache` 6h under `CATALOG_CACHE_TAG`) → `getProductsByCompoundSlug` (`catalog/repository.ts:89` → uncached `queryProducts` `:40`) | Δ + averaged sparkline | `price_change`, `price_history` |
| `/products/[slug]` "Price trend" card | `app/products/[slug]/page.tsx:95-97` `priceChange = (last-first)/first*100` (NaN when history empty, computed before the guard); `:258` rendered only when `priceHistory.length ≥ 2`; `:262-267` % (≤0 green, >0 red), `$start → $end`, sparkline; `:268` "N price checks since <date> — from live catalog fetches and archived catalog snapshots" when `getListingPriceMeta.days ≥ 2` (`:89`) | trend | `price_history`, `price_observations` (meta only) |
| Product card | `components/product-card.tsx:91-95` price; `previousPrice` strikethrough when no `pricePerMg` | previous price | `previous_price` (only the review path sets it) |
| `PriceSparkline` | `components/price-sparkline.tsx:1-31` | a 1-point array renders a flat line + dot; `aria-label "Price history from $a to $b"` | array passed in |
| `/api/v1/catalog` | `app/api/v1/catalog/route.ts:16-23` | full `CatalogSnapshot` (products carry `priceHistory`, compounds `priceChange`; CDN 15 min); `?shape=lite` strips both (`lib/catalog-lite.ts`, `tests/unit/catalog-lite.test.ts:67`) | both |
| `/api/public/v1/catalog` | `app/api/public/v1/catalog/route.ts:8-9` | full snapshot behind API key, `no-store` | both |
| `/api/v1/market-summary` | `app/api/v1/market-summary/route.ts:5-6` | reader change summaries (`market_change_summaries`), not history | — |
| `/signals` | `app/signals/page.tsx:35` | opportunity signals incl. `listing-price-outlier`, `price-dispersion` | current price (via cascade/scanner) |
| `/for-you`, `/account/notifications` | `app/for-you/page.tsx:95` copy "Reviewed price moves … reach your alerts" | `price-change` alerts (§D) | alert_events |
| `/market` page comment | `app/market/page.tsx:19` "price histories for the sparklines" | stale comment — market-experience no longer draws a history sparkline | — |
| `/compare`, `/watchlist`, saved searches, `/vendors/[slug]` | grep | no `priceHistory`/`priceChange` reads | — |

---

## F. Test conventions for this area

- **Runners** (`package.json`): `test:unit` = `vitest run tests/unit --maxWorkers=1 --no-file-parallelism`; `test:integration` = `node scripts/run-isolated-tests.mjs` (one vitest process per file, 90 s timeout + one retry, `:38-91`). Env injected `:20-28`: `VIALGRADE_PGLITE_MEMORY=true`, `VIALGRADE_SEED_FIXTURES=true`, `VIALGRADE_SEED_DEMO_ACCOUNTS=true`, session/privacy secrets; **deletes** `DATABASE_URL`, `POSTGRES_URL`, `DATABASE_POSTGRES_PRISMA_URL`, `PG*`. `vitest.config.ts`: node env, `fileParallelism:false`, 15 s timeouts, alias `@ → src`.
- **DB selection** `src/server/db/client.ts:21-38` `databaseChoice`: `VIALGRADE_PGLITE_MEMORY=true` **and** `DATABASE_URL` set → **throws**; memory → in-memory PGlite; else file `.data/pglite` (never open that locally while anything else has it). `getDatabase` memoised on `globalThis.__vialDbPromise` (`:45`); `initialize` runs migrations under an advisory lock then seeds (`:44`); `resetDatabaseForTests` closes + clears (`:45`).
- **Integration test shape**: set `process.env.*` at module top (e.g. `tests/integration/price-history.test.ts:5-7`), `beforeAll/beforeEach → resetDatabaseForTests(); getDatabase()`, `afterAll → resetDatabaseForTests()`. Trace-style tests instead clear `globalThis.__vialDbPromise` and dynamic-import modules (`publication-loop.test.ts:19-39`, `refresh-cascade.test.ts:23-51`).
- **Source-to-signal trace precedent** (AGENTS.md requires one for refresh/intelligence changes): `tests/integration/refresh-cascade.test.ts:53-99` — `advanceFixture` → `processRefreshJob` → `getPendingClaims` → `reviewClaim(approve)` → asserts `cascade.rootEventId === trigger root`, `getTraceRoots` contains `source.fixture.advanced, source.refresh.started, source.refresh.succeeded, listing.batchCode.published, compound.metrics.recalculated, vendor.metrics.recalculated, alert.generated, opportunity.opened`, then `getAlertsForListingSlugs`, `getOpportunitySignals`, `runIntelligenceSweep`. `:101-129` proves one `refresh_attempts` row per job. `publication-loop.test.ts:41-94`: `runSourceIngestion` idempotent, high-impact gate, approving a price claim changes `getProductBySlug().price` and writes a `publication_events` before/after.
- **Collector tests**: `tests/integration/collection-scheduler.test.ts` (queue/backoff/budget/fair-share; `runCollectionTick({connection, budgetMs, maxTargets})` with synthetic `collection_targets`); `intelligence-collection.test.ts:9-13` mocks `@/server/refresh/safe-fetch` with `vi.mock`; `collectRscCatalog` accepts `fetchImpl`/`fetchProducts` injection (`scheduler.ts:170-180`); `live-ingest.test.ts:106-109` calls `recordCatalogListing` directly; `storefront-coa.test.ts:29-33` builds Shopify product fixtures.
- **Config-reading unit tests**: `cron-routes-reachable.test.ts` (vercel.json ↔ `PUBLIC_API_EXACT` ↔ route file), `schedule-capacity.test.ts` (headroom from vercel.json + known-vendors.json), `provenance-enrolment.test.ts` (triage policy, ceiling), `notification-policy.test.ts`.
- **Migration conventions** [V]: `src/server/db/migrations.ts` is a single minified line; entries are `{version,name,sql}` or `{version,name,run}` (`:5`); `CURRENT_SCHEMA_VERSION = 52` (`:2`); `exec` splits SQL on `;` (`:3-4` → **no semicolons in SQL comments**). Re-registration precedents: `vendorStatusSchemaSql` at 21 and 50, `consumerIntelligenceSchemaSql` at 5 and 51, `externalDataSchemaSql` at 30 and 52. `tests/integration/migrate-from-old-baseline.test.ts:21-38` lists `REQUIRED_COLUMNS`/`REQUIRED_INDEXES` — any column/index added to an already-applied module must be appended there. Repair precedents: `confirmed-claim-repair.ts` (one guarded UPDATE), `duplicate-listing-repair.ts:19-23` (`run` fn, exactly two round trips, decision in memory), `vendor-stats-repair.ts` (set-based, inequality-guarded, idempotent), `grade-refresh-migration.ts:21-35` (**disabled** — per-vendor boot-path queries took production down; kept as a no-op to preserve version 48).
- `scripts/market-data-audit.mjs` (`:1-24`): in-memory PGlite, seeds, asserts tables populated + search MRR/F1 — a template for a data-invariant audit script. `tests/unit/market-data.test.ts`, `tests/integration/market-data-engine.test.ts`, `consumer-intelligence.test.ts` follow the same env pattern.

---

## G. Defects & oddities noticed

1. **Live collect never records observations** [V] — no `src/` caller of `recordPriceObservation`; only the three scripts. HANDOFF root cause confirmed.
2. **Doc/comment drift on the cron** [V]: `docs/HANDOFF.md:96` "daily collect cron (04:30 UTC)" and `collect/scheduler.ts:376-388` sizing prose ("The cron is now daily") are stale; collect has been hourly since `56b95aa`. Consequence: `recomputeAllVendorGrades({budgetMs:45_000, limit:200})` now runs up to 24×/day (`:388`) — sized for once a day.
3. **Two price writers with opposite semantics** [V]: collector overwrites `price` and never appends history; review path pushes history and sets `previous_price`. Together they produce the price flap and `[x,P,P]` histories (§B.1). `previous_price` is only ever set by the review path, so the product-card strikethrough (`product-card.tsx:94-95`) reflects a reviewed-claim value the collector may have since overwritten.
4. **Extractor fallback picks page banners** [V by probe]: JSON-LD `offers` array → `NaN` → first `$NNN` in visible text (`extract.ts:49-62,:75,:85-88`). No test covers the array shape.
5. **Risk level is dead for price** [V]: `pipeline.ts:204-207` marks a >30% move `"material"`, but `triageClaim` approves any price in `[10,500]` without looking at risk (`auto-triage.ts:55-58`).
6. **User-facing consequence** [V wiring / I occurrence]: every approved price claim creates a `price-change` alert (`cascade.ts:49,:202-212`) that the 6-hourly sweep delivers in-app and by push to watchers/followers (`service.ts:229-262`), and a `listing-price-outlier` signal on `/signals` (`cascade.ts:319-336`). A junk 150 → "moved from $35 to $150" push.
7. **Cap disagreement** [V]: review push `slice(-24)` vs uncapped rebuild — after a Wayback rebuild, the next approval silently drops the oldest points.
8. **Compound hero sparkline is positional averaging** [V]: `compounds/[slug]/page.tsx:78-81` averages `priceHistory[i]` across listings indexed by the first listing's length — arrays of different lengths/timelines are averaged by position.
9. **Δ colour semantics inverted** [V]: `compound-market-table.tsx:122` colours a rising Δ green; `products/[slug]/page.tsx:263` and `compounds/[slug]/page.tsx:130` colour a rise red.
10. **`catalogChanged` ignores RSC** [V]: `scheduler.ts:352` sets it only for shopify/woo, so an RSC import never triggers `recomputeCompoundStats`/`rebuildSearchIndex` in that tick.
11. **No last-seen retirement** [V]: a listing the collector stops seeing keeps its last price forever (`retention.ts:19` "updated in place"; upsert-only importers).
12. **Wayback catalogue backfill size ambiguity** [I]: `backfill-prices-wayback.mjs:52-63,:86` writes the cheapest archived price per compound to the canonical `<vendor>-<compound>` slug regardless of size.
13. `getCompoundPriceSeries` is dead in `src/` [V]; `price_observations` has no FK/cleanup tie to `listings` beyond the demo delete script.
14. `getDataFreshness` measures listing freshness by `updated_at` (`data-health.ts:81`), which the collector bumps even when the price is unchanged — it measures "touched", not "observed".
15. Seeded demo compounds/listings share slugs with live ones when seeding is on (`upsertLiveCompound … ON CONFLICT (slug)` `live-sources.ts:253`), so in seeded (non-production) DBs demo 8-point histories feed the cascade median [I — production is unseeded unless `VIALGRADE_SEED_FIXTURES=true`, `client.ts:44`].
16. `runSourceIngestion` idempotency by content hash means a page whose bytes never change never re-proposes — and a page whose bytes always change (nonces) proposes every day [V]; observation cadence is therefore hostage to page noise if the provenance path is used for prices.
17. `/api/v1/catalog` full shape (public, CDN-cached) exports the junk `priceHistory`/`priceChange` as data [V].

---

## H. Open questions the design must answer

1. **Observation time**: fetch time (collector `settle`, `NOW()`) or publish time (review approval `observed_at=NOW()`)? The substrate keys on a UTC `observed_day`; the listing's `observed_at` is a timestamptz. If both writers record, which wins the day? (Recommendation implied by the code comments: the collector's fetch is the observation; the review path should stop being a second source of price history.)
2. **Who is the price authority**: AGENTS.md says every changed observed value enters the review queue, yet the collector writes `listings.price` directly (accepted in `live-sources.ts:273-289` with enrolment as the compensating record). Options: (a) collector records observations and stays the writer; JSON-LD price claims for catalogue-enrolled policies are suppressed (keep availability) — or (b) collector proposes claims and the triage approves in-band, making the review path the only writer. This decides whether §B.1's flap is fixed or merely observed.
3. **Dedupe policy**: one row per listing per day regardless of change (current, ~904×365 ≈ 330k rows/yr) vs change-only rows; and whether the projection into `price_history` should be windowed/downsampled (the table shows "7-pt", the review cap is 24, the rebuild is uncapped).
4. **Projection cost on Neon**: rebuild per listing per tick is ~900 round trips/day (`rebuildListingPriceHistory` is one UPDATE per slug); a set-based single `UPDATE listings … FROM (SELECT listing_slug, jsonb_agg(price ORDER BY observed_day) …)` per tick is one. Which, and how often (every collect tick, or once daily)?
5. **Repair migration semantics**: rebuild `price_history` from `price_observations` for all live listings in a fixed number of round trips; for listings with **no** observations, set `[price]` or `[]`? Should junk arrays be preserved (they already persist in `publication_events.before_json/after_json`)? New version (53) — `sql:` set-based UPDATE or `run:` with two round trips per `duplicate-listing-repair.ts`.
6. **`price_change` definition**: keep median of first→last per listing, or window (30/90 days), minimum days (≥2 distinct observation days), exclude demo listings, and should it also live in the daily refresh cron rather than only on publication?
7. **Minimum evidence to render**: how many distinct days before Δ/sparkline return to tiles, table, hero, product page (`priceHistory.length ≥ 2` today) and what the aria-label says for a single point.
8. **Alert gating**: should `price-change` alerts require a change confirmed by an observation (e.g. two consecutive collector observations or a collector-sourced claim) rather than one approved extractor claim?
9. **Wayback rows**: keep `source='wayback'` visually distinguished (products page copy `:268` already says "archived catalog snapshots"); keep or drop catalogue-endpoint backfill rows written to the wrong size?
10. **Extractor fix scope**: handle `offers[]` / `AggregateOffer.lowPrice` and restrict the text fallback to labeled prices (the labeled regex already exists as the first alternative) — a change to `extract.ts` also moves the golden benchmark (`agents/golden.ts`, `tests/unit/extract.test.ts`).
11. **Where the collect-tick observation write lives**: inside `recordCatalogListing` (one INSERT per listing, ~900/tick-day) or batched per collector run (one multi-row INSERT per vendor) — and whether it must be in the same transaction as the `listings` update.
