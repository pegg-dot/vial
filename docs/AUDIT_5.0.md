# VIAL 5.0 audit

## Scope

The V5 audit covers provider adapters, activation policy, checkout preparation, synchronous and asynchronous payment completion, provider-event verification, inventory reservations, tax and fraud records, transfers, reserves, settlement, authorization, accessibility, and inherited V1–V4 regressions.

## Results

| Gate | Result |
|---|---:|
| ESLint | Passed |
| TypeScript | Passed |
| Unit tests | 29 passed |
| Integration tests | 31 passed |
| Total automated tests | 60 passed |
| V5 focused tests | 12 passed |
| Static security audit | Passed across 278 source files |
| Market-data audit | Passed |
| Consumer-intelligence audit | Passed |
| Seller operating-system audit | Passed |
| Live MCP client audit | Passed |
| V5 commerce audit | Passed |
| Backup and restore drill | Passed |
| Dependency audit | 0 known vulnerabilities |
| Production build | Passed |
| Runtime role and tenant audit | Passed |
| Structural accessibility audit | Passed |

## Verified gates

- ESLint
- TypeScript
- V5 unit and integration tests
- Inherited unit and isolated integration suites
- Static security audit
- Market-data audit
- Consumer-intelligence audit
- Seller operating-system audit
- Live MCP client audit
- V5 commerce audit
- Backup and restore drill
- Dependency audit
- Production build
- Runtime identity, role, permission, and tenant audit
- Structural accessibility audit
- Clean archive installation, manifest, tests, and build

## V5 behaviors under test

- Live keys rejected outside live mode
- Stripe mode requires secret, publishable, and webhook keys
- Independent live-mode gates
- Signed event verification and tamper rejection
- Direct seller-MoR checkout
- Multi-seller platform payment and allocations
- Idempotent payment intent, transfer, reserve, and order creation
- Tax and fraud decisions persisted separately
- Signed asynchronous success creates one order
- Safe event replay does not duplicate the order
- Signed payment failure releases inventory and creates no order
- Settlement invariant produces zero variance
- Seller/customer account-family separation

## Environment limits

No real processor credentials or real product transactions were used. The Stripe adapter compiles and is covered through contracts, environment checks, and the shared provider lifecycle. Actual test-mode provider behavior must be revalidated with a real Stripe test account and webhook endpoint before deployment.

The handoff environment may block local visual Chromium navigation. Runtime HTTP role checks and structural accessibility checks are the authoritative local gates; Playwright suites remain CI-ready.
