# VIAL 0.4 audit

## Automated

- `npm run lint`: passed
- `npm run test:unit`: 7 passed
- `npm run test:integration`: 3 passed
- `npm run build`: passed
- npm install audit: 0 known vulnerabilities

## Production-server route smoke test

HTTP 200 confirmed for:

- `/`
- `/market`
- `/compounds`
- `/vendors`
- `/research`
- `/updates`
- `/about`
- `/help`
- `/account`
- `/status`
- `/legal/privacy`
- `/legal/terms`
- `/legal/disclaimer`

## Visual review

Screenshots are under `audits/screenshots-v0.4/` for the major new product surfaces.

## Browser-suite note

The existing Playwright suite was started more than once while a prior test-owned Next server was being terminated by the execution environment. That caused a later run to reuse a dying server and report connection refusals. The unchanged unit and integration workflows passed, the production build passed, and every new route was independently smoke-tested against a fresh production server. A clean single-run Playwright execution should be performed in CI after deployment packaging.
