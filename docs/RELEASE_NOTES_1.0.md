# VIAL 1.0 release notes

VIAL 1.0 converts the prior sandbox into a hardened production foundation while preserving the fictional-data and test-commerce boundary.

## Identity and access

- Durable customer, seller, reviewer, finance, and administrator identities
- Database-backed sessions with signed, versioned envelopes
- Session expiration, revocation, and strict production cookie settings
- Central deny-by-default route perimeter for customer, seller, and staff families
- Explicit capability checks for review, catalog, commerce, finance, privacy, security, and administration
- Seller tenant isolation and customer ownership checks
- Persistent login attempts, rate limits, and security audit events

## Persistence and recovery

- Versioned schema migrations with current schema tracking
- Managed PostgreSQL adapter for deployment
- Serialized embedded PGlite adapter for local tests and development
- Complete embedded database corruption and restore drill
- PostgreSQL backup and restore scripts for deployed environments

## Operations and observability

- Liveness and readiness probes
- Readiness includes database access and schema version
- Request correlation identifiers
- Operational metric snapshots and durable alerts
- Review queue age, failed login pressure, source health, reconciliation variance, fraud, and support indicators
- Authenticated observability and security workspaces

## Delivery and security

- Production environment validation that fails closed
- Global CSP and defensive response headers
- Multi-stage container build with a non-root runtime user
- Docker Compose PostgreSQL contract
- GitHub Actions verification and PostgreSQL contract jobs
- Static security audit for route guards, mutation guards, dangerous sinks, and production secrets
- Runtime role audit across anonymous, customer, seller, reviewer, and administrator identities
- Structural accessibility audit across public and authenticated surfaces

## Boundary

The release does not activate real product sales, real payments, real payouts, external notifications, real seller feeds, physical laboratory verification, or medical guidance. Those require approved external systems and operating relationships.
