# ADR 0006: Human-gated atomic publication

## Status

Accepted

## Context

Source pages can be stale, misleading, ambiguous, or adversarial. A model or parser should not silently change public trust records.

## Decision

Every changed observation becomes an atomic pending claim. A staff reviewer approves or rejects each claim. High-impact claims require an administrator. Approval applies one predicate and creates a versioned before and after receipt in the same transaction.

## Consequences

- Every public mutation has a source, decision, actor, and version.
- Failed publication rolls back completely.
- Review throughput becomes a product constraint.
- Automation can prioritize and explain, but it cannot bypass the gate.
