# ADR 0003: Commerce is a policy-gated module

## Status

Accepted

## Context

A comparison product and a transaction platform have different legal, payment, seller, support, and liability roles.

## Decision

Model transaction state on every listing, but ship the prototype in information-only mode. Checkout requires explicit product, seller, customer, jurisdiction, processor, and legal-policy eligibility.

## Consequences

- The interface can demonstrate the future marketplace shape
- No hidden or accidental live transaction path exists
- Commerce cannot be activated through a cosmetic modal or button change
