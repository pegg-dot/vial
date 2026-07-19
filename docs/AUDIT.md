# Audit Record

## Audit date

July 19, 2026

## Release

VIAL 0.3.0, controlled refresh and cascading intelligence.

All catalog entities, vendors, source pages, laboratory names, prices, batch identifiers, reviews, and market conditions in this release are fictional fixtures.

## Build checks

```text
npm run lint       PASS
npx tsc --noEmit   PASS
npm run test:all   PASS, 10 tests
npm run build      PASS
npm run test:e2e   PASS, 8 tests
npm audit          PASS, 0 known vulnerabilities
```

## Unit and integration tests

Ten Vitest tests cover:

1. Structured price and availability extraction
2. Bounded evidence metadata extraction
3. Prompt-injection instruction filtering
4. Predicate deduplication
5. Private, loopback, link-local, documentation, and multicast address rejection
6. Scheme, credentials, hostname, port, and resolved-network controls
7. Compact immutable snapshot diff generation
8. Atomic reviewed publication, role gates, idempotency, and catalog projection
9. One-root lineage from fixture mutation through publication, metrics, alerts, and opportunities
10. Single scheduler claim behavior with one durable attempt receipt

## Browser tests

Eight Playwright flows cover:

1. Public health and protected run-receipt authorization
2. Staff login, source ingestion, review, publication, and public update
3. Controlled fixture refresh through visible downstream cascade
4. Home page and command search
5. Market filtering
6. Watchlist persistence
7. Dimensional product comparison
8. Mobile navigation

The HTML report is stored at `audits/playwright-report/index.html`.

## Google Lighthouse

Reports were generated against a production build with headless Chromium. Performance measurements can vary with available container CPU; accessibility, best-practices, SEO, and layout-shift results were deterministic across the final run.

| Route | Performance | Accessibility | Best practices | SEO | CLS | LCP | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 86 | 100 | 100 | 100 | 0 | 2,817 ms | 400 ms |
| `/market` | 89 | 100 | 100 | 100 | 0 | 2,805 ms | 302 ms |
| `/products/northstar-bpc-157-10mg` | 92 | 100 | 100 | 100 | 0 | 2,734 ms | 234 ms |
| `/operations` | 86 | 100 | 100 | 100 | 0 | 2,835 ms | 379 ms |
| `/signals` | 98 | 100 | 100 | 100 | 0 | 1,733 ms | 144 ms |
| `/admin/login` | 98 | 100 | 100 | 100 | 0 | 1,739 ms | 159 ms |

The first VIAL 0.3 Lighthouse pass found low-contrast trace identifiers and supporting copy on `/operations`, plus low-contrast explanatory copy on `/signals`. Those styles were corrected and both routes were re-audited at 100 accessibility.

Machine-readable results are stored at `audits/lighthouse/summary.json`.

## Visual QA

Fresh screenshots cover:

### Public

- Home at desktop and mobile sizes
- Market
- Product record
- Operations and causal traces
- Market signals at desktop and mobile sizes
- Admin login

### Staff

- Operations overview
- Source policies and durable refresh jobs
- Controlled source ingestion
- Human review queue
- Opportunity workspace
- Causal trace explorer
- Publication ledger
- Workflow run receipts

The screenshots were inspected for overflow, hierarchy, clipping, signal language, source-policy status, trace readability, mobile navigation, opportunity density, and the separation between informational evidence and product suitability.

## End-to-end causal audit

The controlled fixture flow was exercised through the browser and integration suite:

```text
Fixture mutation
  -> durable refresh job
  -> one claimed attempt
  -> immutable source snapshot
  -> compact snapshot diff
  -> bounded claim extraction
  -> canonical entity resolution
  -> human review
  -> atomic one-field publication
  -> compound metric recomputation
  -> vendor metric and history recomputation
  -> reviewed watchlist alert
  -> opportunity-signal evaluation
  -> one root causal trace with typed edges
```

The integration suite verifies that downstream records retain the initiating root event rather than starting disconnected traces.

## Opportunity-engine audit

The release can create, update, resolve, watch, dismiss, and reopen stable signals for:

- Source health
- Source coverage gaps
- Listing evidence refreshes
- New-batch evidence needs
- Batch-document gaps
- Listing price outliers
- Vendor evidence gaps
- Vendor onboarding opportunities
- Compound price dispersion
- Thin visible availability
- Compound evidence gaps
- Issuer concentration
- Supply concentration

Stable signal keys prevent repeated sweeps from creating duplicate open conditions.

## Runtime and architecture issues found and fixed

- Replaced a two-stage job claim workaround with one atomic scheduler claim and one attempt receipt.
- Fixed root-event inheritance so downstream effects cannot accidentally form a second causal tree.
- Added immutable before-and-after snapshot diffs rather than overwriting observed content.
- Added bounded retry and backoff state to durable refresh jobs.
- Added redirect-by-redirect network validation and DNS/IP checks to the HTTP transport.
- Added parser profiles so document sources do not accidentally emit commerce fields.
- Added prompt-injection filtering before claim extraction.
- Preserved human approval as the publication gate for every public mutation.
- Corrected low-contrast public trace and signal text found by Lighthouse.
- Added clean-build cache removal to avoid an intermittent Turbopack cache hang in this container.
- Limited Vitest parallelism for deterministic embedded-database integration tests.

## Known limitations

- All source and market data is fictional.
- The release seed uses deterministic fixtures; no real vendor is crawled.
- Live HTTP refresh exists as a constrained transport but is not enabled for public vendor domains.
- The extractor is deterministic and supports a narrow, explicit claim vocabulary.
- PGlite is a local-development convenience; managed PostgreSQL is the production target.
- Anonymous watchlists use browser storage rather than durable user accounts.
- Alerts are visible in-product; email, SMS, and push delivery are not implemented.
- Opportunity signals describe information and market structure, not product quality, safety, efficacy, or suitability.
- No physical product verification occurs.
- No seller onboarding, seller links, payments, order routing, or checkout exists.
- No medical recommendations, dosage content, injection instructions, or reconstitution guidance exists.
