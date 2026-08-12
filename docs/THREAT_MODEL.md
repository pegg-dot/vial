# VialGrade 1.0 threat model

## Protected assets

- Customer and seller account data
- Staff permissions and sessions
- Seller tenant records
- Source snapshots and evidence claims
- Publication decisions and audit receipts
- Orders, refunds, disputes, and ledger records
- Operational secrets and provider credentials

## Trust boundaries

1. Public browser to Next.js application
2. Authenticated customer or seller to tenant-scoped application services
3. Staff browser to privileged operations
4. Application to PostgreSQL
5. Controlled fetcher to approved external sources
6. Application to future payment, tax, shipping, identity, and notification adapters

## Primary threats and controls

### Authentication bypass

Controls include signed versioned sessions, durable session lookup, expiration, revocation, central route enforcement, server-side guards, and production secrets that fail closed.

### Horizontal privilege escalation

Controls include ownership-scoped customer queries, seller membership resolution, seller-scoped repositories, explicit capability checks, and runtime role audits.

### Staff privilege escalation

Controls include capability-based authorization, administrator-only security and identity functions, durable audit events, and restricted mutation APIs.

### Cross-site request forgery and cross-origin mutation

Controls include strict same-site cookies, same-origin mutation checks in the proxy, and non-GET authorization at the server boundary.

### Session theft or replay

Controls include HttpOnly secure cookies in production, bounded lifetime, session IDs, database revocation, login history, and audit records. Device-bound sessions and passkeys remain future work.

### Source prompt injection and poisoned content

Controls include allowlisted source policies, captured content treated as untrusted data, bounded extraction schemas, deterministic publication rules, and mandatory human review.

### Server-side request forgery

Controls include protocol restrictions, DNS resolution, private and reserved address blocking, redirect revalidation, port restrictions, response limits, and timeouts.

### Financial inconsistency

Controls include idempotency, transactional order creation, reservation locks, immutable ledger entries, over-refund prevention, duplicate webhook suppression, and reconciliation checks.

### Supply-chain compromise

Controls include lockfiles, dependency audit gates, CI verification, static security checks, and containerized non-root runtime. Signed releases and software bills of materials remain future improvements.

### Data loss

Controls include versioned migrations, full embedded restore drills, PostgreSQL backup scripts, readiness probes, and documented recovery steps. Provider-level point-in-time recovery must be enabled in production.

## VialGrade 5 payment-specific threats

### Forged or duplicated provider events

Controls include provider signature verification, unique provider-event identifiers, signature-verification receipts, idempotent processing, safe replay, and browser-independent order finalization.

### Payment success without an order

Controls include prepared checkout attempts, durable inventory reservations, status polling, signed-event finalization, operational provider-event queues, and replay of verified events.

### Order creation before payment success

Controls include a two-stage lifecycle. Pending and action-required payment intents cannot create orders. Only synchronous trusted provider success or a verified success event can finalize.

### Duplicate orders, transfers, or reserves

Controls include unique idempotency keys, one order per checkout attempt, deterministic provider identifiers in sandbox, unique transfer identifiers, and one reserve per order and seller.

### Cross-account commerce access

Controls include customer-only cart, checkout, order, and checkout-status boundaries; seller tenant isolation; staff capability checks; and ownership-scoped queries.

### Accidental live activation

Controls include separate sandbox, test, and live modes; key-prefix validation; required webhook secret; explicit enable and acknowledgement gates; versioned activation policies; and per-seller, per-SKU, per-customer, per-jurisdiction checks.

## VialGrade 6 evidence-network threats

### Custody-history tampering

Controls include monotonically sequenced events, deterministic payload hashing, previous-event hashes, root event identifiers, append-only application behavior, and verification that reports the first broken event.

### Fabricated or altered reports

Controls include laboratory ownership, reviewed-result requirements, signed payload and document hashes, report versioning, supersession, revocation, lifecycle events, and a public verification endpoint.

### Overstated laboratory competence

Controls include method-scoped validation and accreditation coverage, explicit matrices and analytes, method versions, and public language that avoids universal laboratory approval.

### Sample-selection bias

Controls include explicit sampling models, sample-source identity, blind codes, sample-kit and seal records, custody history, and passport sampling levels.

### MCP or agent overreach

Controls include laboratory-scoped bearer tokens, narrow tool scopes, proposal-only write tools, no report-issue or passport-publish tools, and live-client authority audits.

### Conflict suppression

Controls include first-class evidence-conflict records, report history retention, dimension-level observations, and passport recomputation that marks conflict rather than averaging it away.
