# VIAL Market & Compounds Redesign — Design Spec

**Date:** 2026-07-29 · **Status:** approved (self-run under Nate's standing full-autonomy grant) · **Author:** Claude (Fable 5)

## Problem

`/market` renders **~408 listings** as one flat, undifferentiated filterable grid; `/compounds`
renders **~60 compounds** as one flat grid with a single goal filter. Both are 20-second scroll
walls. There is no category structure, no curation, no "trending," no bundles/stacks, no quick-view,
and no carousels. Worse, the pages don't convey **what VIAL is** — a verification layer that keeps a
buyer from getting scammed. A first-time visitor can't tell what to look at, what they need, or why
the business exists. Nate's directive: make these feel like a real marketplace (StockX / GOAT / a
peptide storefront), categorized the right way, that also *shows* what VIAL does.

This is a **presentation/IA redesign**. No backend, schema, ingestion, or trust-logic changes. All
data already exists; we are re-merchandising it.

## What already exists (reuse, don't rebuild)

- **Taxonomy backbone:** `src/lib/compound-education.ts` maps every compound → goal tags
  (`GOAL_TAGS`, 12 keys) and → `stackedWith` (stack partners). This is the category + stack seed.
- **Curation components on the home page** that `/market` and `/compounds` never use:
  `home-goal-rail` (browse-by-goal pills), `home-vendor-carousel` (snap carousel),
  `home/compounds-showcase` (curated tiles), `home/ticker`. The scroll/carousel vocabulary
  (`scroll-fade-x`, `snap-x`, `no-scrollbar`) is established.
- **`price-leaderboard.tsx`** — ranks listings by real $/active-mg with purity + "too cheap?"
  outlier flags. Currently only on compound detail; its logic is the "Best value" engine.
- **`composeVerdict` trust graph** — decomposable, cross-seam verdict (never a black-box score).
  The source of the verifiability/confidence axis.
- **`MarketplaceProvider`** — client context with catalog, watchlist, compare, search.
- **Rich compound detail page** (`/compounds/[slug]`) — leaderboard, lab tests, sparkline, vendors,
  research. The quick-view modal is a *preview of this page*.

## Data available per entity (already on the types)

- **Compound:** category (scientific class), listings, medianPrice, priceChange, coaCount,
  medianPurity, documentationCoverage, accent, origin, + goal tags + stackedWith.
- **Product/listing:** price, pricePerMg, previousPrice, availability, evidenceLevel, trust,
  rating, reviewCount, priceHistory[], lastChecked, origin, externalUrl.
- **Vendor:** coaCount, medianPurity, passportCount, reviewCount, kind (storefront/manufacturer).

## Product roles — resolve the two-page overlap

- **`/market` = the storefront / browse homepage** (StockX/GOAT "shop"). Listing- and offer-centric.
  Curated rows on top, a real faceted filter system over the full listing grid at the bottom,
  quick-view throughout. The primary commerce surface — "where most people get it."
- **`/compounds` = the compound directory** (Bloomberg symbol index). Compound-centric, grouped by
  category, with trending + stacks strips. Each tile → the compound "ticker" detail page.

Both gain: category taxonomy, curated rows, quick-view, no flat wall. They cross-link.

## Categorization axes (Nate named: peptide, storefront, verifiability, confidence)

1. **By goal/category (peptide)** — a research-validated **9-shelf taxonomy** (below), mapped from
   the existing 12 goal tags. Granular goal tags stay on cards; shelves are the top-level browse.
2. **By verifiability / confidence** — a compound/listing **trust tier** derived from existing
   signals in the buyer's real trust order: *independent COA → batch-match → method → lab reputation
   → recency → price/mg*. Three tiers: **Independently tested · Vendor-tested only · No tests on
   record.** Used as a filter facet AND a curated "Independently verified" row. Decomposable label +
   reason, **never a single number** (AGENTS.md).
3. **By vendor / storefront** — a vendor facet in the filter bar + cross-links to vendor pages
   (the existing vendor carousel already covers the "shop by storefront" browse).
4. **By price** — a price-range facet + the "Best value" curated row (leaderboard $/active-mg).

### The 9-shelf taxonomy (research-validated; real vendors use 8-9, not 12)

| Shelf | Folds in goal keys | Example compounds |
|---|---|---|
| Weight & Metabolic (GLP-1s) | metabolic | Retatrutide, Tirzepatide, Semaglutide, Cagrilintide, AOD-9604 |
| Growth Hormone & Performance | gh + muscle | CJC-1295, Ipamorelin, Tesamorelin, MK-677, IGF-1 LR3, Follistatin-344 |
| Healing & Recovery | recovery + gut | BPC-157, TB-500, Thymosin Beta-4, KPV, ARA-290 |
| Longevity & Anti-aging | longevity | Epitalon, MOTS-c, NAD+, Humanin, Glutathione |
| Cognitive & Mood | cognitive + sleep | Semax, Selank, Dihexa, DSIP, Cerebrolysin |
| Skin & Cosmetic | skin | GHK-Cu, Argireline, SNAP-8, Matrixyl |
| Tanning & Libido | tanning + hormonal(sexual) | Melanotan I/II, PT-141 |
| Immune & Thymic | immune | Thymosin Alpha-1, Thymalin, LL-37, VIP |
| Reproductive & Hormonal | hormonal(repro) | Kisspeptin, Gonadorelin, Oxytocin |

Rationale: real vendors fold Muscle→GH, drop standalone Sleep (→Cognitive) and Gut (→Healing), and
don't merchandise more than ~9 shelves. Every compound resolves to exactly one primary shelf via a
goal-key → shelf map; a compound with no goal tag falls to a computed shelf from its scientific
`category` or an "Other" bucket (kept visible, never hidden).

## The Market page — top to bottom

1. **Value band ("What VIAL is").** Lean 3-beat strip, not a wall of copy:
   *Every vendor & price, side by side · Cross-checked against independent lab tests you can verify ·
   We hand you to the vendor — VIAL never sells.* This satisfies "convey what VIAL is" without
   re-adding architecture jargon. Compact, persistent under the hero.
2. **Category rail.** 9 shelf pills (generalized `home-goal-rail`), horizontal scroll; each filters
   the browse grid below (client) and is a real entry point.
3. **Trending now.** Carousel of compound ticker-tiles ranked by a composite momentum score:
   listing coverage + lab activity + |priceChange| + a curated Tier-1 boost (Retatrutide,
   Tirzepatide, BPC-157, TB-500, Semaglutide). Neutral label "Most looked-up," never "best."
4. **Independently verified.** Carousel of compounds with the strongest independent evidence
   (blind/batch-matched COAs, highest median purity). This row *is* VIAL's pitch, merchandised.
5. **Best value right now.** Cheapest legit listings by real $/active-mg (market-wide extract of the
   leaderboard logic), "too cheap?" outliers flagged in amber — shown, not hidden.
6. **Stacks & blends.** Curated bundle cards. **Blend** = a single-vial pre-mix SKU where a real
   listing exists (e.g. GLOW); **Stack** = a recipe linking to each component compound's listings
   (e.g. Wolverine = BPC-157 + TB-500). Distinct badge for blend vs recipe. Curated set below.
7. **New / recently added.** Freshly ingested Live listings (surfaces moat A — the growing history).
8. **Browse everything.** The full listing grid with the **faceted filter system** — category,
   trust tier, tested-only toggle, price range, availability, vendor, sort. Absorbs today's
   `market-client` as one section (not the whole page). Result count + reset. Category-rail clicks
   and quick-view live here too.

### Curated stacks (mapped to VIAL compound slugs; only render components that exist as listings)

| Name | Kind | Components | Neutral goal label |
|---|---|---|---|
| Wolverine | recipe | bpc-157, tb-500 | Discussed for tissue recovery |
| GLOW | blend/recipe | ghk-cu, bpc-157, tb-500 | Discussed for skin + recovery |
| KLOW | recipe | ghk-cu, kpv, bpc-157, tb-500 | GLOW + anti-inflammatory |
| GH Stack | recipe | cjc-1295, ipamorelin | Discussed for GH axis |
| Visceral Fat | recipe | tesamorelin, ipamorelin | Discussed for abdominal fat research |
| CagriSema | recipe | cagrilintide, semaglutide | Discussed for satiety research |
| Reta + Cagri | recipe | retatrutide, cagrilintide | Multi-pathway metabolic research |
| Skin Repair | recipe | ghk-cu, bpc-157 | Discussed for skin/collagen |
| Metabolic + Mito | recipe | semaglutide, mots-c | Metabolic + mitochondrial research |
| Cognitive Duo | recipe | semax, selank | Discussed for focus/calm research |

Stacks are labeled **"commonly discussed research combinations,"** never protocols or dosing.

## Tile principles (from StockX/GOAT/CMC study)

- **One labeled canonical number per tile**, never a bare price: `from $X` (market low), and where the
  row is about value, `$Y/active mg`. A labeled price is a market claim; a bare price is noise.
- **Show the row's ranking metric on its own tiles** (StockX "most-popular" shows units sold): the
  *Trending* row's tiles show the momentum signal (listings + Δ), *Independently verified* shows COA
  count + median purity, *Best value* shows $/active-mg. A ranked row without its metric is an
  assertion; with it, it's evidence.
- **Deltas attach to facts, not offers**: price-change Δ (▲/▼ %) renders on the compound's observed
  market move (a fact), green/red + arrow, tabular-nums.
- **Tiles signal, don't explain** — minimal copy; the quick-view/detail carries the prose.
- **Watchability on every tile**: a save/follow affordance (the retention loop is the watchlist).

## Density ladder

tile (one labeled number + row metric) → **quick-view** (stat block) → **full ticker page**
(leaderboard, lab tests, history). Nobody gets all data at once; nobody hits a dead end.

## Quick-view modal (VIAL enhancement, grounded in CMC row→detail)

Neither StockX nor GOAT uses a browse-level quick-view; Nate explicitly asked for one ("a modal pops
up; scrollable across like a carousel"), so this is a deliberate step beyond them. Click a compound
ticker-tile → a focus-trapped modal opens over the browse page with a **compound snapshot**: price
range, cheapest-legit + best-value $/active-mg, tested purity, the composed trust verdict
(decomposable, not scored), top 3 vendors, mini sparkline, goal tags, Demo/Live badge, save/follow.
Footer CTA "Open full ticker →" → `/compounds/[slug]`. **Carousel:** ← / → keys and on-screen arrows
move to prev/next tile in that row without closing (the "scroll across a carousel" Nate asked for).
Esc closes; reduced-motion respected; `hard-lg` modal variant. In "Browse everything," a listing
tile's quick-view previews the *listing* (vendor, price, $/mg, evidence, Buy-at-vendor via `/go`).

## The Compounds page redesign (the "terminal" cousin)

- Thin hero + stats (kept).
- **Trending compounds** strip (same momentum ranking).
- **View toggle: Terminal ⇄ Shelves.** This is the strongest expression of VIAL's Bloomberg-terminal
  identity and the CoinMarketCap ranked-table pattern:
  - **Terminal (default on desktop):** a dense, sortable ranked **market table** — rank #, compound
    (name + shelf), vendors (listings), price range `from $X`, price-change Δ (▲/▼ %), median tested
    purity, lab tests (COA count), trust tier, and a **7-point sparkline** column. Sort by trending /
    price / purity / tests / Δ. Scrolls horizontally on mobile rather than dropping evidence columns.
    Row click → compound ticker page; row hover → quick-view affordance.
  - **Shelves:** the 9 categories as titled rows/grids of compound tiles (grouped, not a 60-long
    wall). The `?goal=` filter still works and now scopes to a shelf.
- **Popular stacks** strip (cross-links to the market stacks).
- Quick-view on tiles and table rows (shared component).

## New units (each: one purpose, typed interface, testable in isolation)

**Pure/data (no server deps):**
- `lib/market-taxonomy.ts` — the 9 shelves, goal-key→shelf map, `shelfForCompound(compound)`,
  `groupByShelf(compounds)`. Pure.
- `lib/stacks.ts` — the curated stacks as data (name, kind, blurb, neutral goal, component slugs,
  accent). Pure. `resolveStack(stack, catalog)` returns only components that exist + a combined
  price range.
- `lib/curation.ts` — pure functions over `CatalogSnapshot`: `trending()`, `bestValue()`,
  `mostVerified()`, `newest()`, `compoundTrustTier(compound) → {tier, reasons[]}`. Deterministic —
  uses existing `lastChecked`/`reportDate`/`priceChange` fields, no `Date.now()` (keeps tests +
  the workflow-resume constraint honest).

**UI (`components/market/`):**
- `vial-value-band.tsx` — the 3-beat "what VIAL is" strip.
- `category-rail.tsx` — 9-shelf pill rail (server-rendered, links + client filter hook).
- `compound-ticker-card.tsx` — scannable tile: name, shelf, labeled `from $X`, price-change delta
  (▲/▼ %), tested-purity chip, listings count, trust-tier chip, Demo/Live badge, save/follow. Opens
  quick-view. Accepts an optional `metric` prop so a row can surface its own ranking number.
- `compound-market-table.tsx` — the terminal ranked table (CMC pattern) for `/compounds`; sortable
  columns, sparkline column, horizontal scroll on mobile; client (sort state) over server data.
- `collection-row.tsx` — titled horizontal snap-carousel wrapper hosting any tiles + "See all →".
- `stack-card.tsx` — bundle tile (mini-vials, combined price range, neutral goal, blend/recipe badge).
- `trust-tier-chip.tsx` — Independently tested / Vendor-tested / No tests (ink-1 tints + label).
- `quick-view-modal.tsx` — client modal + prev/next carousel + focus trap + keyboard nav.
- `market-filter-bar.tsx` — faceted filters (client): category, trust tier, tested-only, price
  range, availability, vendor, sort.
- `market-browser.tsx` — refactor of `market-client` into the "Browse everything" section consuming
  the filter bar + quick-view; adds the trust-tier / category / price-range facets.

**Pages:**
- `app/market/page.tsx` → server component computing curations (cached) + composing rows; grid,
  filters, quick-view are client under the existing `MarketplaceProvider`.
- `app/compounds/page.tsx` → categorized sections + trending + stacks strips + quick-view.

The current `market-client.tsx` (one dense 9-line component) is refactored into `market-browser` +
`market-filter-bar`; this is targeted improvement of a file in scope, not unrelated churn.

## Design-system fidelity (hard system)

`ink`/`ink-1` borders, `hard`/`hard-sm` offset shadows, flat fills, extrabold type, tabular-nums for
prices. Market section signature stays **teal** (`#12b3a6`/`#0e8f80`) with royal-blue accents.
Evidence/trust tints per `DESIGN_SYSTEM.md`; **color never means "safe."** Quick-view uses the
existing `hard-lg` modal variant. Carousels scroll (`scroll-fade-x`/`snap-x`); tables scroll-x;
core content readable at 320px; touch targets ≥40px; reduced-motion disables non-essential motion.

## Honesty / guardrails (AGENTS.md — non-negotiable)

- Trust tier = decomposable label + reasons, never a single score.
- "Too cheap?" and "no batch match / vendor-tested only" surface as visible flags, not hidden.
- Demo vs Live badge on every tile.
- Curation labels stay **neutral and descriptive** — "most looked-up," "most independent evidence,"
  "commonly discussed" — never "best," "recommended," "safe," or a buy/use recommendation.
- Stacks are research combinations, not protocols/dosing.
- No new checkout; Buy-at-vendor keeps the existing `/go` server-resolved handoff; demo listings
  stay inert.
- Unknown evidence stays visible.

## Testing / verification

- `npm run lint` · `npm run test:all` · `npm run build` · `npm run test:e2e` · `npm audit`.
- Unit tests for the pure modules: `market-taxonomy` (every seeded compound resolves to a shelf),
  `stacks` (each stack resolves ≥1 real component; blend/recipe correct), `curation`
  (trending/bestValue/mostVerified deterministic; trust tier reasons correct).
- e2e: `/market` renders curated rows + filter bar; category filter narrows the grid; quick-view
  opens, ←/→ navigates, Esc closes; a stack card links to a real component listing.
- Desktop + mobile Playwright screenshots of `/market`, `/compounds`, and the open quick-view.

## Out of scope

Backend/schema/ingestion, real affiliate deals, new checkout, the vendor and passport pages
(unchanged beyond cross-links), monetization, deploy.
