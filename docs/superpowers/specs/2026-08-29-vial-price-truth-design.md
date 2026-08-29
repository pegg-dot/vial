# VialGrade Price Truth — Design Spec

**Date:** 2026-08-29 · **Status:** approved (self-run under Nate's standing full-autonomy grant; his
directive this session: "continue to build what we should… don't half-ass… use tools, loops, agents,
research") · **Author:** Claude (Fable 5) · **Inputs:** five parallel read-only audits (pipeline map,
prod data dump, SOTA research, ops health, evidence-coverage assessment) saved in the session
scratchpad; every code claim below was re-verified by reading the cited lines.

## 1. Problem — the site renders falsehoods about price

Measured on production (`/api/v1/catalog`, 904 live listings, 2026-08-29 17:10Z):

- **75 umbrella-labs listings show `$100` right now.** The vendor's own page for the same product
  carries JSON-LD `"price": "79.99"`; the only "$100" on that page is the promo banner
  *"ORDERS $100 OR MORE AND GET 10% OFF!"*. The listing renders "$100 · Checked 9 hours ago" and
  feeds fake `price-drop` / `too-cheap` flags.
- **151 of the 221 multi-point `price_history` arrays are banner values** — `[19.95,150,150,150,150]`
  on nootropic-source ("free shipping over $150"), `[real, 100,100,100,100]` on umbrella-labs.
  Zero listings have ≥3 distinct values. 26 listings' current price differs from their single
  history point — real moves were dropped.
- **13 compounds publish a `priceChange` ≥ 100 %** (GHRP-2 +525 %, PT-141 +200 %, oxytocin +186 %…)
  — the median of those junk arrays. It drives the default "trending" sort of `/compounds`, the Δ
  column, the compound hero pill, and `/products/[slug]` "Price trend +651.9 % $20 → $150".
- **Watchers were pushed the junk.** Every approved price claim emits a `price-change` alert that the
  6-hourly sweep delivers in-app and by web push ("moved from $35 to $150").
- **28 % of the catalogue (250 listings) has not been observed in 8–24 days**, 232 of them shown
  "In stock". The `/status` "Degraded" banner is the refresh queue *stuck*, not slow.

The evidence-coverage audit confirmed evidence surfaces render unknowns *as* unknowns; only price
surfaces render falsehoods as facts. A rendered falsehood outranks a rendered unknown, so this arc
is the right next build.

## 2. Mechanism (verified)

```
collect tick (hourly, 8 targets)            provenance tick (every 15 min)
  Shopify/Woo/RSC structured feed              product PAGE fetch, parser_profile 'jsonld'
  recordCatalogListing  live-sources.ts:364     extractClaimCandidates  agents/extract.ts
    price := feed price (true)                    findOffer :49-56 returns `offers` even when it is an ARRAY
    price_history seeded ONCE, never appended      Number(array.price) = NaN  :75
    no observation row, no receipt                 → text fallback :85-88, bare /\$\s*NNN/ → first "$" on page = banner
                                                 pipeline.ts:204-207 marks >30 % move "material"
                                               triageClaim  auto-triage.ts:55-59 approves ANY price in [10,500], ignores risk
                                               applyApprovedClaim  review/repository.ts:126-146
                                                 price := banner, price_history.push(banner), previous_price := true price
                                                 + publication receipt + runPublicationCascade
                                                   → compounds.price_change = median((last-first)/first)  cascade.ts:115-125
                                                   → alert 'price-change' → push to watchers   cascade.ts:202-212
                                                   → signal 'listing-price-outlier'            cascade.ts:319-336
  next collect restores the true price, leaves history [true, banner, banner, …]
```

Two writers with opposite semantics; the lossy one (page scrape) is the only one that appends
history and the only one that triggers alerts. `recordPriceObservation` (`ingest/price-history.ts`)
has no caller in `src/`; `price_observations` (migration 18) is filled only by hand-run scripts.

## 3. Decisions (made under the autonomy grant)

- **D1 — Price authority.** For a listing whose vendor has a structured catalogue collector, the
  collector's feed is the price authority. A page-scrape price claim is *rejected with a receipt*
  ("superseded by the vendor's structured catalogue feed, read successfully at <ts>") while that
  feed is fresh (successful run ≤ 48 h). When the feed is stale or failing, scrape claims are
  triaged normally — the scrape becomes the fallback exactly when the feed is broken.
- **D2 — Material moves are never auto-approved.** A >30 % price move from a page scrape holds
  for a human (`risk_level = 'material'` finally means something).
- **D3 — No bare-number fallback.** The extractor takes a price from JSON-LD only when the offers
  resolve to ONE distinct price (multi-variant pages are ambiguous → no price claim), or from
  *labeled* visible text ("price: $X", "sale price $X" preferred over "regular price"), never from a
  bare "$NNN", and never from promotional context ("orders over", "free shipping", "or more"…).
  A wrong price is worse than no price.
- **D4 — Observations are the substrate.** Append-only, one row per listing per UTC day, last check
  of the day wins, written in ONE statement at the end of each collect tick (never per row).
  Unavailable is stored as a state (`available=false`), never a carried-forward price.
- **D5 — Reset repair, not reconstruction.** Migration v53 discards the undated `price_history`
  arrays and `previous_price` on live listings, zeroes `compounds.price_change`, keeps every
  `source='wayback'` row (real capture dates), and seeds one real observation per live listing from
  its current price. Nothing is synthesised from `created_at`.
- **D6 — A change is shown only when earned.** 30-day change needs a baseline within 7 days before
  the window, a latest point ≤ 2 days old, ≥ 14 days of span, ≥ 2 distinct days. Compound Δ is the
  median over listings that qualify, only when ≥ 3 qualify, always printing "k of n listings".
  Otherwise: "checked N times since <date> — no trend yet". No buy language anywhere.
- **D7 — Alerts come from confirmed changes.** `price-change` alerts and `listing-price-outlier`
  signals fire only from collector-confirmed price changes (Phase 3); until then, no new price
  alerts. Existing junk alert rows are marked superseded so `/for-you` stops showing them.

Owner decisions that do **not** block (recommendation in brackets): whether to message watchers
who received junk pushes [no — mark superseded, don't re-notify]; whether to name failing collectors
on the public `/status` [no — `/admin` only]; the external alert webhook [still declined].

## 4. Phases

### Phase 0 — Stop false prices entering (P0)

Files: `src/server/agents/extract.ts`, `src/server/refresh/auto-triage.ts`, `tests/unit/extract.test.ts`,
`tests/unit/provenance-enrolment.test.ts`, new `tests/integration/price-authority.test.ts`.

- `extract.ts`: `findOffers()` returns every offer object (array, single, AggregateOffer). Price claim
  only when the distinct candidate prices (`price`, `lowPrice` when `lowPrice == highPrice`,
  `priceSpecification.price`) collapse to exactly one. Availability from offers only when all agree.
  Text fallback: labeled forms only, sale-price first, promo-context exclusion, bare `$NNN` removed.
- `auto-triage.ts`: `triageClaim(predicate, value, context)` with `context = { riskLevel, confidence,
  structuredFeedFreshAt }`. Price: not a number → hold; outside [10,500] → hold; feed fresh → reject
  (superseded); material → hold; else approve. `triagePendingClaims` joins the listing's vendor to
  `collection_targets` (`collector IN ('catalog-shopify','catalog-woo','catalog-rsc') AND target =
  vendor slug`) for `last_ok`/`last_run_at`.
- Tests: extractor cases with positive controls (labeled price after a banner still extracts; the
  same page without the label yields no price); triage matrix; integration source-to-signal trace in
  both polarities — banner page → no claim, listing price unchanged, no alert, no outlier; labeled
  "Price: $150" page → claim created → rejected as superseded while the feed is fresh, held as
  material when the feed is stale, approved when non-material and the feed is stale. Each guard is
  mutated once to prove the test can fail.
- Prod effect: junk stops entering on the next provenance tick; the hourly collector restores the
  true umbrella-labs prices within one cadence. History/Δ remain junk until Phase 2.

### Phase 1 — Stop serving a stale catalogue (P1, ops)

Files: `src/server/refresh/scheduler.ts`, `src/server/collect/scheduler.ts`, `src/server/ingest/shopify-import.ts`,
`src/server/verify/vendor-status.ts`, `src/app/admin/page.tsx`, `src/server/notifications/sweep.ts`.

1. Reclaim orphaned jobs: at the top of `runRefreshSweep`, `UPDATE refresh_jobs SET status='retrying'
   WHERE status='running' AND started_at < NOW() - INTERVAL '10 minutes'` (10 min ≫ the 120 s
   function ceiling). Proof: `refresh.stalled` → 0; `/status` leaves the refresh rung.
2. A catalogue run that imports zero products is a failure: `ok = productsSeen > 0` with an error
   string, so it backs off, counts as failing, and disables after 12 — and `/status` "failing" rises
   the tick after deploy (a guard that cannot fail is not a guard).
3. `syncCollectionTargets` re-enables a disabled target weekly and deletes zombie rows whose id is
   not in this tick's set.
4. After a *complete* successful catalogue import, listings of that vendor not seen in the run are
   marked `Unavailable` in the same transaction (one statement). A budget-cut partial import must
   not retire anything — the importer reports completeness.
5. `probeVendorStatus`: extend `PARKED` with the closure family (`permanently closed`, `ceased
   operations/trading`, `no longer in business`, parking-frame hosts) and emit `closed`.
6. `/admin`: per-target table of disabled/failing collectors (slug, error, failures, last run, next
   due) plus `getBrokenCollectors()`. `SWEEP_STALE_HOURS` 48 → 13.
7. HANDOFF: close the "catalog coverage gap" item — science.bio is permanently closed, certifiedpep
   is a parking page; promoting them would publish Live prices from a defunct domain.

### Phase 2 — Make price history real and honest (P1, product)

Files: `src/server/db/price-observations-schema.ts` (new module registered at v53 — never edit v18),
`src/server/db/migrations.ts`, `src/server/ingest/price-history.ts`, `src/server/collect/scheduler.ts`,
`src/server/intelligence/cascade.ts`, `src/server/catalog/repository.ts`, `src/lib/types.ts`,
`src/components/price-sparkline.tsx`, `src/components/market/compound-market-table.tsx`,
`src/app/compounds/[slug]/page.tsx`, `src/app/products/[slug]/page.tsx`, `src/lib/catalog-lite.ts`,
`tests/integration/migrate-from-old-baseline.test.ts`, `tests/integration/price-history.test.ts`.

- **Schema v53** (`priceObservationsV2SchemaSql`, additive, idempotent): `currency TEXT NOT NULL
  DEFAULT 'USD'`, `available BOOLEAN NOT NULL DEFAULT TRUE`, `price` nullable with
  `CHECK (price IS NOT NULL OR available = FALSE)`, `CHECK (price IS NULL OR price > 0)`, covering
  index `(compound_slug, observed_day) INCLUDE (listing_slug, price, available)`. Deterministic ids
  `priceobs:<slug>:<YYYYMMDD>`. Columns/indexes appended to `migrate-from-old-baseline.test.ts`.
- **Repair (same v53, `run:` function, fixed round trips):** (1) one `INSERT … SELECT` seeding
  today's observation from every live listing's current price/availability; (2) one `UPDATE listings
  SET price_history='[]', previous_price=NULL WHERE origin='live'`; (3) one `UPDATE compounds SET
  price_change=0`. Tested against a copy of a real store shape before deploy.
- **Write path:** one statement at the end of `runCollectionTick` (after imports, before stats)
  inserting an observation for every live listing with `observed_at >= tick start`, `ON CONFLICT
  (listing_slug, observed_day) DO UPDATE`. `recordPriceObservation` stays for scripts.
- **Projection (read side, no `price_history` writes):** `getListingPriceSeries(slugs)` — one query,
  LAG-deduped dated points (last 24 change points + latest), `available` carried;
  `getCompoundPriceChanges()` — one query for all compounds implementing D6 (matched-listing 30-day
  deltas, `percentile_cont`, `FILTER (WHERE available AND price IS NOT NULL)`), written to
  `compounds.price_change` + a new `price_change_basis JSONB {k, n, window, asOf}` in the collect
  tick. `cascade.ts` stops computing `price_change` from arrays.
- **Types/API:** `Product.priceHistory` becomes dated points `{day, price, available}[]`
  (`pricePoints`), `priceHistory: number[]` kept in the public catalog shape as the price-only
  projection for compatibility; `Compound.priceChange` gains `priceChangeBasis`. `catalog-lite`
  strips both as today.
- **Surfaces** (`DESIGN_SYSTEM.md` rules: tabular numerals, one black number, restrained motion):
  - `PriceSparkline` → step line on dated points, hollow segment when unavailable, gaps for
    unchecked days, `role="img"` with the same sentence as the visible copy, `<details>` data table,
    no draw-in under `prefers-reduced-motion`.
  - `/products/[slug]` "Price trend" → one component `PriceTrend` rendering exactly one of the D6
    states with the copy in §5; "N checks since <date> — live catalogue reads, archived snapshots".
  - `/compounds/[slug]` hero → dated daily median series with `n` (replaces positional averaging);
    pill only when basis.k ≥ 3, with "k of n listings".
  - `/compounds` terminal table → Δ + sparkline from the same basis; "—" with a title explaining
    why when not earned; **one colour rule everywhere**: price direction is not good/bad in an
    evidence product, so a rise and a fall are both set in ink, tabular — the arrow carries the
    direction, colour does not (today the table colours a rise green and the product page red).
  - Trending sort → uses `|Δ|` only when earned; otherwise listing-count/COA signals as today.
- **Alerts:** cascade's `price-change` alert and `listing-price-outlier` are gated on
  `source === 'catalogue'` claims (Phase 3 wiring); until then scrape claims no longer publish so no
  new price alerts are created. v53 repair marks existing `price-change` alert rows and
  `listing-price-outlier` signals created before the deploy as `superseded` (one statement each).

### Phase 3 — Collector price changes go through the claim path (P2, architecture)

`recordCatalogListing` stops overwriting `price` for an existing listing whose price changed;
instead it proposes a claim (`source_snapshot` = the feed capture, `extractor_version =
'catalogue-feed'`, confidence 0.99, `risk_level` material when >30 %) and the collect tick triages it
in-band: structured-source claims approve unless the move is >5× or a vendor-wide identical-price
run (>50 % of a vendor's listings landing on one new price in a single run — the umbrella-labs
signature) is detected, in which case the run holds and an ops alert fires. Publication then flows
through the existing receipt + cascade, restoring AGENTS.md ("every changed observed value enters the
review queue; every approved mutation creates a publication receipt in the same transaction") and
re-enabling truthful `price-change` alerts. First import of a new listing still sets the initial
price directly (creation, not a change).

### Phase 4 — Docs and drift

`docs/HANDOFF.md` (hourly collect cron, 904 listings / 83 vendors, grade sweep now hourly and sized
for it, price-authority rule, coverage-gap item closed, this spec linked), `docs/DESIGN_SYSTEM.md`
(price-trend states), stale comments (`collect/scheduler.ts:376-388`, `app/market/page.tsx:19`).
Separate follow-up (from the evidence audit): cron the Janoshik discover/verify scripts — no COA
has been added since 2026-07-22.

## 5. Copy (Phase 2), no buy language

- No history: "Price checked once, on {date}. No trend yet — a change needs checks on at least two
  different days."
- Insufficient: "{n} checks since {first}. Too short a span for a 30-day change. Latest ${p} on {date}."
- Trending: "−8.2 % over 30 days · {n} checks · ${base} on {baseDate} → ${latest} on {latestDate}.
  Vendor list price before shipping or discounts. Observed, not projected."
- Unavailable at last check: "Not available when last checked ({date}). Last observed price ${x} on {date}."
- Stale (> 3 days): append "Last checked {d} days ago."
- Compound: "Median of {k} listings' 30-day changes; {n−k} excluded for insufficient history." /
  "Not enough listings with 30 days of checks to summarise a change."

## 6. Verification

Per phase: `npm run lint && npm run typecheck && npm run test:all && npm run build && npm run test:e2e
&& npm audit` (AGENTS.md gate), every new guard mutated once, desktop + mobile screenshots of every
touched surface, then push → `/api/health/live` build matches HEAD → `npm run verify:live` → the
phase-specific prod proof (P0: umbrella-labs prices return to vendor values within one cadence and
no new price claim is approved from a scrape; P1: `observedAt ≥ 7d` count trends to ~0, `/status`
leaves the refresh rung; P2: zero compounds with a Δ lacking a basis, every product page renders one
of the five states; P3: a real feed price change produces exactly one receipt, one alert).

## 7. Out of scope

Native checkout, dosage, or any buy nudge (AGENTS.md); Timescale/partitioning (~40 MB/yr);
price-drop *recommendations*; retroactive messages to watchers; the Janoshik cron (own arc).
