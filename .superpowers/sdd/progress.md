# Intelligence remediation progress
Branch: intelligence-remediation. Plan: docs/INTELLIGENCE-AUDIT.md
- [x] T1 COA truthfulness — DONE (commit b44ca5b, 4 tests). Adversarial verifier found 1 missed surface:
      compound-level real_coas/real_purities counted self-published under "Independent lab tests" — CLOSED this commit.
- [x] T2 purity = document read qualifier — DONE. Canonical PURITY_PROVENANCE (lib/provenance-copy.ts) on COA
      panel + compound/vendor headline stats + product market-stats note. Display-only. tsc+lint clean.
- [x] T3 size-normalize vs-market — DONE (commit 5a9327a). compound.medianPricePerMg (live, min-peer floor 3) +
      shared helpers compoundMedianPerMg/valueVsMarketPerMg; card badge + product-page panel ($/mg + null state) +
      compare cell. 8 unit tests. Verifier found compare skipped the floor → fixed (commit 93ef915, share snapshot median).
- [x] T4 review confidence into verdict — DONE (472cf83) + hardened (79f522f: normalize volume/confidence,
      fail-safe vs gatherer typos; fixed 3 seed rows; D2 comment). Verifier: 2 defects fixed, R1 accepted (cernum).
- [ ] T5 matching fails safe (needs re-ingest) — DEFERRED (domain-risky; re-ingest is owner's lane; see audit note)
- [x] T6 (Tier 2) confidence dimension on Signal + verdict weighting — DONE. Signal.confidence tier
      (verified/reported/inferred); composeVerdict tags all 10 seams + verifiedCount; vendor-page tier chips +
      honest "N signals · M verified"; community seam now volume-weighed (closes verifier R2). Full suite 392 green.
