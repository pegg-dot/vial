# VialGrade execution ledger

Updated 2026-10-18. This file is a navigation and dependency map; it is not evidence of completed legal review, source accuracy, paying customers, or production deployment. Confirm each linked PR, issue and deployment before changing its status.

## Goal anchor

- **Final goal:** a defensible scientific R&D evidence-intelligence tool that helps researchers and biotech diligence teams find, verify and track meaningful changes in official sources.
- **First users to validate:** scientific researchers; biotech business-development and diligence teams; life-sciences investors doing fact-finding. Each needs a separate real-task test.
- **Core job:** answer "What changed about this research asset, what sources support that claim, and what remains unknown?" faster and more reliably than checking each source manually.
- **Not the product:** a human-use peptide seller, affiliate directory, medical adviser, drug-approval predictor, personalized investment adviser, or user-behavior data brokerage.
- **Constraints:** exact source relevance/citations, restricted content rights, scientific review, privacy, responsible drug-advertising boundaries, costs, limited engineering scope.

## October 18 owner-requested release and positioning correction

**Goal anchor:** help a scientist or biotech diligence analyst avoid missing or misattributing evidence when reconciling official trials with published papers. This is a first-customer hypothesis. A general Scholar replacement, clinical interpretation, retail storefront, investor recommendation, automated trial change intelligence and comprehensive disease/compound search are not current capabilities.

**Roadmap pivot (explicit):** previous near-term order was complete at least five observed analyst tasks before any public release of the local audit. The owner now needs to see and evaluate the accumulated interface because the current public product is confusing. The revised order is: (1) ship one clearly limited public example with an understandable source question, source proof and the commerce quarantine unchanged, then (2) test five real professional tasks and decide whether a bigger product is justified. Broader indexing and major rebranding remain deferred. Revisit the direction after that pilot, not after adding arbitrary features.

**Release scope:** the combined local source-reconciliation work (four pinned NCT studies, official PMID links, registered source labels, eligibility fields, citation export); source-relevance benchmark and read-only historical account pages; a simplified homepage showing the NCT05804162/PubMed 39279639 example; retired-marketplace redirects, 410 transaction blocks, and an explicit production build safety check. This release does not add a buyer flow or reactivate archived marketplace code. Product usefulness is still unproven.

**Release verification:** run local unit/integration, production-mode build, all research/browser commerce tests, source checks and dependency audits. Verify Vercel production setting VIALGRADE_PUBLIC_EVIDENCE_ONLY=true; then verify the actual production deployment SHA, the public pages, all original links and direct purchase endpoint denials. Do not assume success from a GitHub push alone. A failed deployed build should leave the older production release active. The admin mailbox and legal/privacy/source-rights questions remain open and must not be falsely represented as complete.

## Workstream ledger

| Workstream | Current evidence | Next action | Release gate |
| --- | --- | --- | --- |
| Research-only production boundary | PR #22 merged. Historic seller checkout, referrals, vendor API and catalog quarantined; verify production separately | Keep 410/redirect and no-ingest tests green across every subsequent PR | Browser and exact-commit release checks; do not re-enable commerce |
| Historical account/provider compatibility | Past client-provider errors recorded on old marketplace URLs and historic personal pages still imported legacy client UI; fix isolated in hotfix branch | Provide read-only rights-facing account views; defend legacy pages before data reads; test for client-side exceptions | Verify research-mode build/browser/auth and production logs after exact-commit deployment |
| Discovery usability | PR #27 merged 2026-10-18: clearer product explanation and local title/ID/filter search | Check production visibility and filter/search usability on desktop/mobile | CI, browser, deployment verification |
| Historic data reuse | PR #29 (review in progress as of ledger authoring) documents 15 tracked datasets with read-only inventory | Merge only after CI; review provenance and source-rights before any import | No production DB import; no PII or vendor grading |
| Task-first research audit (LOCAL ONLY) | Local Cagrilintide pilot with 4 bounded official NCT lookups, results-section checks, outcomes and source-backed review prompts; no deploy/push | Run a real analyst task benchmark vs registry/Scholar and get an independent source-identity check | Quality, safety, 5 observed tasks, clear improvement and operator release approval |
| Scientific entity/alias quality | This branch: scoped 3-topic identifier candidates, registry-field match annotations on existing results, and opt-in alias coverage evaluation | Benchmark official query results, human-check mismatches and false positives; promote selectively | At least 30-50 independently annotated examples; preserve identity/source provenance |
| Trial association benchmark | 45 provisional topic-study cases (44 distinct official NCT IDs); 29 intervention-field, 5 title-only, 11 keyword-only. No independent SME review yet | Cross-check source context and separate combination-product relationships; avoid unsupported recall/precision claims | Official source and rights checks, independent review, calibrated evaluation before expanded search |
| Source availability and freshness | ClinicalTrials.gov + OpenAlex fixed queries, 6-hour server cache; samples of up to 8 each | Record retrieval/observation time and differentiate stale, offline, and genuinely empty | Timeouts, malformed response, rate limits and broken-link tests |
| Actual intelligence workflow | Local cagrilintide study audit now reconciles three protocol-linked PMIDs against exact NCT IDs in official PubMed XML, alongside registry results-section status and source-role labels | Have an independent analyst review the two key findings (NCT05804162: RESULT paper without registry results; NCT04982575: BACKGROUND label but exact PubMed trial association) | Pinned source IDs, no unsupported clinical conclusions, one bounded NIH lookup per 6h cache |
| Publication provenance | One official NLM EFetch XML request cross-checks up to 12 selected NCT/PMID pairs; no abstract republishing, user query, or paid API | Measure missed papers from registry-only references against analyst baseline; only then expand exact-NCT discovery | Source rights review, independently verified links, fail closed on provider errors |
| AI-assisted analysis | Design only; unreviewed scientific claim synthesis not shipped | Only after identity, relevance and claim-to-source benchmark pass | Source-excerpt verification, expert review and hallucination tests |
| User-demand validation | No completed professional interviews or willingness-to-pay evidence documented | Ask target professionals about real past research tasks, time and tool comparisons; seek pilots | Demonstrable time/correctness advantage and repeated use |
| UI rebrand | Intentionally deferred | Revisit after useful workflow and reliable results have been observed in actual pilots | No major visual rebuild before workflow is proven |
| Mail and rights requests | Issue #23: recipient chosen, delivery and DNS still unverified | Configure domain MX/routing, verify Gmail recipient, send outside test message | Real receipt and reply test; process owner and timeline |
| Privacy, source rights, legal | Issue #24: historical records/backups and counsel review remain open | Inventory retained personal records separately; prepare retention/deletion and licensing register; independent counsel review | Do not claim legal clearance or republish unlicensed/harmful claims |
| Preserved marketplace | Issue #26: archival Git tag exists at pre-PR #22 commit | Keep available for independently reviewed, product-specific lawful future | No checkout/vendor referrals on research production |

## Local integration checkpoint — no deployments

The current local branch incorporates the code from previously separate PR #29 (historical tracked-source audit), PR #31 (45-case study match-location benchmark and filter), and PR #32 (read-only historical account access and retired provider compatibility). This is a **local merge only**. None of these changes has been released through this local integration. The original marketplace archive remains isolated.

**Commerce invariant:** old checkout/cart/affiliate/referral/API writes are explicitly 410, including nested paths and provider onboarding/sync; signed payment-remedy callbacks and prior-account requests remain separately gated. A Vercel production build now refuses to proceed if the research-only mode flag is missing, so losing an environment variable does not restore the old storefront. Staff browsing of public retired pages no longer overrides the research-mode redirect.

**Navigation and usefulness:** the public Intelligence index now offers the first working task audit before incomplete research topic samples. Retired URLs give a named explanation; research navigation and legal reference links point to reachable pages. The standalone index no longer fetches six source result samples on every view. These are usability and cost controls, not a completed AI intelligence product.

**No-deployment policy:** this integration stays in local Git until reviewed and explicitly approved for one batched release. Continue to test actual buyer/analyst workflows, research-source quality, privacy and mailbox setup separately.

## Local October 18 publication-reconciliation checkpoint

After the initial study-design audit, exact official source checks uncovered a useful problem: NCT05804162 has no registry results section in the inspected current record, yet its protocol includes a PMID 39279639 citation labeled RESULT and PubMed independently indexes that same NCT. The NCT04982575 registry describes PMID 37364590 as BACKGROUND even though PubMed indexes that paper under this specific NCT. This is NOT a claim of a registry error, study reporting violation, or clinical effect.

The LOCAL source-lineage feature also exposes selected registered eligibility and study-arm metadata to flag study-population differences; those fields are not clinical comparability findings. The LOCAL source-lineage feature surfaces these distinctions with direct original URLs, transparent uncertainty, and a reproducible Markdown handoff. One bounded PubMed EFetch query supplies metadata and exact trial accessions for all three linked PMIDs, replacing multiple rate-limit-prone requests. No sales or personalized tracking were added. Research details and baseline questions are in docs/RESEARCH_PUBLICATION_RECONCILIATION_2026-10-18.md.

**Goal check:** this is a core researcher task, unlike cosmetic improvements. Next evidence required is independent review and observed professional usage, not an automatic increase in source count. Everything stays local until a single owner-approved release.

## October 18 course correction and cost gate

**Old short-term order:** increase aliases/search coverage and filters, expand feature surfaces, then rebrand or add AI analysis.

**New order:** test one concrete analyst job end-to-end with exact primary sources, independent quality review and measurable task-completion advantage **before** expanding the index, adding chat, or redesigning.

**Why:** Google Scholar already wins on academic search breadth; commercial systems such as Citeline and TrialRedline already serve data and trial-change workflows. VialGrade must prove a narrower capability that avoids identity mistakes and source-verification work. This is a value-proposition correction, not a legal/marketplace reversal.

**Deferred until task evidence:** broad coverage expansion, expensive model-based synthesis, interface rebrand and subscription infrastructure. Revisit if 5 real professional tasks show reduced effort without correctness regression and several users return for another task.

**Cost control:** Develop locally; no remote pushes, new PRs/preview builds, merges or production deployments for each minor edit. Use one reviewed, batched feature PR and one operator-approved release after local tests and actual task validation. Do not confuse local test runs with Vercel deployment spend. Keep existing open PRs #29/#31/#32 tracked separately.

**Pilot details and competitive comparison:** docs/RESEARCH_USEFULNESS_REFOCUS_2026-10-18.md. This file is updated only on the local development branch until a batch release is approved.

## Planned sequence and rationale

1. Protect the research-only environment and keep operational obligations visible.
2. Improve data accuracy and identity resolution: disambiguate a compound, manufacturer, formulation, brand, clinical program and laboratory sample. Use fixed, source-corroborated *candidate* aliases, not all historical seller names.
3. Prove source relevance and version/change tracking. Test false positives from broad queries and differentiate intervention, comparator, title-only and other field mentions.
4. Compare completed researcher tasks to official-source workflows. Record time, citation errors and follow-up behavior without tracking individual health interests.
5. Only then add reviewed claim-level AI analysis and consider a rebrand or B2B pricing.

### Why historic marketplace data is not being thrown away

The archived marketplace still contains source code and historical research/vendor structures. The current repo also retains compound aliases, source links, historical regulatory assertions and COA samples. These are different from historic consumer/account/click paths. We can reuse trustworthy *nonpersonal* identity metadata and source pointers after verification; we should keep existing interaction histories separate until privacy obligations are resolved. A public data file is not automatically licensed, complete, correct or appropriate to publish.

**Provisional quality corpus:** See docs/RESEARCH_FIELD_MATCH_BENCHMARK_2026-10-18.md for the first 45 pinned registry metadata examples and opt-in source drift checks. The field-only filtering is a local inspection tool, not an efficacy/relevance ranking. A separate expert-reviewed sample and real-world task evaluation are still outstanding.

**Scoped alias experiment:** manual leads retained from the old compound taxonomy are Retatrutide / LY3437943, Cagrilintide / NNC0174-0833, and Tirzepatide / LY3298176. We do not automatically import the other historical aliases or consumer queries into live source search. The experiment compares official registry keyword samples and differentiates an actual intervention field from a title mention or a generic keyword hit. It does not prove clinical efficacy or systematic coverage.

## Open decisions and sources of truth

- Who is the first concrete professional buyer and what recurring research decision do they need help with?
- Which original data providers license archival reuse and which reports can be independently authenticated?
- What legal entity actually operates VialGrade, where is it targeting users, and who handles notices?
- Who signs off source-level scientific/clinical claims, if any are published?
- When does the current unconfigured domain mailbox become an actually working rights-request channel?

**Single workstream priority:** Relevance and trust first, then repeatable research change intelligence. Marketplace archive preservation, legal/privacy obligations and customer validation remain parallel tracks, not discarded phases.

References: PR #22, PR #27, PR #29; issues #23, #24, #26, #28; docs/RESEARCH_INTELLIGENCE_PRODUCT.md and docs/LEGACY_RESEARCH_DATA_REUSE_2026-10-18.md (last file pending PR #29).
