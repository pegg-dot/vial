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
- [ ] **T1. COA truthfulness** — scope the batch match to `compound_slug` (+ floor ≥6); filter `is_independent=TRUE`
  everywhere the UI says "independent" (cross-check, listing-trust, vendor coaCount/medianPurity). Read-time.
- [ ] **T2. Purity is a document read, not a measurement** — qualify every displayed purity ("read from the
  certificate, not re-measured by VIAL"), copying the batch-passport pattern. Display-only.
- [ ] **T3. Size-normalize "vs market"** — compute the delta against the compound's median **$/mg**, not sticker;
  fail toward no-badge when the size is unknown. Add a min-peer guard.
- [ ] **T4. Review confidence into the verdict** — pass `confidence`/`reviewVolume`; a low-confidence/sparse
  negative must not single-handedly force "avoid."
- [ ] **T5. Matching fails safe** — `matchCompound`/`matchVendor` return "unmatched" on ambiguity (adopt
  `resolveActionToVendor`'s strict discipline: anchored/exact or null; reject salt/ester/DAC/blend absorption).
  Needs re-ingest.

### Tier 2 — structural
- [ ] **T6. Confidence/provenance dimension** on `Signal` and derived claims; the verdict **weighs** by confidence
  (no more decide-by-presence); the UI renders *verified ≠ guessed*; site-status/enforcement/reddit signals carry
  their reliability tier and can't alone force "avoid."

Every fix must FAIL TOWARD UNKNOWN and be adversarially verified for over-correction (a stricter matcher must still
accept the legitimate cases). Progress tracked in `.superpowers/sdd/progress.md`.
