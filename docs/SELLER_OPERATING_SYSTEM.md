# VialGrade 4.0 seller operating system

## Purpose

VialGrade 4.0 makes legitimate seller onboarding self-serve without turning onboarding into a cosmetic checklist. Readiness is computed from work actually completed in the platform.

## Seller journey

```text
Create seller account
→ match an existing public company profile
→ complete business and operations information
→ connect a store or import a catalog
→ review canonical product matches
→ add batches and evidence
→ complete sandbox payment onboarding
→ accept current seller terms
→ submit for staff review
```

A seller may continue saving work in any order. Final submission remains blocked while required readiness dimensions are incomplete.

## Readiness model

Readiness is separated into eight dimensions:

1. Business identity
2. Operations
3. Catalog connection
4. Catalog matching
5. Evidence coverage
6. Payment onboarding
7. Team access
8. Seller agreement

VialGrade never collapses these dimensions into a claim that the seller or its products are safe.

## Connector registry

The connector registry has pluggable definitions for:

- Shopify
- WooCommerce
- CSV or spreadsheet import
- Website discovery
- Stripe Connect onboarding
- Generic signed webhooks
- VialGrade Seller MCP

The V4 repository contains deterministic sandbox implementations and adapter boundaries. Real credentials, external approval, and provider underwriting are not bundled.

## Catalog import

Every catalog import follows this sequence:

```text
Source connection
→ immutable import job
→ dry-run rows
→ canonical product matching
→ visible confidence and reasons
→ seller review
→ accepted seller-product records
```

Importing does not publish a public listing. Publication, product eligibility, and commerce activation remain separate controlled processes.

## Canonical matching

Matching uses VialGrade's V2 canonical graph and supports:

- Aliases
- Punctuation and spacing variants
- Compact compound names
- Product-title evidence
- Tags
- Quantity extraction
- Alternative candidates

Results are `auto_matched`, `needs_review`, or `unmatched`. Even an auto-match remains a reviewable proposal.

## Evidence workflow

Seller evidence is modeled separately from products and batches:

```text
Evidence document
→ extracted fields
→ proposed product or batch links
→ visible matching reasons
→ confirmed or rejected relationship
```

A document is not treated as proof of a physical vial's contents. VialGrade records what the document claims, who issued it, what it appears linked to, and whether that relationship has been reviewed.

## Inventory and orders

Inventory changes are immutable, idempotent events. Seller order views are tenant-scoped. Shipment creation checks order ownership and updates order state transactionally.

## API and automation

Seller automation supports:

- Session-authenticated seller APIs for the web application
- Scoped bearer tokens for approved operator integrations
- Tenant-scoped read and proposal endpoints
- Signed webhook endpoint configuration
- A stdio MCP server

Money movement, publication, approval, and eligibility decisions are not exposed as unconstrained tools.

## Security boundaries

- Every seller route is centrally protected.
- Every sensitive seller page and action requires a seller permission.
- Seller membership determines tenant scope.
- API tokens are hashed at rest and shown only once.
- Webhook secrets are hashed at rest and shown only once.
- Imports are idempotent.
- Inventory adjustments are idempotent.
- Automation creates proposals, not approvals.
- Staff seller oversight requires `commerce:read`.

## Production activation requirements

A real seller launch still requires:

- Signed seller agreement
- Identity and beneficial-owner verification
- Processor review and approval
- Product and jurisdiction eligibility
- Real connector credentials
- Real evidence and catalog review
- Fulfillment and return commitments
- Security and privacy review
