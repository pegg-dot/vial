# Price-truth audits — 2026-08-29

Five read-only audits that preceded `docs/superpowers/specs/2026-08-29-vial-price-truth-design.md`.
Every code claim cites `file:line` at commit `b062199`; production numbers are from the public
`/api/v1/catalog` and `/status` at ~17:10Z that day (`A2-analyze.py` recomputes them from a saved
catalogue dump). They are evidence for the spec's decisions, not current documentation — the
HANDOFF is the living document.

- `A1` — the as-built price pipeline (cron topology, both price writers, the extractor's banner fallback, derivation, every render surface, test conventions)
- `A2` — what production actually held (75 umbrella-labs listings at $100 from an "ORDERS $100 OR MORE" banner; 151/221 histories banner values; freshness; `/status`)
- `A3` — how mature price trackers model observations; the Postgres shapes; peptide-market survey; display copy
- `A4` — operational health (stuck refresh jobs, false-green imports, disabled targets, never-retired listings, closed vendors probing "operating")
- `A5` — evidence coverage vs price history: why price history was the right next build
