# Storefront-published COA linking — the coverage wedge

**Why this exists.** VialGrade holds a vendor-specific independent test for only ~11% of listings, because the
companies that get Janoshik-tested (manufacturers) and the storefronts that sell (the ~15 catalogs we
scrape) are largely different sets, and the scraped listings carried no batch or testing data. But most
storefronts publish *their own* Janoshik COA — usually a `verify.janoshik.com/tests/<id>` link — right on
the product page. This wedge reads those links and, when they resolve to a certificate VialGrade already
independently holds for that product's compound, stamps the listing's testing claim so the (hardened)
`crossCheckCoa` can produce the verdict. That's how a listing moves from "No lab test" to real evidence.

## What it does NOT do (the honesty guarantees, each covered by a test)

- **Never invents evidence.** It only links to Janoshik records already in `lab_test_records` — the
  immutable verify URL, never the storefront's (editable) COA image. An unresolvable link is ignored.
- **Never links a self-published record.** `resolveStorefrontCoaClaims` filters `is_independent`.
- **Never attaches a cert for a different compound** than the product it's embedded on
  (`held.compound_slug === product compound`), and it keys claims by **compound+URL** so a boilerplate
  footer link shared across products can't leak one compound's claim onto another compound's listing.
- **Never launders a foreign cert, and never manufactures a counterfeit accusation.** It stamps the
  cited *batch* only when the resolved cert is the storefront's OWN (same vendor) — reaching a
  legitimate "batch-verified". A DIFFERENT maker's cert (a reseller publishing its supplier's real COA)
  yields an **issuer-only** claim, which `crossCheckCoa` reports honestly as "unbacked" (advertises
  testing, unconfirmed for this vendor) — never "verified", and never a fabricated "mismatch".

## Where it lives

- `src/server/ingest/storefront-coa.ts` — `extractJanoshikRefs` (pure) + `resolveStorefrontCoaClaims`.
- `src/server/ingest/shopify-import.ts` — the import loop extracts + resolves + stamps.
- `src/server/ingest/live-sources.ts` — `recordCatalogListing` writes the testing claim.
- Tests: `tests/unit/storefront-coa.test.ts`, `tests/integration/storefront-coa.test.ts`.

## How to run it (owner lane)

It runs automatically as part of the market ingest — no separate step. The script was reordered so the
**Janoshik feed loads before the storefront catalogs**, so the linker can resolve on a fresh run.

```bash
# dev server STOPPED first (file-backed PGlite is single-writer)
VIALGRADE_LIVE_INGEST_APPROVED=true node --import tsx scripts/ingest-market.mjs
```

Check coverage before/after with the catalog API's per-listing `trust.status` (share of `verified` /
`batch-verified` vs `no-claim`).

## Honest limitations (deliberate, not corners)

- **Only resolves against certs VialGrade already holds** (the Janoshik feed). A storefront citing a Janoshik
  test not yet in our feed won't link — the follow-up increment is a resolver that fetches
  `verify.janoshik.com` for the ones we don't have (needs the host allowlisted + external fetch).
- **Shopify only for now.** Extraction reads Shopify `body_html`; ~14 of 15 storefronts are
  Cloudflare-gated (can't fetch their product pages). WooCommerce/others are a later extension.
- **Image-only COAs are ignored.** A storefront that posts a COA *image* with no verify link isn't
  trusted (the image is editable) — that's the vision path, a separate future increment.
- **Sticky on re-ingest.** If a storefront removes a COA, the last-known claim persists until manually
  cleared. It can only ever leave a stale-but-once-true claim, never fabricate a new one.
