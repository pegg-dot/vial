# VIAL Intelligence & Verification Audit — "Does the system know what it knows?"

**Thesis.** VIAL exists to replace the vendor's confident-but-unverified word with verified evidence.
But across the intelligence layer it commits the same sin it's meant to cure: it derives a claim from
a shallow heuristic and then **asserts it with the authority of a fact**, with no dimension for its own
certainty. When a heuristic misfires it doesn't fail toward "I don't know" — it states a confident
falsehood. The milligram bug was one instance of a systemic pattern.

**The cure already exists in this codebase — it's just not applied consistently.** Five places do it
right and are the templates for the rest:
- `parseTotalMg` (`src/lib/format.ts`) returns `undefined` when size is ambiguous → UI shows no $/mg.
- The price-drop badge traces to VIAL's own prior observed price (`review/repository.ts`).
- **Batch passports** (`ingest/live-passports.ts`) cap confidence, filter `is_independent=TRUE`, and
  print *"read from the document, not re-measured by VIAL… VIAL did not sample, seal, or observe
  custody."*
- `resolveActionToVendor` (`regulatory/actions.ts`) matches strictly or returns `null`.
- The reputation layer (`reputation/repository.ts`) filters `is_independent=TRUE`.

**The structural fix (one idea):** every derived claim carries a confidence/provenance tier —
*verified / derived / guessed / unknown* — that the verdict **weighs** (not decides-by-presence), the UI
**shows** (a guess can't wear a fact's clothes), and everything **fails toward "unknown."**

---

## The map — grouped by root cause, worst first

### A. The foundation is matched by loose string rules with no confidence gate (a wrong match silently poisons everything above it)
- **`matchCompound` accepts any ≥4-char substring** (`ingest/shopify-import.ts:25-45`). "BPC-157 ARG",
  "CJC-1295 DAC", single-named blends → filed under the base compound → wrong peers, $/mg, COAs. **SEV 5**
- **Batch↔COA match is global, not scoped to `compound_slug`, ≥4-char floor** (`verify/coa-cross-check.ts:131-140`,
  `verify/listing-trust.ts:57-77`). Shows a *different compound's* purity as "this exact batch," or brands an
  honest listing a counterfeit. Proven live (STL batch "2025-10-06" across 7 compounds). **SEV 5**
- **`matchVendor` bidirectional-substring, first-match-wins** (`ingest/lab-tests.ts:80-88`). COA → wrong
  vendor → inflates *their* "trusted." **SEV 4**
- **Enforcement matched by normalized name** (`regulatory/actions.ts` name path). Same-named stranger's DOJ
  action → "avoid" on an innocent vendor. **SEV 5** *(the domain path is the strict template)*

### B. The data already stores the truth — the read layer throws it away
- **`is_independent` ignored** (`coa-cross-check.ts:118-124`, `listing-trust.ts:103`, `catalog/repository.ts:24-25`)
  → a vendor's OWN self-published COA reads "Independently tested" and can drive "trusted." **SEV 5**
- **`compound_slug` ignored in the batch lookup** (root of A's batch bug). **SEV 5**
- **Review `confidence`/`reviewVolume` discarded** before the verdict (`vendors/[slug]/page.tsx:81` passes only
  `{sentiment}`) → one low-confidence sparse review forces "avoid." **SEV 5**
- **`purityBasis` (measured-here vs borrowed) computed then never shown** (`listing-trust.ts:136-138`) → "best
  value" crown on a borrowed compound-median purity. **SEV 4**

### C. The verdict treats a guess and a fact identically
- **Decides by presence, not weight** — any one item in `reasons.avoid` → "avoid" (`trust-graph.ts:139`). No
  confidence dimension. **SEV 5**
- **`Signal` has no reliability field** (`verify/index.ts:13`) → a regex guess renders with the identical red X
  as a verified FDA conviction; "Weighed across N signals" oversells. **SEV 5**

### D. Confident inference from single-shot / noisy sources
- **Vision-read purity** shown as "measured at 99.20%" with no uncertainty (`lab-tests.ts`, schema `NUMERIC(6,3)`).
  A misread (9.92→99.2) becomes an authoritative fact. **SEV 4**
- **Reddit classifier checks NEG before POS** (`ingest/reddit.ts:106-114`) → a post *defending* a vendor ("not a
  scam, legit") scores negative → "avoid." **SEV 5**
- **Site status from one un-retried probe** (`verify/vendor-status.ts:20-34`) → timeout/reset/500/SPA-shell →
  "offline/parked" → "avoid." **SEV 5**
- Storefront regex ("back online after downtime" → "risk signal"). **SEV 3**

### E. The size-blindness disease, still alive in the value layer
- **"vs market" runs on raw sticker prices, not per-mg** (`lib/curation.ts` median; `product-card.tsx:13`,
  `product-market-stats.tsx:33`, `compare/build.ts:78`). A 30mg bargain → "+300% · priciest" red; a 2mg ripoff →
  "−40%" green. **SEV 5**
- Vendor price index (per-mg but no min-peer guard). **SEV 3**
- "too cheap" 0.45×-median threshold — *more* trigger-happy after the mg fix; can brand real bulk deals fake. **SEV 3-4**

---

## Remediation plan

### Tier 1 — surgical, highest ROI ("stop discarding what you already store")
- [x] **T1. COA truthfulness** — scoped the batch match to `compound_slug` (+ floor ≥6); filtered `is_independent=TRUE`
  everywhere the UI says "independent" (cross-check, listing-trust, vendor coaCount/medianPurity). Read-time.
  *Adversarial verifier caught one missed surface — the **compound-level** `real_coas`/`real_purities` in
  `catalog/repository.ts:17-18` still counted self-published COAs under an "Independent lab tests" label (drove the
  compound-page tier chip, the `testedOnly` filter, and `mostVerified`). Now filtered too; card and page agree.*
  Residual (conservative, not fixed): ≥6 floor drops genuine 4-5-char batch codes; a NULL `compound_slug` on the
  vendor's own cited batch no longer batch-verifies; `coaStatusFrom` stays exported with a latent ≥4 gate; honest
  resellers citing a maker's real batch still read "borrowed" (pre-existing). All fail toward unknown.
- [x] **T2. Purity is a document read, not a measurement** — one canonical qualifier (`src/lib/provenance-copy.ts`,
  full + short forms) now rides every authoritative purity surface: the COA cross-check panel, the compound-page
  and vendor-page headline stats, and the product-page market panel's "real/active mg" note. Says the figure is
  read from the lab's certificate as issued — VIAL doesn't re-run the assay or sample the vial. The detailed
  `LabTestsPanel` (on all three detail pages) already carried the same discipline. Display-only, no logic change.
- [x] **T3. Size-normalize "vs market"** — every "vs market" verdict now runs on cost-per-mg, never sticker price.
  Added a live `compound.medianPricePerMg` (computed from `parseTotalMg`, min-peer floor of 3) + two shared pure
  helpers (`compoundMedianPerMg`, `valueVsMarketPerMg`) wired into the card badge, the product-page market panel
  (relabeled $/mg + a "size not comparable" null state), and the compare "Value vs market" cell. Fails toward
  no-badge whenever the size is unreadable or the market is thin. 8 unit tests lock the size-bug + fail-to-unknown.
  *Verifier caught a follow-up: compare's baseline skipped the min-peer floor and disagreed with the card/page on
  thin compounds (semaglutide) — fixed by sharing the snapshot `medianPricePerMg`. Residual (judgment, not fixed):
  the floor of 3 blanks the badge on ~20/60 compounds, skewed to GLP-1 blockbusters whose sizes `parseTotalMg`
  can't read — the real remedy is better size parsing (T5-adjacent), not lowering the floor.*
- [x] **T4. Review confidence into the verdict** — `composeVerdict` now weighs the buyer-review seam by
  `confidence`/`reviewVolume`, not sentiment alone. A negative/scam review only forces "avoid" when well-supported
  (high confidence OR moderate/heavy volume); a thin/low-confidence negative is CAUTION, not a verdict-ending avoid.
  Symmetrically, a thin positive no longer inflates trust. Threaded the two fields through all three VerdictInput
  construction sites (vendor page, `composeVerdictForVendorSlug`, directory) — the directory `redFlag` gate is the
  same composed verdict, so a lone sketchy review no longer sinks a vendor in the listing. Missing provenance =
  treated as not-well-supported (fail toward unknown). 1 new verify test + updated directory-risk cases.
  *Verifier hardening: (D1) the volume/confidence gate used raw string-equality and the seed had 3 out-of-enum
  values ("low"/"high") that silently read as not-well-supported — added `normalizeReviewVolume/Confidence` (synonym
  map, unknown→null) at the verdict + fixed the seed, so a gatherer typo can't disable scam detection. (D2) updated
  the directory doctrine comment. (R1, ACCEPTED) exactly one demo vendor, `cernum-biosciences`, flips avoid→caution
  (its only avoid-driver was a sparse/medium negative; its ~14 COA-integrity flags still yield caution) — this is the
  intended behavior, not a regression; whether a wall of self-published COAs should itself escalate past caution is a
  separate integrity-flag-weighting question. (R2, → T6) the community seam still forces avoid on one mention despite
  loaded counts — the same pattern, deferred to T6's reliability work.
- [ ] **T5. Matching fails safe** — `matchCompound`/`matchVendor` return "unmatched" on ambiguity (adopt
  `resolveActionToVendor`'s strict discipline: anchored/exact or null; reject salt/ester/DAC/blend absorption).
  Needs re-ingest.

### Tier 2 — structural
- [x] **T6. Confidence/provenance dimension** — `Signal` now carries a `confidence` tier (`verified` = a
  document/government record/hard shared identifier · `reported` = a third-party human account · `inferred` = a
  heuristic or single unretried probe). `composeVerdict` tags every one of its 10 seams, exposes a `verifiedCount`,
  and the vendor-page trust-graph renders a per-factor tier chip + an honest "N signals · M independently verified"
  line — so a regex read off a storefront can no longer render identically to a public FDA conviction (*verified ≠
  guessed*). The **community seam is now weighed by mention volume** exactly like reviews (closes the T4-verifier's
  R2): one thin r/Peptides mention is caution, not a verdict-ending "avoid"; counts threaded through all three
  construction sites (vendor page, `composeVerdictForVendorSlug`, directory query). 3 new tests.
  *Deliberately NOT done (owner decision, per no-destructive-changes): the protective avoid verdict is kept
  conservative — an `inferred` site-status/storefront signal still names the problem and can contribute to avoid;
  T6 makes its low reliability VISIBLE rather than silently downgrading a safety signal. Whether to bar `inferred`
  signals from solo-forcing avoid is a product call left to the owner.*

Every fix must FAIL TOWARD UNKNOWN and be adversarially verified for over-correction (a stricter matcher must still
accept the legitimate cases). Progress tracked in `.superpowers/sdd/progress.md`.
