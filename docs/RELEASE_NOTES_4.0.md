# VIAL 4.0 release notes

## Seller operating system

VIAL 4.0 adds a complete seller workspace with self-serve onboarding, catalog and batch operations, evidence workflows, inventory, orders, disputes, payouts, support, analytics, health, teams, developer tools, and settings.

## Self-serve onboarding

Onboarding now advances from actual state rather than manually checked boxes. VIAL computes eight independent readiness dimensions and prevents final submission while required work remains incomplete.

## Connectors and imports

V4 adds connector definitions and sandbox adapters for Shopify, WooCommerce, CSV, website discovery, Stripe Connect, generic webhooks, and VIAL Seller MCP.

Catalog imports are dry-run first, idempotent, canonically matched, and reviewable. They never publish products automatically.

## Matching and evidence

Seller products use the V2 canonical graph for compound matching. Existing public business profiles can be proposed as matches without being claimed automatically.

Evidence documents can be linked to seller products and batches through explicit proposed, confirmed, or rejected relationships.

## Seller API and MCP

V4 adds hashed, scoped seller API tokens, tenant-scoped operator endpoints, signed webhook endpoint management, and a real stdio MCP server.

The MCP server can read seller state and prepare imports or evidence documents. It cannot publish, approve, activate commerce, or move money.

## Staff oversight

The new `/admin/sellers` workspace presents onboarding status, readiness, connections, catalog volume, documents, and dimension-level gaps.

## Verification

The V4 gate includes seller tests, a dedicated seller-operations audit, the inherited V1–V3 tests and audits, production build, role checks, structural accessibility, backup/restore, dependency audit, and clean-room archive verification.
