# VialGrade Research Explorer — discovery-first local phase

October 18, 2026. Status: LOCAL BUILD AND TEST ONLY. Not published, not legally
cleared, not a scientific recommendation, not a physical-goods marketplace.

## Goal anchor

Make peptide-science research subjects understandable and investigable.
A researcher or biotech diligence analyst should be able to find a relevant
molecular research question, verify exactly which compound is discussed,
compare unanswered questions, and follow official scientific records
without believing a seller pitch.

Primary test users: scientists in peptide/biological research and biotech
analysts investigating drug-development programs. They share the same
source/identity ledger, but have different questions.

Core outcome to validate: the user can discover an appropriate research
subject, understand source/identity limitations and investigate its
evidence more accurately and with less confusion than using PubMed,
ClinicalTrials.gov or ChatGPT/Claude separately.

Not the product: clinical efficacy rankings, experimental protocols,
dosing instructions, advice for human consumption, trading predictions,
guaranteed safety, sales of physical reagents, vendor referrals, a
personalized medical profile, automated claims of scientific misconduct.

## Explicit pivot

Previous near-term sequence: build a source-verified trial-ID lookup,
then a deep evidence-claim audit, then test demand before broad discovery.

New sequence: 1) put a research discovery experience on top of the
verified trial/source tools, 2) test browsing, identity and comparison
usefulness with both target groups, 3) implement an expert-reviewed
claim-to-source workpaper for the narrower validated research question,
4) add verified ongoing evidence changes where users demand them.

Why: users consistently found the old full report confusing. They
should not need to arrive knowing a ClinicalTrials.gov NCT identifier
just to understand what VialGrade does. The new marketplace-like layout
helps discover research QUESTIONS, not products to purchase.

Deferred: broad literature harvesting, generic AI chatbot, scientific
effectiveness scores, vendor grading, subscriptions, full-text scraping,
major monetization work and automatic monitoring.

Revisit when: at least five real professionals from each group have
completed first-use research tasks and an expert has reviewed source
accuracy. The discovery front door is an enabling workflow only if
it improves an actual research task.

## Implemented in the local branch

- 16 editorially curated identities, 4 scientific themes; source
  metadata and scientific directions defined explicitly.
- Research categories and alias search with real client-side filtering.
- Researcher/analyst perspective toggle changing each subject's core
  question, rather than fabricating two distinct scientific records.
- Add/remove up to three subjects and open a shareable URL comparison,
  with distinct mechanisms, research questions, identity caveats
  and original public source searches. No general effectiveness rank.
- Individual dossier per subject with original PubChem identity source,
  clearly marked PubMed literature SEARCH and ClinicalTrials.gov
  keyword SEARCH, unresolved identity caveats, related subjects,
  and one actual trial record for the five vetted examples.
- Original strict NCT trial-ID lookup and exact PubMed record-link
  audit remains reachable and is not replaced. Existing three
  small-topic search samples remain accessible as background.
- Route whitelist only for public editorial dossier slugs and exact
  comparison route; unknown nested private paths remain gated.
- No source feed, recommendation score, personalized tracking,
  login requirement, vendor code, prices, checkout or referral logic
  introduced to the research catalog.

## Source verification completed on October 18

Molecular identity references:
- Semaglutide: PubChem CID 56843331
- Tirzepatide: PubChem CID 156588324
- Retatrutide: PubChem reference collection SID 528343961; **no
  main compound CID**. Related sodium salts and impurities must not
  be silently treated as identical retatrutide.
- Cagrilintide: PubChem CID 171397054
- LL-37: PubChem CID 16198951
- Magainin 2: PubChem CID 16130189
- Pexiganan: PubChem CID 16132253
- Nisin A: PubChem generic nisin CID 16129667; exact A variant not independently resolved, and the user-facing reference says so
- Oxytocin: PubChem CID 439302
- Arginine vasopressin (argipressin): PubChem CID 644077
- Somatostatin-14: PubChem somatostatin CID 16129706; distinguish
  the 14- and 28-amino acid endogenous forms.
- Neurotensin: PubChem CID 25077406
- Cyclosporin A: PubChem CID 5284373
- Octreotide: PubChem CID 448601
- Lanreotide: PubChem CID 6918011
- Ziconotide: PubChem CID 16135415

Important technical detail: the first CID returned by a PubChem
name-based API lookup for "tirzepatide" was **not** the CID shown on
PubChem's main annotated Tirzepatide page. We resolved the identity
manually to CID 156588324 rather than auto-importing the first hit.
Retatrutide is represented by an official PubChem substance reference,
not an arbitrarily chosen sodium salt.

Five official ClinicalTrials.gov intervention-name examples:
NCT03548935 semaglutide; NCT02759107 tirzepatide;
NCT05929079 retatrutide; NCT05804162 cagrilintide;
NCT01594762 pexiganan.

These links verify identity and that the named intervention is
present in a selected record, NOT success, safety, clinical stage,
regulatory status, full review coverage, or permission to obtain it.

Primary sources (examples):
https://pubchem.ncbi.nlm.nih.gov/compound/Tirzepatide
https://pubchem.ncbi.nlm.nih.gov/substance/528343961
https://pubchem.ncbi.nlm.nih.gov/compound/Pexiganan
https://clinicaltrials.gov/study/NCT05804162
https://clinicaltrials.gov/study/NCT01594762

All subject-specific PubMed and registry browse URLs are *search
entry points*, not individually verified paper lists. Original
third-party abstract/full-text and image copyrights still apply.
No old personalized marketplace or vendor-derived claims were imported.

## Legal/product safety gate

The old physical-goods marketplace remains archived at annotated tag
archive/marketplace-pre-research-2026-10-18. The research release continues
to reject checkout, carts, referrals and vendor sync with HTTP 410,
and retired market routes redirect to the public intelligence page.

A research-use-only disclaimer does not legally authorize selling
experimental drugs. Any future qualified-institution procurement
offering needs independent product-by-product counsel review, legitimate
buyer verification, quality chain-of-custody, and explicit project scope.
No such functionality is built or re-enabled here.

## Verification and pilot gates

Engineering gates:
- 16 distinct identities and 4 themes, valid source hosts and one
  per-theme minimum; unknown slug and metadata prototype-property checks.
- Anonymous browse and comparison routes; nested protected paths still
  denied; NCT strict lookup available.
- Mobile viewport no horizontal overflow, no dead public internal links,
  contextual navigation.
- Filters, perspective tabs, actual URL compare, original source links,
  study examples and checkout 410 browser tests.
- Production-mode build, TypeScript, full lint, unit/integration
  regression, role/security and accessibility audits before any release.

Human-validation gates (NOT yet achieved):
- Five scientists plus five biotech analysts attempt real source tasks
  using this experience and their current tools.
- At least one independent scientific reviewer checks compound identity,
  combination-compound ambiguity and claim/source alignment.
- Observe comprehension, filter relevance, task completion,
  false links and willingness to use it again. Do not infer value
  from animation, card count or website visits.
- Defer broader indexing or monetization if users can get the
  exact same work done just as well with existing tools.

## Roadmap ledger

Current: local discovery-first application, sourced editorial identities,
comparison and self-service evidence drill-down, safety and browser QA.
Next: witnessed task testing and SME identity/source signoff, then a
single batched release decision if the user requests it.
Parked: licensed institutional sourcing, sales, vendor reputation,
clinical scorecards, paid subscriptions, generic AI chat,
historical automated alerts and broad full-text ingestion.
Open: what scientist/investor research tasks recur and what measurable
accuracy/time advantage this platform offers.

Goal check: the catalog is the front door to a verified scientific
question; source identity and evidence review are the core value.
No code push or deployment has been made for this iteration.

## Engineering QA and source verification checkpoint

As of the October 18 local review:
- The static curated corpus has 16 unique research subjects across four themes,
  exactly four per theme; no price, vendor or purchase fields were imported.
- The optional, read-only source audit is reproducible with:
  `node --import tsx scripts/audit-research-explorer-sources.mjs --live`.
  It confirmed 16 of 16 PubChem identity links and five of five named
  interventions in the selected official ClinicalTrials.gov trial records.
  No failed requests or unknown mappings were reported.
- TypeScript and full ESLint passed, and the research-only production-mode
  Next.js build compiled successfully. The full unit suite passed 1,283
  tests across 142 files.
- All 87 isolated integration test files passed on the current local branch.
  A second exact research-only production-mode build and the full 30-test
  Chromium suite passed after the final source-label update.
- Chromium in research-only mode passed 30 of 30 end-to-end checks for
  the discovery interface, all sixteen dossiers, shareable comparisons,
  original source links, mobile layouts, legacy account access and 410
  transaction/referral blocks.
- Legacy-mode tests passed 44 applicable cases; 17 research-only cases
  were intentionally skipped when that flag was absent. Legacy mode is
  NOT the selected public production mode.
- Static security audit passed across 680 source files; role-access
  audit passed 54 routes; structural accessibility checks passed.
- Production dependency policy passed, but `npm audit` still reports five
  high-severity findings in the development tooling chain. Treat these
  as an open dependency-review task, not as proof of a secure product.
- Visually reviewed at 1,440px and 390px viewport widths with no
  horizontal overflow. Mobile now avoids the oversized hero example,
  displays theme filters in a compact 2x2 grid, and initially shows
  8 curated cards with a control to browse all 16.

These tests validate engineering behavior and basic source identity only.
They are NOT a systematic literature review or professional product-use
validation. Pilot task prompts and independent adjudication requirements
are in `docs/RESEARCH_EXPLORER_VALIDATION_TASKS_2026-10-18.md`.

The offline, static screenshot gallery was manually checked in Chromium:
`~/Documents/VialGrade/Local_Milestones/2026-10-18-research-explorer-preview/index.html`.
All eight screenshot files load, with separate desktop and mobile views.
This gallery is for design review only and does not run the interactive app.
