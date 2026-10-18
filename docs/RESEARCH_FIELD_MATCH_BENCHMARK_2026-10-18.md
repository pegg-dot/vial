# Clinical registry association corpus: first-pass benchmark

**Captured:** 2026-10-18, from official ClinicalTrials.gov v2 study records.

**Goal:** prevent VialGrade Intelligence from silently confusing a keyword hit with a registered intervention. This is an engineering benchmark for **where a compound name/code appears in registry metadata**, NOT an independent scientific relevance/clinical quality benchmark.

## What was actually built

- tests/fixtures/clinical-trial-association-corpus.json: 45 topic-study cases, 44 distinct NCT IDs, across Retatrutide, Cagrilintide and Tirzepatide. Stores official study ID and URL, brief/official title and intervention name/other-name fields only. No participants, accounts, vendor records, shopping data, saved searches or individual histories.
- tests/unit/research-identity-registry-corpus.test.ts: pins known field-level examples as regression cases (including negatives, combination names and shared multi-asset trials).
- scripts/verify-research-identity-corpus.mjs: offline schema/classifier check by default, and an explicit opt-in --live re-fetch of the same 44 official study IDs to detect classification changes or metadata drift. Four concurrent requests max, no database writes, no automatic ground-truth promotion.
- UI: an additional **client-side registry field match filter** inside the existing eight-record dossier sample. It does NOT expand upstream searches or rank clinical outcomes. Selecting a named field is separate from viewing scholarly publications, and changing back to publications clears the filter.

### Distribution of pinned first-pass cases

| Field-based label | Cases | What that label means |
| --- | ---: | --- |
| Named in intervention metadata | 29 | A literal compound name/development code occurs in a registered intervention name or other name; that can include comparators or multi-agent products |
| Named in study title only | 5 | Title contains the name, but the registered intervention fields do not identify it |
| Keyword result only | 11 | Neither the title nor registered intervention fields substantiate a direct name association; could still involve background therapy, a combination product or an incidental match |

These categories are **not** evidence of efficacy, study quality, independent corroboration, approval, counterfeit risk, clinical development stage, or true/false scientific relevance.

### Failure cases worth retaining

- [NCT03617081](https://clinicaltrials.gov/study/NCT03617081) was returned for a cagrilintide development-code search, but the registered intervention names a **different** code. This is a useful negative to prevent automatic false joins.
- [NCT07564414](https://clinicaltrials.gov/study/NCT07564414), [NCT07357766](https://clinicaltrials.gov/study/NCT07357766), and [NCT07357740](https://clinicaltrials.gov/study/NCT07357740) register CagriSema by combination-product name. The current **literal** matcher does not label this as a direct cagrilintide ingredient intervention. This is **not proof these trials are irrelevant**; it means the combination relationship needs its own explicitly sourced entity mapping.
- [NCT07398222](https://clinicaltrials.gov/study/NCT07398222) discusses tirzepatide users but registers ultrasound evaluation as the intervention. A title mention is not the same as investigational-drug assignment.
- [NCT07165028](https://clinicaltrials.gov/study/NCT07165028) has both retatrutide and tirzepatide among registered interventions. One NCT trial can legitimately map to multiple distinct agents, without making any efficacy inference.

### Reproducible checks

    npx vitest run tests/unit/research-identity-registry-corpus.test.ts
    node --import tsx scripts/verify-research-identity-corpus.mjs
    node --import tsx scripts/verify-research-identity-corpus.mjs --live

The last command is **optional** because it calls official external services, whose records can change or become temporarily unavailable. A network error means "source unavailable", not "no studies".

## Interpretation and gates

1. This corpus was selected from fixed official query results and checked at the metadata-field level by the assistant. It is **provisional**. It has **not** undergone independent domain-expert review and is not an unbiased or exhaustive reference sample.
2. It includes direct positive matches, weaker title associations and intentionally difficult negatives, so observed agreement with these cases does not establish recall or precision for the entire trial registry.
3. Before expanding production to alias queries or claiming study relevance, an independent reviewer should verify original source context, developer/brand/formulation/combination identity, comparator roles, and systematic false-positive/false-negative rates against a separately selected sample.
4. The last-update date on a registry record is not the date an efficacy result became known. Meaningful research-change intelligence will require dated snapshots and field diffs with original-source links.
5. No historic COAs, vendor scores, users, checkout, purchase, referrals, inferred consumer health interests or protected article full text are imported by this work.

**Goal check:** This is source-quality infrastructure to enable a useful, auditable "what changed in this asset's research?" product. It does not substitute for verified claim-level AI reasoning or customer demand validation.

Related: PRs #22, #27, #29 and #30; issues #23, #24, #26 and #28. See also docs/PRODUCT_EXECUTION_LEDGER.md.
