# Product Requirements

## Product summary

VialGrade is an evidence-first market interface for fictional peptide research listings. It lets users search, compare, save, inspect, and monitor products without flattening documentation quality into one unexplained score.

The public interface is intentionally simple. The operational system underneath it preserves sources, snapshots, changes, human decisions, causal traces, alerts, and second-order market signals.

## Problem

The market is fragmented across independent vendor sites. Product names, quantities, forms, documentation, prices, and batch references are inconsistent. Buyers often substitute reputation, visual polish, or community comments for evidence because the underlying information is difficult to compare.

A second problem appears after the first record is normalized: one source change can affect much more than one listing. It can alter price dispersion, documentation coverage, vendor history, availability concentration, watchlist alerts, and the priority of future source work. Those effects are usually invisible.

## Jobs to be done

### Explore

When a user encounters a compound, they want a canonical page that separates research context from commercial listings.

### Compare

When several vendors list a similar item, the user wants normalized price, quantity, shipping, documentation, batch linkage, and evidence provenance on one screen.

### Inspect

When a vendor publishes a report, the user wants to know who issued it, when it was issued, which batch it references, how the sample was selected, and what the report did not test.

### Monitor

When a price, report, batch, seller identity, or availability state changes, the user wants an alert without repeating the full research process.

### Understand impact

When one record changes, staff want to know every downstream metric, alert, vendor-history entry, and opportunity signal it produced.

## Product principles

### Evidence is dimensional

Identity, quantity, impurity profile, sterility, endotoxin, sampling, laboratory competence, and legal status are different questions. They should never be collapsed into a universal safety score.

### Unknown is a valid state

Missing information is displayed as unknown. The interface does not infer a positive state from silence.

### Source and time are part of every fact

A production fact must have a source, observation time, review state, and publication state.

### Consequences are explicit

A reviewed change must not silently mutate hidden metrics. Every downstream effect receives a causal event and retains the original root.

### Signals are not recommendations

An opportunity signal describes information friction, source risk, evidence coverage, or market structure. It does not advise a user to buy or use a product.

### The interface stays simple

Complexity belongs in drawers, records, review systems, and traces. The top-level experience should remain understandable in seconds.

### Transaction eligibility is explicit

Listings have separate transaction modes:

```text
INFORMATION_ONLY
OUTBOUND_VENDOR_LINK
MARKETPLACE_CHECKOUT
BLOCKED
```

The current build implements only information display. It does not activate outbound or marketplace transactions.

## Core public flows

### Command search

1. User opens search from the header or hero.
2. User enters a compound, vendor, or listing.
3. Results are grouped by entity type.
4. Keyboard and pointer navigation lead to the canonical page.

### Market comparison

1. User opens the market.
2. User filters by compound, evidence state, availability, or vendor status.
3. User sorts by relevance, price, freshness, or documentation.
4. User saves records or adds up to four records to comparison.
5. The compare page shows one row per evidence dimension.

### Product inspection

1. User sees price, vendor, declared quantity, shipping, and evidence state.
2. User opens the evidence matrix.
3. Each row shows established, partial, or unknown.
4. The report record shows issuer, date, batch, sample origin, and confirmation.
5. The page states the limits of the fictional prototype.

### Watchlist

1. User saves a listing.
2. The browser stores the selection locally.
3. The watchlist page displays saved records.
4. The client requests reviewed alerts for the saved listing slugs.
5. Each alert links back to the changed public record.

### Public signals

1. User opens the signals page.
2. VialGrade shows selected cross-market conditions such as price dispersion, thin availability, evidence gaps, or concentration.
3. Each card states that it is an informational market signal, not a recommendation.
4. Sensitive operational signals remain staff-only.

## Staff flows

### Controlled source refresh

1. Staff define or inspect a source policy.
2. A manual action or schedule creates a durable job.
3. The transport validates the source before reading content.
4. VialGrade captures an immutable snapshot and diff.
5. Only changed claims enter review.
6. The job, attempt, tools, and events remain inspectable.

### Human publication

1. Reviewer sees current value, proposed value, source excerpt, confidence, and risk.
2. Reviewer approves or rejects one atomic claim.
3. High-impact claims require an administrator.
4. Approval creates one publication version and a causal cascade.

### Trace exploration

1. Staff open a root trace.
2. The event tree shows the source action, refresh, extraction, publication, metric changes, alerts, and opportunities.
3. Each event exposes actor, target, time, payload, and parent relation.

### Opportunity management

1. Staff run a whole-market sweep or receive signals from a publication cascade.
2. Signals are ranked by score and confidence.
3. Staff can watch, resolve, dismiss, or reopen a signal.
4. Stable keys prevent duplicate opportunities across repeated sweeps.

## Functional requirements

- Responsive layouts from 320 pixels through large desktop widths
- Server-rendered catalog and entity pages
- Database-backed server rendering for public catalog routes
- Search across all top-level entities
- Filter and sort without a full-page reload
- Persistent anonymous watchlist and compare state
- Reviewed change alerts for saved records
- Public non-recommendation market signals
- Staff source policies, jobs, attempts, signals, and traces
- Keyboard-accessible dialogs and navigation
- Clear focus states and reduced-motion behavior
- Product and entity metadata for discovery
- Human-readable evidence language
- No live transaction controls

## Nonfunctional requirements

- Lighthouse accessibility score of 95 or higher
- Lighthouse SEO score of 95 or higher
- No console errors during tested flows
- Deterministic production build without external font fetches
- Zero known npm audit vulnerabilities at handoff
- All public prototype data clearly labeled fictional
- No medical recommendations or human-use instructions
- Every live source policy explicitly allowlists hostnames and content types
- Every published change and derived effect retains a causal root
- Retry behavior is bounded and inspectable

## Early success metrics

For a live information product, track:

- Search-to-record open rate
- Comparison creation rate
- Evidence-drawer engagement
- Watchlist save rate
- Alert open and return rate
- Correction rate
- Data freshness coverage
- Source failure rate
- Median review queue age
- Opportunity resolution time
- Vendor profile claim rate

## Milestone status

### Provenance milestone

Complete. A fact can travel from an immutable source snapshot to a structured claim, review decision, publication event, and user-facing display without losing its run, source, reviewer, or before-and-after state.

### Controlled refresh milestone

Complete. A source can be scheduled, fetched through a bounded transport, diffed, parsed, reviewed, published, and converted into metrics, alerts, and second-order signals under one causal root.

### Production readiness

Not complete. Production still requires a labeled accuracy benchmark, versioned migrations, real source publication policies, source disputes and correction workflows, reviewer assignment, durable accounts, notification delivery, monitoring, and production access controls.


## VialGrade 5 commerce product

The consumer checkout is a policy-gated surface, not a universal buy button. It explains the active provider mode, merchant model, and individual activation checks before creating a provider payment. Seller and staff workspaces expose onboarding requirements, underwriting, activation decisions, provider events, transfers, reserves, and settlement without allowing sellers to approve themselves.
