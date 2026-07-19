# ADR 0008: One-root causal event graph

## Status

Accepted

## Context

One reviewed listing change can affect compound metrics, vendor history, watchlist alerts, and market signals. Updating those records without explicit lineage would make the system difficult to audit and could create inconsistent side effects.

## Decision

Represent every operational trigger and downstream effect as a typed domain event.

Each event stores:

- Root event ID
- Parent event ID
- Event type
- Entity type and ID
- Actor
- Structured payload
- Time

Every child event inherits the original root. Typed edges make relationships explicit. Publications caused by refreshes attach to the upstream root through the claim and run metadata.

Immediate publication effects occur inside the same database transaction.

## Consequences

### Positive

- A staff user can reconstruct the complete source-to-signal chain.
- Alerts and opportunities cannot lose their origin.
- Duplicate roots are easier to detect.
- Metrics can be tied to the exact event that produced them.
- Future notification and dispute systems can reference stable lineage.

### Negative

- More records are written for each publication.
- Event payload schemas require discipline.
- Long traces need progressive UI and future archival policy.
