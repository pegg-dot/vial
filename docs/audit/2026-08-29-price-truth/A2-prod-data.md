# A2 — VialGrade production data: price history + freshness (public endpoints only)

Run: 2026-08-29 17:17–17:20Z · 21 HTTPS requests (19 to vialgrade.com, 2 to vendor pages for validation) · read-only.
Raw responses + `analyze.py` (every number below is printed by it): `A2-raw/` next to this file. `analyze-output.txt` is its last run.
Catalog snapshot `generatedAt` = 2026-08-29T17:10:25.962Z; build `b062199e2d20`, release 10.0.0, schema 52/52.

## A. Endpoints used + shapes

| Endpoint | Auth | Status | Size | Shape |
|---|---|---|---|---|
| `GET /api/v1/catalog` | public | 200 | 1.25 MB | `{data:{compounds[60],vendors[83],products[904],generatedAt}, meta:{source:"published-catalog-projection",shape:"full",commerceEnabled:false}}`. **One shot, no pagination, no filters** (route reads `getCatalogSnapshot()` whole). Response header `cache-control: public` (route sets `s-maxage=900, swr=3600`; Vercel strips s-maxage), `x-vercel-cache: MISS`. |
| `GET /api/v1/catalog?shape=lite` | public | 200 | 243 KB | products carry only `slug,name,quantity,vendorSlug,price,evidenceLabel,accent,featured,origin` — no history/timestamps. |
| `GET /api/v1/health` | public | 200 | | `{status:"ok",database:"reachable",workflow:{pendingClaims:1,activeRuns:1},time}` |
| `GET /api/health/live` | public | 200 | | `{status:"ok",service:"vialgrade",release:"10.0.0",build:"b062199e2d20",time}` |
| `GET /api/health/ready` | public | 200 | | `{status:"ready",database:"reachable",schema:{expected:52,actual:52},latencyMs:2,time}` |
| `GET /api/v1/market-summary` | **session-gated** (customer/seller) | **401** | | `{"error":"Authentication required"}` — NOT a public compounds surface (it is the per-user "market change summary" feed). Compound numbers below come from `catalog.compounds[]`. |
| `POST /api/v1/compare {slugs}` | public | 200 | 2.2 KB | `{entries:[{slug,name,quantity,vendorName,vendorSlug,imageUrl,price,cells:{price,perMg,vsMedian,tests,purity,evidence,verdict,trustpilot,reviews,track,realPerMg,tooCheap,blind,enforcement,batchMatch,vendorPrice}}]}` — no history, no timestamp. |
| `GET /status` ×2 (34 s apart) | public | 200 | 324 KB | server-rendered (`force-dynamic`) |
| `GET /sitemap.xml` | public | 200 | 201 KB | 1,228 `<loc>` |
| `GET /stacks`, `/stacks/wolverine` | public | 200 | | |
| `GET /products/<slug>` ×6 | public | 200 | ~480 KB | `cache-control: private, no-cache, no-store`; **no `Last-Modified`/`ETag`**; freshness only in body ("Observed price … Checked N hours ago"). |
| `GET /compounds/ghrp-2` | public | 200 | | renders `+525.3%` (see E). |
| vendor pages (2, validation) | external | 200 | | umbrellalabs.is, nootropicsource.com |

Per-listing fields available on the full catalog (904/904 unless noted): `price`, `currency` (all USD), `quantity` (string), `mg` + `pricePerMg` (665/904 = 73.6% parse), `availability` (`In stock` 719 / `Unavailable` 185), `priceHistory: number[]` (bare numbers, **no timestamps**), `previousPrice` (221/904), `observedAt` (ISO, 904/904), `lastChecked` (relative string derived from observedAt), `reportDate` (empty on all 904), `vendorSlug`, `compoundSlug`, `evidenceLevel` (all `public-only`), `trust{status,priceFlag,adjustedPricePerMg,…}`, `origin`, `externalUrl`, `imageUrl`. Vendor: `lastObserved` (string date), `latestTestedAt`, `productCount`, `coaCount`, `grade`. Compound: `priceChange`, `listings`, `medianPrice`, `medianPricePerMg`, `coaCount`, `medianPurity`.

## B. Catalog totals + origin split

- **904 listings, 83 vendors, 60 compounds. Origin: 904/83/60 `live`; demo = 0 / 0 / 0.** (No P0 on origin.)
- Only **16 of 83 vendors have any listing**; 67 vendors have `productCount: 0` (56 are `kind: manufacturer`, so most are reference entities, not storefronts). Listings per vendor: purerawz 154, umbrella-labs 113, ascend-bio-labs 86, swiss-chems 74, modern-aminos 60, chameleon-peptides 60, simple-peptide 55, bluum-peptides 54, nootropic-source 48, behemoth-labz 48, ez-peptides 34, peptide-pros 34, cernum-biosciences 28, felix-chemical-supply 23, sports-technology-labs 23, vici-peptides 10.
- Sum `vendor.productCount` = 904 = sum `compound.listings` = products[] (consistent). Sum `vendor.coaCount` = 265; sum `compound.coaCount` = 202 (both "independent only", different join).
- Trust status: no-claim 696, verified 92, unbacked 76, batch-verified 39, low-purity 1. priceFlag: too-cheap 53, price-drop 14. `price <= 0`: 0.
- Vendor grade letters: 62 ungraded (null), A 4, A- 1, B+ 1, B 1, C+ 4, C 1, C- 9.

## C. price_history characterization (904 live listings)

**Length distribution:** 1 → **683 (75.6%)**; 2 → 8; 3 → 2; 4+ → **211** (exact: 4→25, 5→163, 6→23). Empty: 0.
**≥2 distinct values: 217. ≥3 distinct values: 0** — no listing anywhere has three different prices in its history.
`history[0] == price`: 793. `history[-1] == price`: 738. `previousPrice` present on exactly the 221 multi-point listings.
History elements: 1,059 ints + 699 floats; **bare numbers, no timestamps** (`priceHistory: number[]`; the only timestamp is the scalar `observedAt`).

Write paths (code, read-only): the cron collect path (`src/server/ingest/live-sources.ts:367`) does `SET price=$2 … price_history = CASE WHEN price_history='[]' THEN [price] ELSE price_history END` — it **updates the price in place and never appends**. Multi-point histories are produced only by `rebuildListingPriceHistory()` (chronological projection of `price_observations`), whose callers are all one-off scripts: `scripts/ingest-market.mjs`, `scripts/backfill-prices-wayback.mjs`, `scripts/ingest-wayback-prices.mjs`. Nothing in `src/server` records an observation.

**Shape classes of the 221 multi-point histories** (`analyze.py::classify`):

| Class | n | Vendors | What it is |
|---|---|---|---|
| A `[real, 150,150,150,150]` — history[0]==current price, tail = one round placeholder | **76** | nootropic-source 37, peptide-pros 34, vici-peptides 5 | placeholder values: **150 ×71, 200 ×5**. Vendor page validation: nootropicsource.com GHRP-2 meta price `19.95`, banner "free shipping on orders over **$150** (USA ONLY)". The parser recorded the shipping threshold as the price. |
| B `[real_old, 100,100,100,100(,100)]` with **current price = 100** | **75** | umbrella-labs 75 (of 113) | umbrellalabs.is 5-amino-1mq page: JSON-LD `"price":"79.99"`, header banner "ORDERS **$100** OR MORE AND GET 10% OFF!". VialGrade API price = 100, previousPrice = 79.99; `/products/umbrella-labs-5-amino-1mq-30ml` renders "$100 · Checked 9 hours ago". **All 74 umbrella-labs listings observed on 2026-08-29 are $100; 0 are not. The 33 observed 2026-08-28 still carry real prices.** The placeholder is the live price today. |
| C `[X, X/10, X/10, …]` 10× unit flip | 21 | swiss-chems 21 | kit-of-10 price vs per-vial (e.g. 175.6 vs 17.56, 199.5 vs 19.95). |
| D `[previousPrice, price, price, price, price]` | 6 | simple-peptide 6 | one real step (e.g. 45→35, 114→43) then daily repeats. Plausibly real. |
| F `[price, v, v, v]` a single other value repeated | 43 | ascend-bio-labs 27, swiss-chems 9, purerawz 5, simple-peptide 2 | ascend: bundle price vs 1-vial variant (128 vs 71, 110 vs 43, 400 vs 50); purerawz: 2-point `[111.58, 80.56]`, `[572.97, 650.59]` (could be real or variant). |
| G/H varied non-round multi-point | **0** | — | **No listing has plausibly real multi-point history.** |

Most common tail values across all multi-point histories: 100 ×320, 150 ×284, 200 ×20 — i.e. **624 of the ~1,000 history points beyond history[0] are one of three banner numbers.**

**Junk totals:** class A + B = **151 of 221 (68%)** multi-point histories are banner-threshold artefacts; adding the 10× flips, **172 (78%)** encode no real price movement. Plausibly real movement: 6 (D) + at most 5 purerawz 2-pointers.

**Lost movement (the inverse problem):** 26 single-point histories whose only value ≠ current price (modern-aminos 7, chameleon-peptides 8, bluum-peptides 3, felix-chemical-supply 3, purerawz 2, umbrella-labs 1, simple-peptide 1, cernum-biosciences 1) — e.g. `modern-aminos-epitalon` price 28, history `[40]`; `umbrella-labs-snap-8` price 25.99, history `[50.99]`. The collector observed a real change and the history didn't record it. 657 single-point histories equal the current price (no change ever seen or recorded).

10 concrete examples (slug | vendor | price | previousPrice | history):
1. nootropic-source-ghrp-2 | nootropic-source | 19.95 | 19.95 | [19.95, 150, 150, 150, 150] (A)
2. nootropic-source-ghrp-6 | nootropic-source | 19.95 | 19.95 | [19.95, 150, 150, 150, 150] (A)
3. peptide-pros-pt-141 | peptide-pros | 37.5 | 37.5 | [37.5, 150, 150, 150, 150] (A)
4. vici-peptides-pt-141 | vici-peptides | 49.99 | 49.99 | [49.99, 200, 200, 200, 200] (A)
5. umbrella-labs-5-amino-1mq-30ml | umbrella-labs | **100** | 79.99 | [79.99, 100, 100, 100, 100, 100] (B; vendor page says 79.99)
6. umbrella-labs-bpc-157-500mcg | umbrella-labs | **100** | 149.99 | [149.99, 100, 100, 100, 100, 100] (B; flagged "price-drop" on a fake drop)
7. swiss-chems-ipamorelin-kit10vials | swiss-chems | 175.6 | 175.6 | [175.6, 17.56, 17.56, 17.56, 17.56] (C)
8. ascend-bio-labs-bpc-157-2bottles | ascend-bio-labs | 128 | 128 | [128, 71, 71, 71] (F; 71 = 1-vial price)
9. simple-peptide-mots-c-40mg | simple-peptide | 43 | 114 | [114, 43, 43, 43, 43] (D; plausible sale)
10. purerawz-tirzepatide-nasalspray20 | purerawz | 572.97 | 572.97 | [572.97, 650.59] (F/2-point; possibly real)

## D. Price freshness (`observedAt`, reference = catalog generatedAt 2026-08-29T17:10Z)

- **p50 = 0.26 d, p90 = 15.65 d, max = 24.52 d, mean 5.08 d.** <1 d: 60.8%; <2 d: 64.5%; **≥7 d: 27.7% (250 listings)**; ≥14 d: 23.3%; ≥21 d: 8.0%.
- By calendar day: 08-29 → 550, 08-28 → 33, 08-27 → 58, 08-26 → 12, 08-25 → 1, 08-21 → 37, 08-20 → 2, 08-14 → 137, 08-13 → 2, **08-05 → 72 (never re-observed since first ingest)**.
- Rendered `lastChecked` (server): "4 hours ago" 165, "15 days ago" 139, "5 hours ago" 130, "3 hours ago" 124, "24 days ago" 72, "8 hours ago" 59, "2 days ago" 58, …

By vendor (n · p50 · p90 · max · share ≥7 d):

| vendor | n | p50 d | p90 d | max d | ≥7 d |
|---|---|---|---|---|---|
| behemoth-labz | 48 | 24.52 | 24.52 | 24.52 | **100%** |
| bluum-peptides | 54 | 8.53 | 24.52 | 24.52 | **100%** |
| purerawz | 154 | 15.65 | 15.65 | 24.52 | **85.7%** |
| vici-peptides | 10 | 0.22 | 15.58 | 15.58 | 40% |
| modern-aminos | 60 | 0.17 | 0.17 | 24.52 | 6.7% |
| umbrella-labs | 113 | 0.37 | 1.17 | 24.52 | 3.5% |
| nootropic-source | 48 | 0.17 | 0.17 | 24.52 | 2.1% |
| ascend-bio-labs | 86 | 2.17 | 2.17 | 2.17 | 0% |
| swiss-chems 74 · simple-peptide 55 · chameleon-peptides 60 · felix 23 · ez-peptides 34 · cernum 28 · sports-technology-labs 23 · peptide-pros 34 | | ≤0.26 | ≤3.0 | ≤15.9 | ≤1.8% |

So the daily collect IS refreshing 13 of 16 vendors (12 with p50 < 1 d, ascend-bio-labs at 2.2 d), and **three vendors — behemoth-labz, bluum-peptides, purerawz (256 listings = 28% of the catalog) — are not being refreshed** (medians 8–25 days). `vendor.lastObserved` is a string and is `2026-08-05` on 73 vendors / `"just now"` on 10 — it is not a usable freshness signal.
Product pages: 6/6 render `Observed price $X · Checked <relative>` matching the API `observedAt` (e.g. ipamorelin "24 days ago", 5-amino "9 hours ago"). No `Last-Modified`/`ETag`; pages are `private, no-store`.

## E. Compounds — `priceChange` (worst 10 by |priceChange|)

`priceChange` is computed by `src/server/intelligence/cascade.ts` as the **median over listings with ≥2 history points of (h[-1]−h[0])/h[0]** — `analyze.py` recomputes it from the public histories and **matches the stored value for 60/60 compounds**, so every number below is traceable to the junk in C. 51/60 compounds have non-zero priceChange; 23 have |pc| ≥ 50%; 13 have |pc| ≥ 100%. `/compounds/ghrp-2` renders `+525.3%` publicly.

| compound | priceChange | listings | median $ | min–max $ | multi-point listings behind it (move) |
|---|---|---|---|---|---|
| ghrp-2 | **+525.3%** | 13 | 39.99 | 19.95–199.50 | nootropic `[19.95,150×4]` +652% (A) · peptide-pros `[23.99,150×4]` +525% (A) · swiss `[199.5,19.95×4]` −90% (C) |
| melanotan-1 | +212.8% | 9 | 45.00 | 29.99–100 | peptide-pros `[35.25,150×4]` +326% (A) · umbrella `[49.99,100×4]` +100% (B) |
| pt-141 | +200.3% | 25 | 51.99 | 24.95–499.90 | 4× A (+200…+501%) · umbrella `[129.99,100×4]` −23% (B) · ascend `[400,50×3]` −88% (F) · swiss −90% (C) |
| oxytocin | +185.8% | 19 | 49.00 | 21.95–319.50 | 3× A (+275…+525%) · 2× B (+144, +186%) · simple-peptide `[45,35×4]` −22% (D) · swiss −93% |
| hgh-fragment-176-191 | +179.5% | 11 | 44.00 | 26.99–160.30 | nootropic +329% (A) · umbrella `[76.99,100×4]` +30% (B) |
| ara-290 | +150.1% | 10 | 80.80 | 34.95–855.95 | nootropic +329% (A) · umbrella +150% (B) · swiss −90% (C) |
| argireline | +150.1% | 3 | 214.96 | 100–215.23 | umbrella `[39.99,100×4]` +150% (B) — one listing sets the compound |
| ghrp-6 | +138.2% | 17 | 50.00 | 19.95–400 | 2× A (+525, +652%) · umbrella +138% (B) · swiss −90% (C) · ascend −88% (F) |
| hexarelin | +132.6% | 9 | 68.00 | 21.56–215.60 | peptide-pros +525% (A) · umbrella +133% (B) · swiss −90% (C) |
| snap-8 | +117.4% | 8 | 41.89 | 25.99–260 | umbrella `[45.99,100×4]` +117% (B) |

Not one of the 10 is driven by a real price move.

## F. /status (fetched 17:17:08Z and 17:17:42Z; all values identical apart from Checked time + probe latency 465 ms / 79 ms → server-rendered, not placeholders; "Not reporting" / "All systems operational" absent)

- Banner: **"Degraded — the refresh queue is behind; the worst source is 4x its own interval late"**
- Catalog: Working — "Prices, vendors and lab tests are being served"
- Refresh engine: **431 enabled** — "48 due · worst is 4x its interval late"
- Collectors: **98 enabled** — "**3 waiting · oldest 17m past due · 2 failing**"
- Alerts going out: **0 readers** — "Last ran 5h ago" (sweep ran, swept nobody)
- Intelligence graph: 2205 traces — 1146 alerts · 2262 open signals
- **Collector/source NAMES are not rendered** on the public page (counts only), so which 2 are failing / which source is 4× late cannot be read from outside; that requires `/admin` (out of scope here). The three unrefreshed vendors in D are the obvious candidates.

## G. Sitemap spot-check

1,228 URLs: 25 static, **`/stacks` + 10 `/stacks/<slug>`** (wolverine, glow, klow, gh-stack, visceral-fat, cagrisema, reta-cagri, skin-repair, metabolic-mito, cognitive-duo), 904 products, 60 compounds, 83 vendors, 134 passports, 11 labs. Product/vendor/compound counts equal the catalog exactly. `GET /stacks/wolverine` → **200** (renders "Wolverine · Discussed for tissue recovery"). Sitemap `cache-control: public`, `x-vercel-cache: MISS`.

## H. Surprises / P0s

1. **P0 — umbrella-labs live prices are wrong today.** 75/113 umbrella-labs listings show `price: 100`; every one observed on 2026-08-29 (74/74). The vendor page for the sampled listing says $79.99 in JSON-LD and WooCommerce markup; the only "$100" on the page is the "ORDERS $100 OR MORE AND GET 10% OFF" banner. The $100 is rendered on `/products/...`, feeds `pricePerMg`, `trust.priceFlag` (produces fake "price-drop"/"too-cheap" flags), compound medians and stack "lowest combined" math. The 08-28 run for the same vendor produced real prices, so this is a parser/regression on the current collect, not a stale artefact.
2. **P0/P1 — `priceChange` is 100% junk-driven and public.** 60/60 compound values reproduce from histories whose multi-point tails are banner thresholds (150/100/200) or unit flips; 13 compounds show ≥100% moves on `/compounds/<slug>`. Zero listings have ≥3 distinct history values; zero have plausibly real multi-point history. The 6 simple-peptide sale steps are the only real movement in the whole store.
3. **Design-critical: the cron collect path never appends to `price_history`** (`live-sources.ts:367`, CASE-when-empty). Histories only exist where a script (`ingest-market.mjs` / wayback backfills) ran. Consequence: 26 listings whose current price differs from their single history point — real changes silently dropped.
4. **Three vendors are not being refreshed:** behemoth-labz (48, all 24.5 d), bluum-peptides (54, all ≥7 d), purerawz (154, 86% ≥7 d) = 250 of 904 listings ≥7 days old while /status says "2 failing · 3 waiting". Consistent with the banner "worst source 4× late".
5. **HANDOFF drift:** 83 vendors (not 82), **904 listings (not 805)**, 60 compounds (ok), COAs: 265 by vendor sum / 202 by compound sum (HANDOFF said 279 — different aggregation, not verifiable from public data), demo = 0 (ok). Only 16 vendors carry listings.
6. `/api/v1/market-summary` is **not public** (401) — it is the per-user summary feed, not a compounds endpoint. `reportDate` is empty on all 904 listings; `evidenceLevel` is `public-only` on all 904; `vendor.lastObserved` is a stale string (`2026-08-05` on 73 vendors).
7. "Alerts going out: 0 readers · Last ran 5h ago" — the sweep runs but reaches nobody (may be correct if no reader has alerts; worth a look).

## I. Reproduction

```
RAW=/private/tmp/claude-501/-Users-natepegg/bfe36d70-2724-4319-9970-c9846ee5c752/scratchpad/audit/A2-raw
cd "$RAW"
# fetch.sh: curl -s --max-time 30 -A "VialGrade-audit/1.0 (owner-run)" -D name.headers -o name.body, 0.3 s sleep between calls
./fetch.sh catalog-full  "https://vialgrade.com/api/v1/catalog"
./fetch.sh catalog-lite  "https://vialgrade.com/api/v1/catalog?shape=lite"
./fetch.sh v1-health     "https://vialgrade.com/api/v1/health"
./fetch.sh health-live   "https://vialgrade.com/api/health/live"
./fetch.sh health-ready  "https://vialgrade.com/api/health/ready"
./fetch.sh status-1      "https://vialgrade.com/status";  sleep 30;  ./fetch.sh status-2 "https://vialgrade.com/status"
./fetch.sh sitemap       "https://vialgrade.com/sitemap.xml"
./fetch.sh market-summary-unauth "https://vialgrade.com/api/v1/market-summary"     # expect 401
./fetch.sh stacks-index  "https://vialgrade.com/stacks";  ./fetch.sh stack-detail "https://vialgrade.com/stacks/wolverine"
# 5 sampled product pages (freshest, p25, p50, p75, stalest; distinct vendors) — slugs in sample-slugs.txt
./fetch.sh product-1-ascend-bio-labs-5-amino-1mq "https://vialgrade.com/products/ascend-bio-labs-5-amino-1mq"   # …-2..-5 likewise
./fetch.sh compare-post "https://vialgrade.com/api/v1/compare" -X POST -H "content-type: application/json" --data '{"slugs":["ascend-bio-labs-5-amino-1mq","swiss-chems-pt-141"]}'
./fetch.sh compound-worst-ghrp-2 "https://vialgrade.com/compounds/ghrp-2"
./fetch.sh product-umbrella-umbrella-labs-5-amino-1mq-30ml "https://vialgrade.com/products/umbrella-labs-5-amino-1mq-30ml"
./fetch.sh vendorpage-umbrella  "https://umbrellalabs.is/shop/nootropics/nootropic-liquid/5-amino-1mq-liquid/" -L
./fetch.sh vendorpage-nootropic "https://nootropicsource.com/shop/peptides/ghrp-2/" -L
python3 analyze.py            # prints + writes analyze-output.txt; every figure in this report comes from it
```
Full request log with timestamps/sizes: `A2-raw/requests.log`.
