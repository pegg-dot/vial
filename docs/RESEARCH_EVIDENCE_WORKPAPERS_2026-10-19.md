# VialGrade: source workpapers, not just research search

Date: 2026-10-19 (Charlottesville time).
Scope: LOCAL ONLY, no pull request, GitHub push, Vercel preview or deployment.

## Goal anchor

North star: a discovery-led scientific evidence workspace where a user can
begin with a peptide subject, understand what is supported by specific
original sources, and distinguish molecular identity, in-vitro experiment,
clinical registry record, and publication relationship.

Two audiences remain hypotheses: peptide/biological scientists and biotech
program/diligence analysts. Core value to validate: completing a source
reconciliation with less effort and fewer identity/source errors than
PubMed/ClinicalTrials.gov plus ChatGPT/Claude. A nicer grid is not a moat.

Not the product: peptide suppliers, prices, checkout, referrals, consumer
use advice, experimental dosing/protocols, drug efficacy scores, material
quality claims, stock predictions, bulk copyrighted article copies, or
personalized research tracking. The older retail branch stays archived.

## New local phase and explicit sequence

Previous completed phase: 16 manually referenced subjects, four themes,
search and compare, five pinned registered intervention examples, and
a self-service exact NCT/PMID source audit.

New phase is source depth and real first-use tasks, NOT another general
search engine. The sequence now is:
1. Add a guided research case linking original magainin-2 identity,
   designed pexiganan, a source-specific biophysical paper, secondary
   review and actual registered clinical study.
2. Bring original trial-design, registry-result state, PMID role and
   exact NCT-index evidence into five peptide dossiers. Retain an
   explicit source-unavailable and identity-not-verified state.
3. Show selected registered study context within comparisons, not
   fabricated head-to-head effectiveness rankings.
4. Test navigation, source traceability, uncertainty and no-purchasing
   safety locally before an independent scientific and user pilot.

Deferred: broad indexing, LLM clinical interpretations, bulk article
ingestion, private profiles, alerts, vendor grading and procurement.

Revisit after: independently reviewed source examples and at least
five witnessed real tasks per candidate audience, compared against
professionals' existing tools. No scientific reviewer or paid pilot has
been completed.

## The Magainin 2 / pexiganan source relationship

Original primary paper:
- PMID 12719236, Hallock, Lee & Ramamoorthy (Biophysical Journal, 2003):
  experiments using NMR and calorimetry on model lipid bilayers, studying
  MSI-78 (pexiganan) as a designed magainin-family analog.
  https://pubmed.ncbi.nlm.nih.gov/12719236/
- This measures behavior in a defined physical model. It does not test
  clinical effectiveness in people.

Secondary review:
- PMID 19010301, Gottler & Ramamoorthy (Biochimica et Biophysica Acta,
  2009): describes pexiganan (MSI-78) as designed from magainin-2,
  and summarizes biophysical literature.
  https://pubmed.ncbi.nlm.nih.gov/19010301/
- The review is secondary context, not a clinical result.

Distinct molecule records:
- Magainin 2 PubChem CID 16130189:
  https://pubchem.ncbi.nlm.nih.gov/compound/16130189
- Pexiganan PubChem CID 16132253:
  https://pubchem.ncbi.nlm.nih.gov/compound/16132253
- The two are related but not the same identity and should not inherit
  one another's experimental or clinical evidence automatically.

Actual registered trial:
- NCT01594762, registered Phase 3 pexiganan study, intervention field
  "Topical pexiganan cream 0.8%" with "Number of Participants With
  Clinical Response" as its primary registered outcome.
  https://clinicaltrials.gov/study/NCT01594762
- At the 2026-10-19 source read, hasResults was true and the source cited
  PMID 36781451 with role DERIVED. This is not a substitute for reading
  result statistics or the primary clinical article.
- This does NOT verify a favorable outcome, regulatory approval,
  human-use suitability or a supply permission.

Why this could beat a broad search: the workpaper makes a precise
lineage and evidence-type distinction, cites every proposition and its
limit, and provides an exportable checklist. This remains an untested
professional usefulness hypothesis, not a demonstrated moat.

## Five selected clinical trial source panels

Read-only official API observations retrieved 2026-10-19; do not
treat as historical event comparisons or an exhaustive peptide index.

| Research subject | Pinned study | Registered phase/status | Registry results present | Registry-cited PMID role example |
| --- | --- | --- | --- | --- |
| Semaglutide | NCT03548935 | Phase 3, COMPLETED | yes | BACKGROUND, RESULT, DERIVED reference roles coexist |
| Tirzepatide | NCT02759107 | Phase 1, COMPLETED | yes | PMID 30473097, DERIVED |
| Retatrutide | NCT05929079 | Phase 3, COMPLETED | no | PMID 42810372, DERIVED |
| Cagrilintide | NCT05804162 | Phase 1, COMPLETED | no | PMID 39279639, RESULT |
| Pexiganan | NCT01594762 | Phase 3, COMPLETED | yes | PMID 36781451, DERIVED |

A trial phase, status, posted results, and a publication link are
different source facts. Their presence does not establish benefit or
safety or a medical indication. Across different drugs, study populations
and primary endpoints can be incomparable. The application must say so.

Each opened clinical dossier requests ONE explicitly pinned official
NCT via the existing six-hour cached source lookup. A selected
comparison requests only its relevant pinned NCTs. Cross-checks only
registry-listed PMIDs using PubMed exact trial-ID indexing. No new
private data, paid API, cron job or article text ingestion.

## Correctness/release safeguards

- Require the selected NCT and a named intervention match before
  rendering a verified study preview; fail closed otherwise.
- Distinguish unavailable API, absent registry results section,
  uncited PubMed IDs, uncorroborated exact links and confirmed exact
  PMID/NCT associations. They are not interchangeable.
- Preserve original registry labels BACKGROUND/RESULT/DERIVED.
- Mark sources as primary experiment, secondary review, molecular
  identity reference and official trial record.
- Export only our paraphrased source observations, original URLs and
  methodological uncertainty. Do not copy protected article text.
- Retain all 410 purchase/referral/cart/checkout blocks and marketplace
  archive. No medical or trading recommendations.
- Continue explicit source-rights, privacy and legal review before any
  commercial use, bulk import or institutional procurement.

## Verified local engineering checkpoint

The final repository changes were tested on October 19 (local time):
- 1,290 Vitest unit tests passed across 143 files.
- All 87 isolated integration test files passed, including historical
  marketplace, roles, retention and account compatibility checks.
- Exact research-only Next.js production-mode build passed, followed by
  35 of 35 Chromium browser tests. The tests exercise the guided case,
  source export, trials panel, public navigation, original-source links,
  all 16 discovery dossiers, mobile width and checkout/referral 410s.
- Default historical/legacy-mode Chromium suite passed 44 applicable
  cases; 22 research-only tests were intentionally skipped without the
  research-only deployment flag.
- Full ESLint and TypeScript passed. Static security audit passed across
  686 source files; HTTP role and structural accessibility audits
  passed for 55 discovered routes.
- An npm production-dependency audit using --omit=dev reported zero
  vulnerabilities. The full dev-toolchain npm audit had earlier
  reported five high-severity development dependency notices; no blind
  dependency force-upgrade was attempted.
- An optional, read-only official source audit confirmed both PubChem
  CIDs, the intended NCT intervention and PubMed title/type identities.
  Its command is:
  node --import tsx scripts/audit-guided-research-case.mjs --live
- Desktop screenshots at 1440px and mobile at 390px showed no
  horizontal overflow. Collapsing the complete five-source register
  reduced the guided-case mobile document from about 6637px to 5442px.
  This is a viewport smoke test, not a user-experience study.
- Eleven actual local-screen screenshots are available at:
  ~/Documents/VialGrade/Local_Milestones/2026-10-19-evidence-workpapers-preview/index.html
  The offline gallery's 11 images all rendered successfully under
  local Chromium; this is NOT a functional public preview.

**These are engineering QA results, not clinical validation or product
market fit.** No independent scientific reviewer has signed the
evidence interpretation, and there have been no professional buyer
interviews or paid pilots in this milestone.

## Roadmap ledger

Current: local source workpapers on branch
local/vialgrade-evidence-workpapers-2026-10-19; no push or deploy.
Next: complete engineering QA and independent expert review, then
five researcher and five biotech analyst first-use tasks with baselines.
Parked: clinical outcome scoring, AI synthesis, alerts, seller data,
paid licenses, automatic sourcing or transaction functionality.
Open: scientific source signoff, user demand, copyright/reuse,
old-account privacy, email routing and later batch-release authorization.

Goal check: differentiating research claim, experimental model and
registered clinical evidence is core product value; catalog cards are
only an enabler. No external user validation is yet proven.
