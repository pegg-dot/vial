# ADR 0010: Production foundation before market expansion

Status: accepted

## Decision

VIAL 1.0 uses a modular Next.js application with managed PostgreSQL in deployment, centralized route authorization, database-backed sessions, explicit capabilities, versioned migrations, durable audit records, and provider abstractions.

PGlite remains a local development and automated-test adapter. It is not the deployed production database.

## Rationale

The application already had broad product coverage. The largest risk was inconsistent depth across authorization, identity, persistence, recovery, and operations. Centralizing these foundations reduces the chance that new pages or mutations bypass security or create unauditable state.

## Consequences

- Every protected route family is denied by default.
- Every sensitive mutation requires an explicit capability.
- Production refuses to start without PostgreSQL and strong secrets.
- Schema changes use tracked migrations.
- Build and runtime health are independently testable.
- Future VIAL 2.0 data work can build on a stable operational boundary.
