# ADR 0002: Modular monolith before microservices

## Status

Accepted

## Context

Catalog, evidence, review, accounts, and policy have clear boundaries but will evolve quickly and share transactions.

## Decision

Use one TypeScript backend with domain modules and a single PostgreSQL database. Run long workflows in a durable worker process.

## Consequences

- Easier local development and migrations
- Strong transaction consistency
- Fewer deployment surfaces
- Services can be extracted later when actual scale or compliance boundaries justify it
