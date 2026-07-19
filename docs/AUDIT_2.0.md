# VIAL 2.0 audit

## Scope

This audit covers the canonical graph, parser benchmarks, source pilots, freshness, reliability, correction feedback, search index, search evaluations, authorization, accessibility, production compilation, and V1 regression behavior.

## Automated gates

- ESLint
- TypeScript
- V1 unit suite
- V1 integration suites, isolated by file
- V2 unit and integration suite
- Static security audit
- Market-data population and ranking audit
- Database backup and restore drill
- Dependency audit
- Production Next.js build
- Runtime role audit
- Structural accessibility audit

## V2 benchmark boundary

The seeded benchmark contains a small fictional golden set. It validates benchmark mechanics and edge cases, not production source accuracy. The seeded promotion gate requires a larger labeled set before any source can be treated as production-ready.

## External limitations

- No counsel-approved real source was connected
- No real-source parser accuracy was measured
- No production PostgreSQL service was available in the execution environment
- Visual Playwright navigation may remain environment-dependent; request-level and structural audits are included

## Seeded verification metrics

The deterministic fictional-fixture program produced:

- 73 canonical entities
- 160 confirmed relationships
- 39 aliases
- 12 report entities
- 4 laboratory entities
- 48 field-level freshness records
- 24 indexed public records
- 11 explicit synonym rules
- Catalog benchmark precision: 95.45%
- Catalog benchmark recall: 95.45%
- Catalog benchmark F1: 95.45%
- Exact-example accuracy: 80%
- Search mean reciprocal rank: 87.5%
- Search recall at five: 100%

These metrics validate the engine and test fixtures. They are not claims about performance on real external sources.
