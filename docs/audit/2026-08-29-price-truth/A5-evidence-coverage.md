# A5 — Listing evidence coverage: is there an honest step that beats fixing price history?

Read-only audit, 2026-08-29. 25 public HTTPS requests (UA `VialGrade-audit/1.0`), no DB, no admin. Repo `/Users/natepegg/vial`.

## A. Coverage today (verified from `GET https://vialgrade.com/api/v1/catalog`, one un-paginated snapshot, `generatedAt 2026-08-29T17:10Z`)

Route: `src/app/api/v1/catalog/route.ts:16-22` returns the full `getCatalogSnapshot()`; per-listing verdict is `product.trust.status` (`src/server/catalog/repository.ts:40`).

| state (`trust.status`) | listings | share | 2026-08-12 (commit b17a78a) |
|---|---:|---:|---:|
| no-claim ("No lab test") | 696 | 77.0% | 63.7% |
| verified ("Independently tested") | 92 | 10.2% | 10.2% |
| batch-verified ("Batch tested") | 39 | 4.3% | — (ascend-bio-labs only, via RSC COA metadata) |
| unbacked ("Testing unverified") | 76 | 8.4% | 25.9% |
| low-purity | 1 | 0.1% | — |
| **real independent evidence** | **131** | **14.5%** | 10.2% |

Total live listings 904 (all `origin: live`). Unbacked share fell because the catalog grew ~537 → 904 mostly with no-claim listings (purerawz 154, umbrella-labs 113, swiss-chems 74…), not because claims were confirmed. `advertisesTesting` is true on 99 listings (7 vendors); `reportIssuer`/`batchCode` non-empty on 39 (all ascend-bio-labs). `evidence[]` is empty and `evidenceLevel` is `public-only` on all 904.

Vendors: 83 in catalog; **16 storefronts have live listings; 9 of those have ≥1 verified/batch-verified listing** (ascend-bio-labs, bluum, chameleon, ez-peptides, felix, peptide-pros, sports-technology-labs, umbrella-labs, vici). 5 storefronts with listings hold zero COAs (behemoth-labz 48, cernum 28, modern-aminos 60, nootropic-source 48, swiss-chems 74 = 258 listings). **56 "manufacturer"-kind vendors hold 193 COAs and zero listings.**

COA records: HANDOFF says 279. Verified offline: Jul-22 Janoshik snapshot has 201 unique verify URLs (`scripts/data/janoshik-feed-snapshot.html`, git-dated 2026-07-22) + 73 hand-gathered `vendor-coas.json` + 5 `vendor-self-coas.json` = **279** — so (inferred) **no COA has been added since 2026-07-22**. Catalog `compound.coaCount` sums to 202 (independent + compound-matched); 32/60 compounds have ≥1; 26 compounds with listings have 0 (197 no-claim listings get no compound context either). Of the 279, at most ~131 listings across 9 vendors are backed; the 193 manufacturer COAs are linked to no listing.

## B. Mechanics chain (file:line)

1. Feed → `fetchJanoshikPortal` `src/server/verify/janoshik-verify.ts:12-22` (Chrome UA) → `parseJanoshikFeed` `src/server/ingest/lab-tests.ts:47-75` (manufacturer = "Made By", client = who ordered).
2. Discovery → `ingestNewJanoshikTests` `src/server/ingest/janoshik-discovery.ts:53-100`; vendor minted from client‖manufacturer by `deriveCoaVendors` `src/server/ingest/coa-vendors.ts:98-113`; `recordLabTest` `lab-tests.ts:127-159`: compound via `matchCompound(sampleName)` `shopify-import.ts:35-50`, vendor via pre-resolved slug or `matchVendor` `lab-tests.ts:80-105` (longest overlap, keys ≥5 chars, tie → null), `is_independent` from `src/server/labs/registry.ts` (Janoshik/MZ/Colmaric = "independent"). Purity/batch only from vision file `janoshik-purities.json` (`applyPurities` `janoshik-discovery.ts:128-149`; 139/201 have a batch).
3. Listing side → Shopify wedge `shopify-import.ts:172-199` (`extractJanoshikRefs`/`resolveStorefrontCoaClaims` `storefront-coa.ts:43-115`); Woo reads only Store-API `description` `woocommerce-import.ts:285-286`; RSC reads `coa_*` metadata `rsc-storefront-import.ts:122-149` and `scheduler.ts:198-215` records it as a `lab_test_records` row with `vendor_slug = storefront` (the only automated path that ever produced batch-verified). Claims persist via `live-sources.ts:372-373`.
4. Verdict → `computeListingTrustMap` `src/server/verify/listing-trust.ts:52-156`: "independent for this vendor" = same `compound_slug` AND (`vendor_slug == listing vendor` OR `norm(manufacturer) ⊇ norm(vendorSlug)`) (line 107); batch hit lines 111-118 (≥6 chars); `coaStatusFrom` `coa-cross-check.ts:94-112`; product page `crossCheckCoa` `coa-cross-check.ts:118-266`; UI `trustDisplay` `src/components/listing-trust-chip.tsx:37-57`.

Where it fails on real data (verified): **0 of 250 snapshot entries name any of the 16 listed storefronts** (strict match on full name or domain core); 244/250 name the 56 manufacturer-kind vendors. Line 107 therefore cannot fire on Janoshik data for 15/16 storefronts. Only 39/904 listings carry a batch code. Blends (`"BPC 157 + TB 500 blend"`) return null from `matchCompound`. Janoshik discovery/verify are hand scripts only — no `janoshik` collector exists under `src/server/collect` or `src/app/api` (grep: none).

## C. Levers

| lever | coverage estimate | effort | honesty risk |
|---|---|---|---|
| a. Vendor COA-hub pages | umbrella-labs only reachable case: 101 no-claim listings → "document on file"; **0 → verified via Janoshik** (0 verify links on any page probed) | medium (per-vendor hub collector + allowlist + new intermediate state + UI) | medium: vendor-hosted PDFs are D0 (`docs/EVIDENCE_LABORATORY_NETWORK.md` hierarchy); note today's "Independently tested" already rests on the same D0 basis for MZ-lab PDFs in `vendor-coas.json` (STL 18) |
| b. Manufacturer↔storefront linkage | ~0: `vendor_links` bases are web-id/shared-lot/shared-source/shared-photo (`vendor-linkage-schema.ts:25`, `vendor-linkage.ts:12`), all derived from `lab_test_records.vendor_slug` or fingerprints; no "resells X" edge and no source declares a supplier | high | high (inferring a supplier is a published claim about a real company) |
| c. Janoshik vendor-name discovery | 0 new listing links (0/250 storefront hits); keeps compound-level context (499 no-claim listings show "Compound: N COAs") fresh — currently stale since 07-22 | low (add a collector kind) | low |
| d. Reddit | not evidence; inert without creds (`reddit.ts:8-14`); classifier NEG-before-POS defect open | — | — |
| e. Half-built | RSC `coa_*` metadata path (works: 39 batch-verified); re-gathering `vendor-coas.json` (the source of all 92 "verified") | research hours, not code | same D0 caveat as (a) |

## D. Vendor COA-page probe (10 vendors, 18 requests, ≤2 pages each; raw HTML in `scratchpad/audit/vendor-probe/`)

- purerawz, modern-aminos: Cloudflare 403 on homepage — unseen.
- **umbrella-labs**: `/certificate-of-analysis-coa/` hub with `peptides-coas/` subpage (link verified on homepage; not fetched — budget). The nootropics subpage: **113 PDFs, 146 COA images, per-lot rows naming "MZ BioLabs" / "Vanguard Laboratory" with dates, 0 `verify.janoshik.com` links.**
- bluum-peptides (Shopify): `/pages/coa-lookup` = lot-number lookup form ("Enter lot number… RET152607-117A"); 0 verify links; listings carry no lot.
- simple-peptide: `/certificate-of-analysis/` = marketing copy + 11 "Open document ↗" with no resolvable PDF/image hrefs.
- behemoth-labz: nav "quality-control-and-testing" → 404.
- swiss-chems, nootropic-source, cernum-biosciences, ascend-bio-labs: no COA nav link; `/coa/` → 404.
- The 08-12 probe (commit b17a78a) read Woo Store-API product descriptions (`woocommerce-import.ts:285`); no probe script survives in-repo, so (inferred) it did not read hub pages. Hub pages change the picture only for umbrella, and only to D0 documents.
- Live Janoshik feed: `public.janoshik.com` returned Cloudflare "Attention Required" to the audit UA — not verifiable within constraints.

## E. Recommendation

Ranked: **(1) make price history real; (2) cron the Janoshik discover/verify scripts (low effort, stops rot); (3) umbrella-style COA-hub collector with an explicit "vendor-hosted document on file" state that is never "verified"; (4) re-gather `vendor-coas.json`. (b) and (d): no.**

Plain answer: **No evidence step beats price history.** What the site renders as FALSE today, verified live: `/compounds/bpc-157` hero "$68 −33.3 %"; `/compounds` table (`compound-market-table.tsx:96-125`, 60 `priceChange` values in the payload, 51 non-zero); `/products/nootropic-source-ghrp-2` "Price trend +651.9 % $20 → $150" from series `[19.95,150,150,150,150]` (`products/[slug]/page.tsx:95-97,255-266`). 213 listings carry placeholder series; 221 have ≥2 points and render the block. Evidence, by contrast, renders unknowns as unknowns everywhere I looked ("Nothing to verify", "No lab test", "Compound: N COAs" scoped to the compound). A first-time visitor hits the hero delta before any evidence chip. The evidence gap is structural (vendor ≠ manufacturer, quantified at 0/250), so there is no cheap coverage step — only the cheap freshness step (2).

## F. Could not verify

Live Janoshik feed (Cloudflare with audit UA); production `lab_test_records` internals (279 breakdown inferred from three files summing exactly); whether MZ Biolabs/Vanguard offer an issuer-side verify portal; purerawz/modern-aminos pages; umbrella's peptide hub page specifically; the 08-12 probe's exact scope (script not in repo); exact wording of the prior 10.2% (verified-only vs verified+batch).
