# ADR 0007: Controlled source refresh

## Status

Accepted

## Context

The provenance backend originally required staff to paste captured content. VIAL needs fresher records, but unrestricted browsing would introduce network, security, reproducibility, policy, and publication risks.

## Decision

Implement refresh as a policy-bound durable workflow.

Each source policy defines:

- Canonical source
- Target listing
- Transport
- Parser profile
- Schedule
- Hostname allowlist
- Allowed content types
- Timeout
- Maximum response size
- Retry state

The HTTP transport resolves and validates the destination before connecting and repeats validation after every redirect. Fixture transport provides deterministic source versions for local use and tests.

Fetched content can propose claims but cannot publish them.

## Consequences

### Positive

- Refresh behavior is reproducible and inspectable.
- SSRF and accidental internal-network access receive explicit controls.
- Source-specific behavior does not depend on prompt text.
- Retries and failures are durable.
- Tests can exercise the complete workflow without external network access.

### Negative

- Every real source requires policy configuration.
- The system does not discover arbitrary sources automatically.
- Terms, robots, copyright, and publication review still require governance outside the fetcher.
