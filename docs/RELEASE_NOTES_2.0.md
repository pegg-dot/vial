# VIAL 2.0 release notes

## Added

- Schema migration 4 for the market-data engine
- Canonical entities, aliases, relationships, and resolution cases
- Reports, laboratories, batches, sources, and evidence-dimension graph edges
- Source-pilot registry and promotion gates
- Versioned parser contracts
- Golden benchmark datasets and examples
- Benchmark run history with precision, recall, F1, and exact accuracy
- Confidence calibration records
- Correction feedback records
- Field-level freshness policies and status
- Source reliability snapshots
- Search synonyms, canonical search documents, query logs, and evaluations
- Public hybrid search page and JSON endpoint
- Entity graph, benchmark, data-quality, and search-quality staff dashboards
- Deterministic market-data audit
- Isolated integration-test runner

## Changed

- Public navigation includes the production-style search surface
- Search hero routes to the canonical search experience
- Schema version increased from 3 to 4
- V2 verification gate includes market-data audit

## Boundaries

- Source pilots are fictional fixtures
- No real vendor crawling is enabled
- No source can be promoted without external approval and benchmark requirements
- Search does not recommend human use or product suitability
