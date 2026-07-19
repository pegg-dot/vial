# VIAL 4.0 audit

## Scope

This audit covers the VIAL 4.0 seller operating system and its interaction with the inherited V1 production foundation, V2 market-data engine, V3 consumer intelligence, and commerce sandbox.

## Security invariants

- Seller routes require a durable seller session.
- Seller actions require explicit seller permissions.
- Seller data is tenant-scoped by membership.
- Staff oversight is protected by `commerce:read`.
- Seller API tokens are hashed, scoped, revocable, and tenant-bound.
- Webhook secrets are hashed and shown only once.
- Catalog imports are idempotent.
- Inventory changes are idempotent.
- MCP and operator APIs create proposals but cannot publish or approve.
- Commerce remains sandbox-only.

## Automated gates

The release gate runs:

```bash
npm run lint
npm run typecheck
npm run test:all
npm run audit:security
npm run audit:market-data
npm run audit:consumer-intelligence
npm run audit:seller-ops
npm run audit:seller-mcp
npm run db:backup-drill
npm audit --audit-level=high
npm run build
npm run audit:roles
npm run audit:accessibility
```

## Seller-specific audit coverage

- Connector registry is complete.
- Eight readiness dimensions are populated.
- Compact compound aliases resolve canonically.
- Existing business matching remains proposal-only.
- Repeated imports return the existing import job.
- Imported rows remain reviewable.
- Evidence workspace is populated.
- Scoped tokens authenticate only their seller.
- Webhook sandbox deliveries are recorded.
- No seller workflow automatically publishes a product.
- A real MCP client can connect over stdio, list all tools, read seller state, resolve a canonical product, and create a proposal-only import.

## Runtime role coverage

The production-server audit checks:

- `/sell` is public.
- Seller pages redirect anonymous and customer users.
- Seller users can access their workspace.
- Seller users cannot access staff pages.
- Reviewers cannot access seller administration.
- Administrators can access seller administration.
- Missing and invalid seller bearer tokens fail.
- A valid read-only token can read the catalog.
- The same token cannot call a proposal endpoint without the required scope.

## Accessibility coverage

Structural accessibility checks include the public seller landing page, all seller workspaces, and staff seller oversight. The audit checks page titles, one primary heading, form labels, accessible button names, image alternatives, and duplicate IDs.

## External boundary

The V4 implementation does not claim a live Shopify, WooCommerce, Stripe, laboratory, or identity-verification integration. Those systems require external credentials, approval, contracts, and production infrastructure.

## Final verification results

| Gate | Result |
|---|---:|
| ESLint | Passed |
| TypeScript | Passed |
| Unit tests | 23 passed |
| Integration tests | 25 passed |
| Total automated tests | 48 passed |
| Seller operating-system tests | 8 passed |
| Static security audit | Passed across 254 source files |
| Market-data audit | Passed |
| Consumer-intelligence audit | Passed |
| Seller-operations audit | Passed |
| Live stdio MCP client audit | Passed, 6 tools |
| Backup and restore drill | Passed |
| Dependency audit | 0 known vulnerabilities on successful registry response |
| Production build | Passed |
| Runtime role and tenant audit | Passed |
| Structural accessibility audit | Passed |

One complete `verify:v4` attempt reached the dependency-audit step and was interrupted by a transient registry `502 Bad Gateway`. The same lockfile had already returned zero known vulnerabilities in a successful audit. The build, role audit, and accessibility audit were rerun separately and passed.
