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
- [~] **T5. Matching fails safe** — PARTIAL, scoped down after review:
  - **DONE (`matchVendor`, `ingest/lab-tests.ts`)** — replaced first-match-wins (which handed a COA to whichever
    vendor iterated first, inflating its "independently tested") with **most-specific-match**: keep the longest
    key overlap per vendor, take the clear winner, and **fail toward null on a genuine tie** so an ambiguous
    certificate stays attributed at the compound level rather than to a confidently-wrong vendor. Order-independent.
    3 tests. Fail-safe, no data loss (a null just means unattributed).
  - **DEFERRED (`matchCompound`) — OWNER DECISION.** The audit flagged variant absorption ("CJC-1295 DAC" →
    `cjc-1295`) as wrong, but the codebase's own test (`market-ingest.test.ts:17`) *deliberately* treats it as
    correct ("variant, still one compound"), and blends already return null. An aggressive salt/ester/DAC/blend
    rejection would (a) contradict that owner-endorsed design, (b) only take effect on a re-ingest (the owner's
    lane), and (c) risk silently DROPPING real listings from the live catalog. Per no-destructive-changes, this is
    left as an explicit owner call rather than force-shipped. If pursued: tokenize the title, require a
    token-boundary match, and treat a distinct-molecule modifier (DAC) with no exact compound as unmatched.
  - Both matchers only affect FUTURE ingests; a re-ingest (owner's lane) is required to re-attribute existing rows.

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
  *Verifier hardening: (D1) the two ABSENCE branches ("no enforcement record", "no lab tests") were wrongly tagged
  `verified` — so a blank vendor showed a green "Verified" chip on a gap and "2 signals · 2 verified" (the exact
  overselling T6 targets). Absences are now untagged; `verifiedCount` counts only real records (a clean-slate
  vendor now reads 0 verified). (D2) the `/verify` tool rendered the same factors WITHOUT the tier — lifted
  `TierChip` to a shared component and rendered it there too, so a guess can't wear a fact's clothes on either
  surface. (tests) the community tests were rebuilt to use only inputs the real writer (`sentimentOf`, now exported)
  can produce, and pin the coupling — a lone mention resolves to "mixed" and yields no community factor, so no
  single mention can force avoid. Threaded `positiveCount` to the directory too, removing a page-vs-directory
  divergence.*

Every fix must FAIL TOWARD UNKNOWN and be adversarially verified for over-correction (a stricter matcher must still
accept the legitimate cases). Progress tracked in `.superpowers/sdd/progress.md`.

---

## Final whole-branch verification (pre-deploy)

A 20-agent verification workflow (gate → 5 parallel arc-reviewers → adversarial confirmation of every finding)
ran the full branch against this doc + the live server. Gate: lint / tsc / full suite all green. It confirmed the
enumerated T1–T6 + coherence + consumer deliverables landed and are correct live, and surfaced **9 real defects**,
all now FIXED (each with a regression test + live re-check):

- **[fixed] buyer-read fabricated a price clearance** it never computed — a null `priceFlag` means "cleared" only
  when the detector actually ran; an unreadable size / thin market left it null with no evaluation, yet the card
  still printed "price within normal range" on 243/522 listings. Now gated on `priceAssessable`; unassessable →
  honest "we couldn't place this price." (The exact assert-from-absence sin, in our own new code.)
- **[fixed] buyer-read low-purity headline** said "No independent test … yet" while the same card + badge + COA
  panel + matrix all showed a test that measured below claim — a headline branch now acknowledges it.
- **[fixed] `verify/index.ts` coaSignal** counted lab records without `is_independent` yet labeled them
  "Independent COAs" (green) on the /verify unknown-domain path — self-published read as third-party. Filtered.
- **[fixed] borrowed-certificate (counterfeit) branch** matched foreign SELF-PUBLISHED records, so an editable COA
  sharing a date-format batch code could drive a false "cert mismatch." Now requires `is_independent` (coa-cross-check + listing-trust).
- **[fixed] `matchVendor`** ranked specificity by the vendor key's length, not the actual overlap, so a short
  ambiguous manufacturer token was confidently attributed instead of failing to null. Ranks by overlap now.
- **[fixed] `vendorPriceIndex`** had no min-peer floor → a confident "±% vs market" on a 1–2 listing market the
  compound page refuses to judge. Same `MIN_PERMG_PEERS` floor applied.
- **[fixed] PriceLeaderboard "Tested purity"** built from all lab rows (self-published could show as
  independent-tested purity). Filtered `is_independent`.
- **[fixed] vendor `latest_tested`** wasn't `is_independent`-filtered like its sibling coaCount → a
  self-published-only vendor showed "last tested" beside "0 independent tests." Filtered.
- **[fixed] /verify community check** flagged on a SINGLE negative post → now requires ≥2 (matches T6's stored-seam
  gate); a lone complaint is neutral-with-a-note. (Reddit path is inert without creds; classifyPost NEG-before-POS
  ordering is the deferred audit item D, noted below.)

**Deferred residuals (documented, not defects in scope):**
- `cascade.ts` Curator price-outlier signal is still on size-blind sticker median — an INTERNAL opportunity signal,
  not a consumer "vs market" verdict; T3 was scoped to card/page/compare. Same disease, different subsystem; left for
  a future intelligence-layer pass.
- `compound.medianPricePerMg` is snapshot-computed and null on single-record fetches (`getCompoundBySlug`) — verified
  no surface reads it off that path (ProductCard uses the snapshot); intentional, safe.
- Audit group D (reddit classifier NEG-before-POS; single-probe site-status) remains as originally scoped-out; the
  live /verify community *volume* gate is now aligned, the classifier ordering is a deeper reddit change left deferred.
