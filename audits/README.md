# Audit artifacts

These artifacts document the final VialGrade 0.3 production build and its controlled fictional source-to-signal flow.

## Screenshots

### Public

- `screenshots/home-desktop.png`
- `screenshots/home-mobile.png`
- `screenshots/market-desktop.png`
- `screenshots/product-desktop.png`
- `screenshots/operations-desktop.png`
- `screenshots/signals-desktop.png`
- `screenshots/signals-mobile.png`
- `screenshots/admin-login-desktop.png`

### Staff

- `screenshots/admin-overview-desktop.png`
- `screenshots/admin-sources-desktop.png`
- `screenshots/admin-ingest-desktop.png`
- `screenshots/admin-review-desktop.png`
- `screenshots/admin-opportunities-desktop.png`
- `screenshots/admin-traces-desktop.png`
- `screenshots/admin-publications-desktop.png`
- `screenshots/admin-runs-desktop.png`

The capture script advances a controlled fictional fixture, publishes one reviewed batch claim when available, recomputes the market, and then captures the populated trace and opportunity surfaces.

## Google Lighthouse

Each route has an HTML report and a machine-readable JSON report.

- `lighthouse/home.report.*`
- `lighthouse/market.report.*`
- `lighthouse/product.report.*`
- `lighthouse/operations.report.*`
- `lighthouse/signals.report.*`
- `lighthouse/admin-login.report.*`
- `lighthouse/summary.json`

Final scores:

| Route | Performance | Accessibility | Best practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Home | 86 | 100 | 100 | 100 |
| Market | 89 | 100 | 100 | 100 |
| Product | 92 | 100 | 100 | 100 |
| Operations | 86 | 100 | 100 | 100 |
| Signals | 98 | 100 | 100 | 100 |
| Admin login | 98 | 100 | 100 | 100 |

All audited routes recorded zero cumulative layout shift.

## Playwright

- `playwright-report/index.html`

The eight browser flows are defined in:

- `tests/e2e/marketplace.spec.ts`
- `tests/e2e/admin-workflow.spec.ts`

They include the controlled source-refresh cascade from fixture mutation through human publication and visible downstream traces.

## Screenshot utility

`capture.mjs` expects a running application on `http://127.0.0.1:3000`. It captures public pages, signs into the staff workspace with `VIALGRADE_AUDIT_ADMIN_TOKEN`, advances a deterministic fictional source, runs the opportunity sweep, and captures the resulting operations surfaces.
