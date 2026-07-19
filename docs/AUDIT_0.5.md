# VIAL 0.5 audit

## Results

- ESLint: passed
- Unit and integration tests: 11 passed
- Commerce integration test: passed
- Production TypeScript build: passed
- npm audit: 0 known vulnerabilities
- HTTP route smoke checks: `/sell`, `/seller`, `/cart`, `/checkout`, `/account/orders`, and `/admin/login` returned 200
- API commerce smoke flow: passed

## API commerce smoke flow

1. Created a dedicated customer cart.
2. Added two units of a sandbox-eligible fictional listing.
3. Confirmed server-calculated subtotal, per-seller shipping, platform fee, tax, and total.
4. Submitted a mock checkout attempt with an idempotency key.
5. Received one test order identifier.
6. Retrieved the persisted order and seller line through the order API.
7. Confirmed that no card data or real payment processor was involved.

## Environmental note

A Chromium process in the final container was blocked from local URLs by an administrator browser policy. Browser screenshots were therefore not counted as release evidence. Earlier browser testing was replaced with direct HTTP route checks, a full API transaction smoke test, the integration suite, and the production build.
