# Intelligence remediation progress
Branch: intelligence-remediation. Plan: docs/INTELLIGENCE-AUDIT.md
- [x] T1 COA truthfulness — DONE (commit b44ca5b, 4 tests). Adversarial verifier found 1 missed surface:
      compound-level real_coas/real_purities counted self-published under "Independent lab tests" — CLOSED this commit.
- [ ] T2 purity = document read qualifier
- [x] T3 size-normalize vs-market — DONE. compound.medianPricePerMg (live, min-peer floor 3) + shared helpers
      compoundMedianPerMg/valueVsMarketPerMg; card badge + product-page panel ($/mg + null state) + compare cell.
      8 unit tests; full suite 387 green.
- [ ] T4 review confidence into verdict
- [ ] T5 matching fails safe (needs re-ingest)
- [ ] T6 (Tier 2) confidence dimension on Signal + verdict weighting
