# VialGrade: competitive wedge and legal data opportunities

October 18, 2026 | RESEARCH ONLY | No push, PR, new deployment or product-market-fit claim

## Pinned goal
Create a repeatable, auditable source-verification workflow for two related users: drug-development scientists and biotech diligence analysts. Both should be able to compare what was registered, what was reported and what was claimed, with original evidence and uncertainty visible.

Not a human-use peptide seller, treatment adviser, unverified scientific judge, stock prediction system or general research chat replacement. Preserve existing marketplace archive and purchase block.

## What the competition rules out

- TrialRedline already sells field-level trial amendment histories, alerting, company mappings, an FDA event calendar and REST/MCP access. Advertised Pro price is $119.20/month on annual billing.
  https://trialredline.com/
  https://trialredline.com/pricing
  https://trialredline.com/developers
- Anamnesis Data offers a historical compilation of about 4.44 million versions of 605,000 trials. Its compiled historical dataset is licensed noncommercially unless a commercial license is negotiated. This does not restrict obtaining the original public records independently.
  https://anamnesisdata.com/
  https://huggingface.co/datasets/anamnesis-data/clinical_trials_history
- Elicit supports structured clinical trial searching and citations. AlphaSense added clinical-drug-regulatory intelligence linked to financial research in September 2026. Citeline Trialtrove+ and BioCentury BCIQ are established specialist alternatives.
  https://elicit.com/blog/clinical-trials
  https://www.alpha-sense.com/press/alphasense-strengthens-its-life-sciences-platform/
  https://www.citeline.com/en/products-services/clinical/trialtrove
  https://www.biocentury.com/bciq-data
- Academic tools and papers already address missing trial-publication links, including NCT Link, Trials to Publications and the ClinicalTrialsHub preprint. The proposed source-matching layer is not automatically unique.
  https://pubmed.ncbi.nlm.nih.gov/40585158/
  https://pubmed.ncbi.nlm.nih.gov/34970844/
  https://arxiv.org/abs/2512.08193

A larger catalog, another chatbot and ordinary trial-redline alerts are weak stand-alone value propositions.

## A measurable problem: reconcile claims to original evidence

A 2023 BMJ Open systematic review found an estimated 29-37% of studies in its analyzed literature had at least one discrepancy in primary outcomes between registration/protocol and publication. It warned of heterogeneity, version ambiguity and the difficulty of distinguishing disclosed legitimate amendments. This figure is NOT the incidence of research misconduct.
https://pmc.ncbi.nlm.nih.gov/articles/PMC10551944/

COMPare manually audited registered versus published outcomes, documenting potential differences and the evidence for their assessment.
https://www.compare-trials.org/project

Crossref exposes paper corrections/retractions and update metadata; corrections are not equivalent to retractions.
https://www.crossref.org/documentation/retrieve-metadata/retraction-watch/

## Live three-trial public-API feasibility check (Oct 18)

Methods: sequential read-only exact NCT registry lookup, PubMed secondary-source ID search, Europe PMC unfielded NCT string search, and Crossref filter by publisher-deposited clinical-trial number. Same ID, four different search semantics.

Trial | Registry-cited PMID count | PubMed exact NCT associations | Europe PMC broad mentions | Crossref trial-number metadata
--- | ---: | ---: | ---: | ---:
NCT05804162 | 1 (RESULT) | 1 | 2 | 0
NCT04982575 | 1 (BACKGROUND) | 1 | 7 | 0
NCT03762850 | 5 (DERIVED) | 5 | 64 | 0

These were three hand-selected studies, NOT a statistical sample. They demonstrate precision and provenance questions, not a scientific discrepancy. A broad mention does not mean a paper reports the trial outcome. Empty publisher metadata does not imply absent publications. Registry labels and PubMed association are separate claims.

Original records:
https://clinicaltrials.gov/study/NCT05804162
https://clinicaltrials.gov/study/NCT04982575
https://clinicaltrials.gov/study/NCT03762850
https://www.nlm.nih.gov/pubs/techbull/mj05/mj05_ct.html
https://www.crossref.org/documentation/crossmark/linked-clinical-trials/

## Ranked product hypotheses

Priority 1: Evidence discrepancy and claim workpaper. Start with a trial ID, relevant paper and a concrete statement. Show what was registered, whether the record changed, what a permitted published result actually states, and any sponsor disclosure. Show possible discrepancies as NEEDS HUMAN REVIEW with supporting source versions, not allegations of misconduct or clinical judgments. Generate a reproducible workpaper for an analyst or scientist.

Enabler 1: Article-to-trial evidence graph. Connect exact PMID/DOI/NCT relationships through official registry references, PubMed secondary IDs, Crossref trial identifiers, permitted Europe PMC / PMC full-text mentions, and candidate semantic matches. Keep separate confidence and role labels. Match-count inflation is a failure.

Phase 2: Narrow program monitoring. Save authorized source snapshots with observation time, source posting time, and comparison provenance. Detect meaningful changes and corrections. Existing competitors do this broadly, so test whether an evidence-review workpaper plus monitoring saves time before investing.

Distribution experiment: If professionals prefer ChatGPT/Claude, provide their existing assistant with machine-readable verified evidence through an API or MCP integration. Distribution alone is not the business.

### Two modes on the same source ledger

Researcher: registered protocols, endpoints, actual reported findings, omissions, comparator/design caveats, human source review.

Diligence: same facts plus company/sponsor mapping, relevant SEC filings, public regulatory statements and milestone dates with precision. Do not automatically recommend trades, predict approvals or treat corporate claims as scientific proof.

## Legal and cost openings, not regulatory loopholes

Official primary data is often available to query without subscribing to a major enterprise platform, but its permitted uses vary.

- CTTI AACT provides a daily updated public relational form of current ClinicalTrials.gov data, with downloadable historical periodic snapshots. Monthly snapshots are NOT the complete record amendment history.
  https://aact.ctti-clinicaltrials.org/landing
- SEC company submissions and XBRL facts have public APIs, with fair access guidance of up to 10 requests/sec.
  https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- openFDA data is generally CC0 with explicit exceptions for private third-party rights, and rate limits apply.
  https://open.fda.gov/terms/
- OpenAlex public metadata is CC0. API usage has free daily budget and rate limitations; underlying full texts retain publisher copyright.
  https://help.openalex.org/access/pricing/
- Crossref bibliographic metadata is widely reusable but abstracts may be copyrighted; trial-number matching depends on publisher participation.
  https://www.crossref.org/documentation/retrieve-metadata/rest-api/
- PMC text reuse requires the proper article-level rights and permitted programmatic interfaces. PubMed abstracts may be copyrighted. NCBI E-utilities are rate limited.
  https://pmc.ncbi.nlm.nih.gov/tools/oai
  https://www.nlm.nih.gov/databases/download.html
  https://eutilities.github.io/site/API_Key/usageandkey/
- DO NOT import Anamnesis Data CC BY-NC compiled version-history data into a commercial product without the provider's commercial license. Use original ClinicalTrials.gov data independently if permitted.

A free API, public web page or research-use disclaimer does not override original content rights or product-specific pharmaceutical laws.

## Ten-business-day validation experiment

Days 1-2: Recruit five research scientists and five biotech diligence analysts. Interview their last actual trial evidence-review task and baseline tools (ChatGPT, Claude, PubMed, ClinicalTrials.gov, specialist systems); do not assume buying intent.

Days 3-5: Have a methods expert independently adjudicate ten public trial-publication-claim workpapers, including amended outcomes, unrelated paper mentions and compliant disclosures. Confirm exact source and quoted text rights.

Days 6-8: Build only one source-discrepancy workpaper workflow locally. Compare counterbalanced first attempts using VialGrade versus each person's existing tools. No deployment or daily polling is required for the experiment.

Days 9-10: Measure completion time, correct source links, false exact matches, mistaken discrepancy flags, corrections needed, perceived frequency of use and actual paid-pilot interest.

Suggested quality gate, not an achieved result: zero fabricated citations, zero false high-confidence NCT matches in reviewer-checked examples, no automatic misconduct allegations, a meaningful accuracy or time advantage for at least three of five testers in each segment, and concrete recurring-use interest from two organizations. Stop or pivot if existing tools perform just as well.

## Roadmap ledger

Current: source/competitor research, validated public API data rights and sample matching test.
Next: expert-reviewed, trial-to-claim audit of ten examples; compare with current tools.
Deferred: full general drug database, startup valuation predictions, multi-registry crawling, unlicensed PDFs, major rebrand, pricing, paid enterprise subscriptions, marketplace.
Open: evidence/workpaper frequency and buyer, content rights per paper, scientific reviewer, whether the analyst view needs SEC filings at all in phase one.

Goal check: the evidence reconciliation is core. Article search, change alerts and AI chat are enablers, not proof of value.
