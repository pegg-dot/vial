# VIAL 0.4 — Product foundation and quality controls

VIAL 0.4 fills the missing product architecture around the marketplace detail pages and adds an operator quality surface for the controlled-source program.

## New public product surfaces

- `/compounds` canonical compound directory
- `/vendors` persistent vendor directory
- `/research` evidence and report library
- `/updates` public human-reviewed publication ledger
- `/account` local preference and notification center
- `/about` company and product thesis
- `/help` help center and evidence FAQ
- `/status` live prototype system status
- `/legal/privacy`, `/legal/terms`, `/legal/disclaimer`

The primary navigation, mobile navigation, footer, metadata, and sitemap now expose the complete product skeleton.

## New staff quality surface

- `/admin/quality` summarizes parser profiles, controlled-source attempts, observed claims, success rate, and human-review queue aging.
- Production-source promotion criteria are visible in the operator interface rather than living only in planning documents.

## Validation

- ESLint passed.
- 7 unit tests passed.
- 3 integration tests passed.
- Next.js production build passed.
- All new public routes returned HTTP 200 in a production-server smoke test.
- Desktop screenshots were captured for compound, vendor, evidence, updates, account, and about pages, plus a mobile compound directory screenshot.
- npm audit reported zero known vulnerabilities at installation.

## Boundaries

The release still uses fictional data and controlled fixtures. Durable public accounts, real email or push delivery, approved real-source crawling, seller onboarding, checkout, and physical laboratory verification remain future work.
