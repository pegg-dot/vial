# VialGrade changelog

## 5.0.0 - Approved commerce architecture

- Added processor-neutral payment, tax, and fraud adapter contracts.
- Added mock and Stripe Connect payment implementations with separate sandbox, test, and live modes.
- Added hosted provider onboarding, capability synchronization, underwriting reviews, and seller payment readiness.
- Added versioned activation decisions across seller, SKU, customer type, jurisdiction, evidence, inventory, and merchant model.
- Added direct seller-charge and platform separate-charge models with explicit merchant-of-record state.
- Added prepared checkout attempts, inventory reservations, asynchronous Payment Element support, signed webhook finalization, failure release, deduplication, and safe replay.
- Added provider payment intents, transfers, rolling reserves, tax transactions, fraud decisions, settlement runs, and activation receipts.
- Added customer-only commerce boundaries and immutable ledger-backed reconciliation.
- Added seller and staff payment, underwriting, activation, settlement, and provider-event workspaces.
- Added V5-specific unit, integration, commerce, role, accessibility, environment, and clean-release gates.

## 4.0.0 - Seller operating system

- Added self-serve seller onboarding with eight independent readiness dimensions.
- Added existing-business matching and canonical product matching without automatic claiming or publication.
- Added Shopify, WooCommerce, CSV, website-discovery, Stripe Connect, webhook, and MCP adapter boundaries.
- Added dry-run catalog imports, product and batch management, evidence linking, inventory events, orders, disputes, payouts, support, analytics, health, teams, and settings.
- Added scoped seller API tokens, tenant-scoped operator APIs, signed webhook endpoint management, and a real stdio MCP server.
- Added staff seller-readiness oversight and V4-specific security, role, accessibility, and seller-operations audits.

## 3.0.0 - Consumer intelligence

- Added personalized market ranking with transparent deterministic reasons.
- Added durable saved searches, cross-device comparisons, follows, and decision history.
- Added explicit price, evidence, relevance, quiet-hour, and digest preferences.
- Added deterministic change summaries and relevance-ranked in-product notifications.
- Added database-backed watchlists, mobile retention navigation, consumer APIs, and a staff intelligence dashboard.
- Added tenant-isolation, quiet-hour, persistence, ranking, runtime-role, accessibility, and clean-release verification.

## 1.0.0 - Production foundation

- Added durable customer, seller, and staff accounts with database-backed revocable sessions.
- Added a deny-by-default route perimeter and explicit capability authorization.
- Added customer ownership checks and seller tenant isolation.
- Added versioned migrations, production PostgreSQL validation, and serialized local PGlite access.
- Added login throttling, security audit events, liveness, readiness, metrics, and operational alerts.
- Added CI, a PostgreSQL contract job, a non-root container, backup and restore tools, and release runbooks.
- Added runtime role audits, structural accessibility audits, static security audits, and production build gates.
- Preserved fictional data, sandbox commerce, and the prohibition on accidental production activation.

## 0.7.1 — Central admin authentication perimeter

- Added a single `src/proxy.ts` authentication boundary for every `/admin/*` route except `/admin/login`.
- Extracted signed staff-cookie verification into a shared pure module.
- Added route-wide redirect regression coverage, future-route matcher coverage, and tampered/expired-cookie tests.
- Added an explicit administrator check to the scenario mutation Server Action.

# Changelog

## 0.3.0 - Controlled refresh and cascading intelligence

### Added

- Allowlisted HTTP fetcher with DNS resolution, private and reserved network blocking, redirect revalidation, response size limits, content type controls, and timeouts
- Durable refresh policies, jobs, attempts, exponential retry, conditional request metadata, and an authenticated cron route
- Controlled multi-version source fixtures for deterministic refresh simulations
- Source-specific parser profiles and immutable snapshot diffs
- One-root causal event graph spanning source changes, refreshes, claims, publications, metric recomputation, alerts, and opportunity signals
- Compound and vendor metric snapshots attached to the event that produced them
- Reviewed watchlist alerts for price, batch, availability, shipping, and document changes
- Staff source-refresh console, opportunity workspace, and causal trace explorer
- Public market-signals page with explicit non-recommendation language
- Opportunity lifecycle states: open, watching, resolved, and dismissed
- Derived signal taxonomy for evidence gaps, price dispersion, thin availability, source fragility, vendor onboarding, batch-document gaps, issuer concentration, and supply concentration
- Integration coverage for the complete source-to-signal cascade and single-claim scheduler behavior

### Changed

- Source ingestion now stores parser profile, capture mode, refresh metadata, and snapshot diffs
- Publication receipts now retain the root causal event that led to the reviewed mutation
- Vendor history and compound metrics are recalculated as children of the publication event
- The public watchlist now includes a reviewed change feed
- Operations pages now report refresh, trace, alert, metric, and opportunity state
- The API contract is version 0.3 and includes reviewed listing alerts
- Vitest integration files run serially with explicit timeouts to avoid embedded database contention

### Preserved boundaries

- All market data, source fixtures, companies, laboratories, and products remain fictional
- Checkout, seller links, dosage guidance, injection guidance, and medical recommendations remain disabled
- Opportunity signals describe information and market-structure conditions, not products to buy or use
- AI and extraction code cannot publish changes without human review
- Document inspection is not presented as physical-vial verification

## 0.2.0 - Provenance backend

### Added

- PostgreSQL-compatible persistence with local PGlite and managed `pg` adapters
- Staff authentication with administrator and reviewer roles
- Source and immutable snapshot records
- Idempotent source-ingestion workflow
- Scout, Clerk, Resolver, Verifier, and Auditor tool receipts
- Bounded deterministic claim extraction
- Human review queue with high-impact role gates
- Atomic publication transactions and versioned receipts
- Database-backed public catalog and live operations page
- Health, catalog, run, and OpenAPI endpoints
- Unit, integration, and full staff browser tests
- Staff workspace screenshots and expanded Lighthouse coverage

### Changed

- Public pages read from the database projection rather than direct seed arrays
- The operations page displays real local workflow records
- All important routes are dynamic server-rendered views
- Documentation reflects the implemented backend rather than a future architecture

### Preserved boundaries

- All market data remains fictional
- Checkout and seller links remain disabled
- No medical, dosage, injection, or reconstitution guidance exists
- No physical-vial verification claim is made

## 0.4.0

- Added compound and vendor browse hubs.
- Added evidence library and public reviewed-change ledger.
- Added account preferences, about, help, status, and legal pages.
- Expanded desktop and mobile navigation and footer information architecture.
- Added a staff quality dashboard for parser performance and review-queue aging.
- Expanded sitemap coverage and release documentation.

## 0.5.0 — Commerce sandbox
- Added mock Connect-style seller accounts and capability states.
- Added SKU-level commerce eligibility and production-disabled policy gates.
- Added database-backed carts, multi-seller checkout, idempotent payment attempts, orders, ledger entries, refunds, and disputes.
- Added customer cart, checkout, confirmation, and order-history surfaces.
- Added seller onboarding, dashboard, payouts, and disputes surfaces.
- Added commerce and finance administration pages.

## 0.7.0

- Added internal users, notifications, support cases, review moderation, policy versions, fraud cases, analytics events, feature flags, agent evaluations, privacy requests, seller drafts, seller teams, and scenario runs.
- Added customer notification and security pages.
- Added seller catalog, orders, and team pages.
- Added staff identity, support, moderation, policy, fraud, analytics, agent evaluation, privacy, and scenario workspaces.
- Added an executable sandbox scenario action and internal-operations integration test.

## 2.0.0

- Added the canonical market entity graph and entity resolution.
- Added source pilots, parser contracts, golden-set benchmarks, confidence calibration, corrections, freshness, and reliability.
- Added deterministic hybrid market search and ranking evaluation.
- Added public and staff V2 operating surfaces.

## 6.0.0 - Evidence and laboratory network

- Added laboratory identities, teams, onboarding, quality posture, and method-scoped competence records.
- Added testing programs, test orders, sample kits, sample accessioning, and append-only hash-chained custody.
- Added analytical runs, structured reviewed results, raw-data hashes, system suitability, and deviations.
- Added versioned report issuance, correction, supersession, revocation, lifecycle events, and public verification.
- Added multidimensional batch passports with sampling provenance, report history, conflicts, and explicit unknowns.
- Added public laboratory, independent-testing, and batch-passport experiences plus product passport links.
- Added laboratory, seller, and staff evidence operating surfaces.
- Added scoped laboratory APIs and a proposal-only MCP server.
- Added laboratory account-family isolation, granular permissions, live MCP auditing, evidence-network auditing, and custody tamper tests.
