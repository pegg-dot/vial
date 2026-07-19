# VIAL 6.0 release notes

## Evidence and laboratory network

VIAL 6.0 adds a complete fictional evidence operating layer that connects physical samples and laboratory work to public batch records.

## Laboratory operating system

A dedicated laboratory workspace now supports onboarding, orders, sample accessioning, custody, method scope, analytical runs, structured results, versioned reports, quality visibility, tokens, and MCP integration.

## Chain of custody

Sample custody is represented as an append-only, cryptographically linked event sequence. VIAL can verify the chain and identify the exact event where tampering begins.

## Structured results

Analytical observations are stored as structured results linked to a method version and run. Identity, purity, quantity, sterility, endotoxin, and other dimensions remain independent.

## Report lifecycle

Reports support issuance, supersession, correction, revocation, signed-payload hashes, document hashes, and lifecycle events. Historical versions remain accessible.

## Batch passports

Public passports link declared batches to samples, custody, methods, reports, results, conflicts, limitations, and sampling provenance. Product pages link to available passports.

## Independent sampling

V6 models vendor-selected, customer-sealed, blind-purchase, and multi-source programs. The fictional seed demonstrates a quantity conflict between separately sourced samples and leaves sterility and endotoxin explicitly unknown.

## APIs and MCP

Laboratory session APIs and scoped bearer APIs were added. The VIAL Laboratory MCP can read work and prepare result/report proposals, but cannot approve, issue, revoke, or publish.

## Security

- `/lab` is a centrally protected account family.
- Laboratory roles use granular permissions.
- Laboratory tokens are scoped, hashed, revocable, and tenant-bound.
- Seller, customer, staff, and laboratory sessions cannot cross account families.
- Report and passport publication remain outside MCP authority.

## Boundary

All laboratories, samples, methods, results, and reports are fictional. V6 demonstrates architecture and controls, not real analytical competence or product verification.
