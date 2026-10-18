# VialGrade execution ledger

Updated 2026-10-18. This file is a navigation and dependency map; it is not evidence of completed legal review, source accuracy, paying customers, or production deployment. Confirm each linked PR, issue and deployment before changing its status.

## Goal anchor

- **Final goal:** a defensible scientific R&D evidence-intelligence tool that helps researchers and biotech diligence teams find, verify and track meaningful changes in official sources.
- **First users to validate:** scientific researchers; biotech business-development and diligence teams; life-sciences investors doing fact-finding. Each needs a separate real-task test.
- **Core job:** answer "What changed about this research asset, what sources support that claim, and what remains unknown?" faster and more reliably than checking each source manually.
- **Not the product:** a human-use peptide seller, affiliate directory, medical adviser, drug-approval predictor, personalized investment adviser, or user-behavior data brokerage.
- **Constraints:** exact source relevance/citations, restricted content rights, scientific review, privacy, responsible drug-advertising boundaries, costs, limited engineering scope.

## Workstream ledger

| Workstream | Current evidence | Next action | Release gate |
| --- | --- | --- | --- |
| Research-only production boundary | PR #22 merged. Historic seller checkout, referrals, vendor API and catalog quarantined; verify production separately | Keep 410/redirect and no-ingest tests green across every subsequent PR | Browser and exact-commit release checks; do not re-enable commerce |
| Historical account/provider compatibility | Past client-provider errors recorded on old marketplace URLs and historic personal pages still imported legacy client UI; fix isolated in hotfix branch | Provide read-only rights-facing account views; defend legacy pages before data reads; test for client-side exceptions | Verify research-mode build/browser/auth and production logs after exact-commit deployment |
| Discovery usability | PR #27 merged 2026-10-18: clearer product explanation and local title/ID/filter search | Check production visibility and filter/search usability on desktop/mobile | CI, browser, deployment verification |
| Historic data reuse | PR #29 (review in progress as of ledger authoring) documents 15 tracked datasets with read-only inventory | Merge only after CI; review provenance and source-rights before any import | No production DB import; no PII or vendor grading |
| Scientific entity/alias quality | This branch: scoped 3-topic identifier candidates, registry-field match annotations on existing results, and opt-in alias coverage evaluation | Benchmark official query results, human-check mismatches and false positives; promote selectively | At least 30-50 independently annotated examples; preserve identity/source provenance |
| Source availability and freshness | ClinicalTrials.gov + OpenAlex fixed queries, 6-hour server cache; samples of up to 8 each | Record retrieval/observation time and differentiate stale, offline, and genuinely empty | Timeouts, malformed response, rate limits and broken-link tests |
| Actual intelligence workflow | Dated source trail and citation export, not meaningful record-version diffs yet | Create official-source version snapshots and deterministic change reports | Pinpoint citations, no claims based only on counts or keywords |
| AI-assisted analysis | Design only; unreviewed scientific claim synthesis not shipped | Only after identity, relevance and claim-to-source benchmark pass | Source-excerpt verification, expert review and hallucination tests |
| User-demand validation | No completed professional interviews or willingness-to-pay evidence documented | Ask target professionals about real past research tasks, time and tool comparisons; seek pilots | Demonstrable time/correctness advantage and repeated use |
| UI rebrand | Intentionally deferred | Revisit after useful workflow and reliable results have been observed in actual pilots | No major visual rebuild before workflow is proven |
| Mail and rights requests | Issue #23: recipient chosen, delivery and DNS still unverified | Configure domain MX/routing, verify Gmail recipient, send outside test message | Real receipt and reply test; process owner and timeline |
| Privacy, source rights, legal | Issue #24: historical records/backups and counsel review remain open | Inventory retained personal records separately; prepare retention/deletion and licensing register; independent counsel review | Do not claim legal clearance or republish unlicensed/harmful claims |
| Preserved marketplace | Issue #26: archival Git tag exists at pre-PR #22 commit | Keep available for independently reviewed, product-specific lawful future | No checkout/vendor referrals on research production |

## Planned sequence and rationale

1. Protect the research-only environment and keep operational obligations visible.
2. Improve data accuracy and identity resolution: disambiguate a compound, manufacturer, formulation, brand, clinical program and laboratory sample. Use fixed, source-corroborated *candidate* aliases, not all historical seller names.
3. Prove source relevance and version/change tracking. Test false positives from broad queries and differentiate intervention, comparator, title-only and other field mentions.
4. Compare completed researcher tasks to official-source workflows. Record time, citation errors and follow-up behavior without tracking individual health interests.
5. Only then add reviewed claim-level AI analysis and consider a rebrand or B2B pricing.

### Why historic marketplace data is not being thrown away

The archived marketplace still contains source code and historical research/vendor structures. The current repo also retains compound aliases, source links, historical regulatory assertions and COA samples. These are different from historic consumer/account/click paths. We can reuse trustworthy *nonpersonal* identity metadata and source pointers after verification; we should keep existing interaction histories separate until privacy obligations are resolved. A public data file is not automatically licensed, complete, correct or appropriate to publish.

**Scoped alias experiment:** manual leads retained from the old compound taxonomy are Retatrutide / LY3437943, Cagrilintide / NNC0174-0833, and Tirzepatide / LY3298176. We do not automatically import the other historical aliases or consumer queries into live source search. The experiment compares official registry keyword samples and differentiates an actual intervention field from a title mention or a generic keyword hit. It does not prove clinical efficacy or systematic coverage.

## Open decisions and sources of truth

- Who is the first concrete professional buyer and what recurring research decision do they need help with?
- Which original data providers license archival reuse and which reports can be independently authenticated?
- What legal entity actually operates VialGrade, where is it targeting users, and who handles notices?
- Who signs off source-level scientific/clinical claims, if any are published?
- When does the current unconfigured domain mailbox become an actually working rights-request channel?

**Single workstream priority:** Relevance and trust first, then repeatable research change intelligence. Marketplace archive preservation, legal/privacy obligations and customer validation remain parallel tracks, not discarded phases.

References: PR #22, PR #27, PR #29; issues #23, #24, #26, #28; docs/RESEARCH_INTELLIGENCE_PRODUCT.md and docs/LEGACY_RESEARCH_DATA_REUSE_2026-10-18.md (last file pending PR #29).
