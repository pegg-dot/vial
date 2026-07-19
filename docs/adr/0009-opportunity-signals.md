# ADR 0009: Persistent opportunity signals

## Status

Accepted

## Context

Normalized catalog data reveals second-order conditions such as price dispersion, evidence gaps, stale sources, thin availability, and concentration. These conditions are useful for product operations and public market legibility, but they must not become opaque rankings or product recommendations.

## Decision

Store opportunities as persistent signals with a stable semantic key.

Each signal includes:

- Signal type
- Target entity
- Title and summary
- Score and confidence
- Structured evidence
- Root event and event ID
- First-seen and last-seen time
- Lifecycle state

Repeated evaluation updates the same signal. Staff can mark it open, watching, resolved, or dismissed. Only an allowlisted subset appears publicly.

## Consequences

### Positive

- Repeated sweeps do not create duplicate cards.
- Staff can manage conditions over time.
- Every signal remains traceable.
- Public signals can stay narrow and clearly informational.
- Product teams can prioritize source, evidence, and onboarding work from the same graph.

### Negative

- Scores require transparent interpretation and future calibration.
- A resolved condition needs explicit reopening logic if it returns.
- Signals can become stale without scheduled reevaluation.
- The product must continue to prevent recommendation-like language.
