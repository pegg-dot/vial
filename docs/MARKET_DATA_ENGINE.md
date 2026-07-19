# VIAL 2.0 market-data engine

## Purpose

The market-data engine converts fragmented observations into versioned, searchable, confidence-aware market records without hiding uncertainty.

## Pipeline

```text
Controlled source pilot
  -> immutable source snapshot
  -> parser contract
  -> atomic candidate claims
  -> canonical entity resolution
  -> verification and confidence
  -> human review
  -> publication receipt
  -> search index and freshness state
  -> source reliability and correction feedback
```

## Canonical identity

A source label is never treated as identity by itself. Entities have stable identifiers, aliases, relationships, and source references. The graph distinguishes commercial organizations, compounds, products, listings, batches, sources, reports, laboratories, and evidence dimensions.

## Parser promotion

A parser contract must have a versioned golden set and a passing benchmark. Promotion gates can require minimum example counts, F1, correction-rate limits, reviewer ownership, counsel approval, and failure recovery.

The included benchmark is intentionally small and fictional. It proves the architecture, not production accuracy.

## Confidence

Extractor confidence is not the same as truth probability. VIAL records calibration bins and correction outcomes so confidence can be compared with observed accuracy over time.

## Freshness

Freshness is predicate-specific. A price can become stale much sooner than a report date. Every freshness record identifies the source, last verification, next due time, age, policy, and state.

## Search

The ranker uses exact normalized matches, compact aliases, synonyms, token overlap, trigram similarity, quality signals, and bounded popularity. Result reasons are visible. Query evaluations measure reciprocal rank and recall at five.

## Safety and scope

All source pilots in this release are fictional fixtures. No real vendor source is approved, crawled, or promoted by this repository. Real pilots require legal review, source authorization where appropriate, reviewer ownership, and measured parser performance.
