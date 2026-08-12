# Goal Anchor

## North star

Build the default interface people use to understand a fragmented peptide research market. A user should be able to compare listings, vendors, public documentation, evidence freshness, and known limitations in less than one minute.

## Primary user

A market participant who currently moves between vendor sites, community discussions, screenshots, spreadsheets, and certificates to answer basic questions about price, availability, documentation, and seller history.

## Core value

VialGrade turns disconnected claims into normalized, dated, source-aware records and makes every downstream consequence traceable.

The product is real when a user can answer:

- What is currently listed?
- Which company published the listing?
- What does the available evidence establish?
- What remains unknown?
- What changed since the last review?
- Which other records, metrics, alerts, or market conditions changed because of it?

## Product thesis

The visible product is a premium comparison experience. The durable product underneath it is a provenance and intelligence graph linking organizations, products, listings, controlled sources, immutable snapshots, atomic claims, review decisions, publication events, derived metrics, alerts, and opportunity signals.

## Non-goals

- Selling or routing users to peptide products
- Providing dosage, injection, reconstitution, or medical guidance
- Claiming that a product is safe
- Claiming physical verification without physical testing
- Operating a laboratory in the current phase
- Using an age gate or research-purpose modal as transaction eligibility
- Treating a market signal as a recommendation to buy or use a product
- Letting an agent silently publish or alter eligibility

## Constraints

- Public market data remains fictional in this repository.
- Checkout stays disabled.
- Agent stages can propose changes but cannot bypass human review.
- High-impact claims require an administrator.
- Public facts must retain source and publication provenance.
- Every derived alert or opportunity must retain its root event.
- Core catalog content remains server-rendered.
- Live HTTP fetching requires a per-source hostname allowlist and network controls.

## Completed phase

The controlled refresh and cascading intelligence milestone is complete.

A controlled source can now:

1. Enter a durable schedule.
2. Be fetched through a bounded transport or deterministic fixture.
3. Produce an immutable snapshot and diff.
4. Generate only changed atomic claims.
5. Enter human review.
6. Publish one approved field transactionally.
7. Recalculate compound and vendor metrics.
8. Generate reviewed watchlist alerts.
9. Open or update second-order opportunity signals.
10. Preserve the complete chain under one causal root.

## Current phase

Operational hardening and benchmarked coverage:

- Build a labeled extraction and change-detection benchmark.
- Add reviewer assignment, queue aging, and service-level targets.
- Expand source policy coverage while preserving per-domain controls.
- Add durable authenticated user watchlists and notification delivery.
- Add correction, source-dispute, and stale-signal resolution workflows.
- Replace startup schema initialization with versioned migrations.

## Goal check

Every feature should improve comparison quality, evidence clarity, freshness, record integrity, or the ability to understand downstream effects. Features that do not advance one of those outcomes belong in the parking lot.


## VialGrade 5.0 current phase

The current release adds approved-commerce architecture: provider onboarding, underwriting, activation decisions, processor intent and event handling, tax and fraud boundaries, transfers, reserves, settlement, and a fail-closed live-mode gate. Production transactions remain outside the current boundary until external approvals exist.
