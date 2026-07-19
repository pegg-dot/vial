# ADR 0005: Embedded PostgreSQL for local development

## Status

Accepted

## Context

The provenance milestone needs real relational transactions and PostgreSQL semantics, but the repository must remain runnable without external infrastructure.

## Decision

Use PGlite for local and test persistence. Use the `pg` pool adapter when `DATABASE_URL` is present.

## Consequences

- The same repository works immediately after installation.
- Tests can run in an in-memory PostgreSQL-compatible database.
- Production can use managed PostgreSQL without changing repository interfaces.
- Local PGlite is not treated as a serverless production database.
- Schema migrations remain a required future upgrade.
