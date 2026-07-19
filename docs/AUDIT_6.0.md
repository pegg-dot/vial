# VIAL 6.0 audit

## Scope

The V6 audit covers laboratory identity, method scope, onboarding, sampling programs, sample accessioning, custody integrity, analytical runs, structured results, report lifecycle, batch passports, conflicts, public verification, permissions, bearer APIs, MCP authority, seller/public/staff surfaces, and inherited V1–V5 regressions.

## Results

| Gate | Result |
|---|---:|
| ESLint | Passed |
| TypeScript | Passed |
| Unit tests | 32 passed |
| Integration tests | 36 passed in isolated suites |
| Total automated tests | 68 passed |
| V6 focused tests | 8 passed |
| Static security audit | Passed across 322 source files |
| Market-data audit | Passed |
| Consumer-intelligence audit | Passed |
| Seller operating-system audit | Passed |
| Seller MCP audit | Passed |
| V5 commerce audit | Passed |
| V6 evidence-network audit | Passed |
| Laboratory MCP live-client audit | Passed |
| Backup and restore drill | Passed |
| Dependency audit | 0 known vulnerabilities |
| Production build | Passed |
| Runtime role and tenant audit | Passed |
| Structural accessibility audit | Passed |
| Clean release installation | Passed |
| Clean release unit tests | 32 passed |
| Clean release integration tests | 36 passed in isolated suites |
| Clean release V6 audits | Passed |
| Clean release production build | Passed |

## V6 behaviors under test

- Public `/labs` remains public while `/lab/*` is protected.
- Laboratory sessions cannot enter customer, seller, commerce, or staff account families.
- Method competence and accreditation coverage remain method-scoped.
- Seeded custody chains verify successfully.
- Appended custody events preserve chain validity.
- Metadata tampering invalidates the chain at the altered event.
- Report corrections create new versions and supersede prior versions.
- Revocation preserves report history.
- Batch passports preserve independent observations, conflicts, and explicit unknowns.
- Scoped laboratory tokens cannot cross laboratories.
- Raw laboratory tokens are returned once in-page, never placed in URLs, and can be revoked.
- Read-only tokens cannot create proposals.
- MCP proposals cannot issue reports or publish passports.
- Public report verification exposes current lifecycle state.
- Seller passport visibility is organization-scoped.

## Build note

The release build performs an explicit `tsc --noEmit` gate before invoking Next. Next's duplicate internal TypeScript worker is skipped after that independent gate. Database-backed public evidence pages are forced dynamic so build-time rendering does not retain an embedded database handle.

## Environment limits

No real laboratory, accreditation body, analytical instrument, sample, report, or physical product was used. All evidence records are fictional. Real deployment requires direct laboratory verification, quality-system review, method and scope review, raw-data controls, sampler and logistics controls, and legal agreements.
