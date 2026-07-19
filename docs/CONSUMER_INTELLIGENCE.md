# VIAL 3.0 consumer intelligence

VIAL 3.0 turns normalized market data into a durable consumer workspace. The system remembers explicit user choices across sessions without making medical or product-use recommendations.

## Core model

Consumer intelligence is built from first-party account records:

- explicit price and evidence preferences
- saved searches and execution history
- named and default comparison sessions
- followed vendors, compounds, and listings
- watchlists and decision events
- ranked in-product notifications
- deterministic market-change summaries
- visit state and quiet-hour preferences

## Personalization rules

Personalization is deterministic and explainable. Records are ranked using explicit preferences, followed entities, watchlist membership, evidence freshness, and price boundaries. Every ranked result exposes the reasons it appeared.

The system does not infer medical suitability, recommend compounds for bodily use, or hide market records that do not match a preference.

## Notification relevance

Notifications are generated from reviewed changes and account state. They are filtered by a user-controlled relevance threshold, deduplicated, and deferred during configured quiet hours. Delivery providers remain adapters; the in-product lifecycle is provider-independent.

## Privacy and isolation

Every consumer record is scoped to the authenticated principal. API routes require durable sessions, repository queries filter by user ID, and integration tests verify tenant isolation.

## Mobile retention

The authenticated mobile shell prioritizes For You, Search, Saved, Compare, and Account. It is designed as the web retention layer before a native SwiftUI client is introduced.
