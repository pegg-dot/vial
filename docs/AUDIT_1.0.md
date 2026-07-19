# VIAL 1.0 audit record

Audit date: July 19, 2026

## Passed gates

| Gate | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Unit tests | 17 passed |
| Integration tests | 10 passed |
| Total automated tests | 27 passed |
| Static security audit | Passed across 178 source files |
| Dependency audit | 0 known vulnerabilities |
| Embedded database backup and restore | Passed |
| Production environment contract | Passed with valid values and failed closed when missing |
| Next.js production build | Passed |
| Runtime role audit | Passed for anonymous, customer, seller, reviewer, and administrator |
| Structural accessibility audit | Passed across public, customer, seller, and staff pages |

## Build result

The exact release source completed Webpack compilation, TypeScript validation, page-data collection, static page generation, optimization, and build trace collection with status 0.

## Browser audit limitation

Playwright request-context tests passed for the public health route and central admin perimeter. Browser page navigation was blocked by the host Chromium policy with `ERR_BLOCKED_BY_ADMINISTRATOR` for localhost URLs. The full browser suites remain in the repository and run in GitHub Actions after installing Playwright Chromium.

Equivalent production-server checks were completed in this environment through:

- Real credential login calls
- HTTP role and permission assertions
- Public and protected route checks
- Mutation authorization checks
- Structural HTML accessibility checks

This is an environment limitation, not a claimed browser pass.

## PostgreSQL limitation

Docker, `psql`, and `pg_dump` are not installed in the handoff environment. The repository includes:

- A managed PostgreSQL runtime adapter
- A PostgreSQL service contract in GitHub Actions
- Docker Compose for local integration
- Production environment validation
- Backup and restore scripts

The PostgreSQL contract job should be treated as a required deployment gate.

## Security findings resolved during V1

- Centralized route authorization replaced page-by-page perimeter reliance
- Mutation authorization moved from inconsistent role names to explicit capabilities
- Durable session storage and revocation replaced isolated cookie-only identity
- Login throttling and audit receipts were added
- Seller and customer horizontal access boundaries were added
- Embedded database concurrency was serialized after a deadlock was reproduced in identity tests
- Build-time embedded database flags were isolated from PostgreSQL-backed builds

## Remaining production requirements

Before public deployment with real users, complete external penetration testing, managed secret provisioning, PostgreSQL restore drills in the chosen provider, alert delivery integration, and processor or legal underwriting for any commerce activation.
