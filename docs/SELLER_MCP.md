# VialGrade Seller MCP

## Purpose

The VialGrade Seller MCP gives an approved AI operator narrowly scoped tools for seller onboarding and operations. It is an automation interface, not an autonomous marketplace administrator.

## Transport

V4 implements a real Model Context Protocol server over stdio:

```bash
VIALGRADE_MCP_SELLER_TOKEN=vial_seller_... npm run mcp:seller
```

Stdio keeps local development and desktop-agent integrations simple. A remote Streamable HTTP deployment is intentionally deferred until production authentication, tenancy, rate limiting, and infrastructure controls are available.

## Authentication

The server requires a VialGrade seller API token created from `/seller/developer`.

Tokens are:

- Seller-scoped
- Scope-limited
- Hashed at rest
- Revocable
- Auditable through last-used timestamps

## Tools

The server exposes:

- `get_onboarding_status`
- `list_catalog`
- `match_product`
- `list_evidence_gaps`
- `prepare_catalog_import`
- `prepare_evidence_document`

## Safety model

Read tools may only access the authenticated seller tenant.

Mutation tools may only prepare:

- Import jobs
- Product-match proposals
- Evidence-document proposals

They cannot:

- Publish a public listing
- Approve evidence
- Activate commerce
- Change payment eligibility
- Transfer funds
- Approve a seller
- Override staff review

## REST counterpart

The same token boundary supports seller operator APIs:

```text
GET  /api/v1/seller/operator/catalog
POST /api/v1/seller/operator/match
POST /api/v1/seller/operator/imports
GET  /api/v1/seller/operator/evidence-gaps
```

This allows a seller to use MCP, a custom automation, or a conventional API client without changing the underlying permission model.

## Recommended production evolution

1. Keep proposal and approval capabilities separate.
2. Add per-tool rate limits and request receipts.
3. Add remote Streamable HTTP only behind strong tenant authentication.
4. Require explicit approval for any high-impact tool.
5. Evaluate every prompt, model, and tool revision against a fixed seller-operations dataset.
6. Retain deterministic server-side validation for all writes.
