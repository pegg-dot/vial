# VialGrade: peptide R&D evidence-intelligence pivot

Status: hypothesis / preview product, **not yet a demand-validated business** and **not legally cleared**.
Date: October 16, 2026. This is a proposed change to the VialGrade product direction, not a claim that a buyer market exists or that proposed AI features have shipped.

## Pinned goal anchor

- **Goal:** build a credible, source-linked peptide research intelligence service whose conclusions can be independently audited.
- **First users to test:** biotech business-development analysts, life-science investment/due-diligence analysts, and research scientists. Test each separately; their needs differ.
- **Core value:** answer *what is the evidence, what is changing, where do credible sources disagree, and what is still unknown?*
- **Non-goals:** selling or referring for unapproved-drug purchases, personal treatment or dosage advice, validating a specific vial's safety, paid seller ranking, patient-level profiling, commercial reuse of data without rights, or securities recommendations.
- **Constraints:** FDA intended-use/FTC net-impression rules, sensitive inferred health-data laws, data licenses, quote-level scientific accuracy, human oversight, security, actual customer discovery.

## Pivot callout

**Old sequence:** peptide marketplace → vendor grades/prices → affiliate/commercial traffic attribution → user saved searches and alerts.

**New sequence:** pause vendor purchase flows and sensitive personal profiles → verify source-level rights/claims → public research dossier prototype → interviews with professional target users → measured B2B research workflows → licensed recurring intelligence.

**Why:** market/referral model creates unapproved-drug marketing questions; the source graph and provenance capabilities have more defensible utility in research and diligence, if quality can be verified.

**Deferred:** subscriptions, checkout, user accounts, affiliate relationships, paid lab verification, unreviewed automated drug opinions, and all personal-data collection for demand testing.

**Revisit checkpoint:** all mandatory release checks pass, counsel clears the exact read-only workflow, and a defined sample dossier solves a repeated pain point in user interviews.

## Market reality: proven *category* demand, unproven VialGrade demand

Existing products and the professional needs they serve:

- **BioCentury BCIQ:** company, deal, financing and pipeline intelligence. https://www.biocentury.com/bciq-data
- **Clarivate Cortellis:** drug pipeline, clinical/regulatory, patents, partnerships and AI-assisted competitor analysis. https://clarivate.com/life-sciences-healthcare/portfolio-strategy/competitive-intelligence/cortellis-competitive-intelligence-analytics/
- **Citeline Pharmaprojects:** large, curated clinical development database and commercial workflow. https://www.citeline.com/en/products-services/clinical/pharmaprojects
- **BenchSci ASCEND:** AI-supported preclinical research discovery and due diligence. https://knowledge.benchsci.com/home/platform-fundamentals
- **Dimensions:** linked scholarly publications, grants, clinical trials and patents. https://www.dimensions.ai/products/

Conclusion: enterprise research intelligence has buyers. That **does not establish** willingness to sign up for a peptide-only tool, and does not establish why an institution would switch from existing platforms. A clone of generic AI research chat has weak differentiation.

### Who might sign up, and why?

- **Research scientist:** possibly for free, if source provenance and contradiction tracking save time. Likely to reject commercial vendor grades or summaries they cannot reproduce. Budgets may be controlled by institutions.
- **Biotech BD / diligence analyst:** promising paid candidate if the tool catches a change or evidence mismatch before their existing workflow, with exports and an audit trail. Demands high precision and coverage.
- **VC / life sciences investor:** needs asset-to-company/deal/trial graph and actionable intelligence. Peptide retail prices or vendor social chatter generally don't satisfy the investment workflow. Securities-specific advice adds regulation.
- **Testing lab:** may pay for workflow software that verifies that a report actually belongs to it and tracks sample identity, but requires a real lab partner and appropriate attestations. No medical-testing certification is implied.
- **Consumer looking for a peptide seller:** not the target user. Do not optimize acquisition to that intent.

### Demand-validation protocol, before any pricing or accounts

1. Construct five **source-auditable dossiers** in a narrow area, e.g. experimental incretin/peptide R&D. Each needs a source archive, study/trial timeline, limitations and missing evidence.
2. Interview 6 professional researchers, 6 biotech BD/diligence analysts, and 6 life-science investors. Recruit through lawful, direct outreach. Do not collect sensitive clinical histories.
3. Ask each person for the *last real research decision*, where they found inputs, how long source verification took, what they missed, and what they used/paid for. Avoid only asking “would you use this?”
4. Run the same task with their tools and VialGrade's dossier; measure citation correctness, time to locate evidence and unresolved questions. Prefer realistic blinded tasks.
5. Seek repeat **use** (returning for fresh evidence) or a **specific commitment** (pilot request, procurement evaluation, paid trial) rather than interpreting verbal enthusiasm as demand.
6. If there is no advantage over an existing tool, choose a smaller workflow (e.g. issuer verification) rather than broadening the product.

These are research goals, **not completed interviews or validated signup rates**.

## AI as an evidence operator, not an unreviewed oracle

### Pipeline 1: Source ingestion (deterministic)
- Acquire permitted metadata from ClinicalTrials.gov, PubMed/NCBI, selected FDA openFDA feeds, and OpenAlex. Store source ID, originating URL, observed date, version, license status, collection method and immutable snapshot hash.
- Respect API rules. NIH E-utilities usually permits 3 requests/second without an API key; OpenAlex is CC0 for its own metadata but underlying article text may carry different rights. FDA public data may include third-party copyrighted attachments.
- Do not scrape whole paywalled papers, vendor reviews, proprietary databases or COA PDFs for redistribution without appropriate rights.

### Pipeline 2: Identity graph (deterministic + review)
- Normalize drug/compound synonyms, chemical names, developer/company names, sponsors, patent and trial identifiers. Preserve original names and conflicting attributions rather than collapsing possible distinct products.
- Encode entities: molecule ↔ scientific paper ↔ trial ↔ sponsor ↔ patent ↔ official regulatory notice ↔ laboratory report ↔ *sample*, not “all stock”.

### Pipeline 3: Claim extraction (LLM assisted)
- Use an LLM to propose structured claims **only from retrieved source text**: claim, source ID, exact supporting span, publication/observed date, context (human/animal/in-vitro), limitations, evidence tier, and unresolved conflicts.
- Programmatic validator checks that the cited excerpt exists and that dates/units/identifiers match source metadata.
- Scientific authorship and FDA regulatory status cannot be inferred by a model. Route uncertainty and clinical/legal conclusions to a named expert reviewer.
- Put conflicting claims side by side; never average clinical safety findings or suppress negative evidence to produce a neat answer.

### Pipeline 4: Intelligence queries (retrieval + synthesis)
- The user asks: “What changed in investigational incretin trials in the last 30 days?” The system retrieves dated record versions, shows changes and cites specific NCT IDs, not made-up conclusions.
- Answers carry confidence/coverage labels **about available records**, not guarantees of product efficacy, legality, or validity.
- Retrieval filters by source type, methodology and publication date. Never fill evidence gaps from model memory.
- Every exported report includes citations, as-of timestamp, methodology, source rights and a visible “unknowns” section.

### Pipeline 5: Monitoring and expert review
- Change detector: official status/record updates, new trials or disclosed outcomes, FDA updates, paper versions, corrections/retractions.
- Deterministic diff and materiality review first; optional LLM produces a narrative **draft**, checked against changed primary sources before release.
- Reviewer accepts/rejects findings with a retained rationale. Unreviewed AI must not publish a vendor-fraud accusation or specific product-safety conclusion.

### Quality evaluation gates
- **Citation grounding:** each asserted factual claim must map to retrievable source ID and exact supporting excerpt; test in a held-out reference set.
- **Entity mapping accuracy:** distinguish similar molecules, salt/forms and unapproved research vials from FDA-approved finished products.
- **Change alerts:** compare against actual dated versions; alert on a real change, not an LLM paraphrase of an old one.
- **Contradiction reporting:** retain relevant counterevidence; test deliberately contradictory papers/trials.
- **Safety/legal:** no dosage, purchase directions or physician substitution; no “approved” status without primary FDA support; no securities buy/sell recommendation.
- **Privacy/IP:** no training models on personal searches or restricted publications; do not send sensitive input to third-party models without separate grounds and contracts.

## Source-rights starting table

| Input | Intended use | Licensing/operational qualification |
| --- | --- | --- |
| FDA openFDA | Regulatory metadata, dated public actions | Public-domain/CC0 by default **except flagged third-party material**. Confirm endpoint updates and source restrictions. https://open.fda.gov/terms/ |
| ClinicalTrials.gov | Trial IDs/status/sponsors/outcomes | Public structured records; use official API/export terms, preserve record timestamps, do not infer trial registration proves benefit. https://clinicaltrials.gov/ |
| PubMed E-utilities | Publication metadata and abstracts | Respect NCBI API throttling; article texts and even some abstracts may be copyrighted. https://www.ncbi.nlm.nih.gov/books/NBK25497/ |
| OpenAlex | Cross-links and scholarly metadata | OpenAlex states its graph is CC0, but individual source full texts have separate licenses. https://help.openalex.org/data/licenses/ |
| Original lab reports and vendor photos | Sample provenance only if permitted | Audit permission, chain-of-custody and document origin individually. A pasted COA is NOT safe product certification. |
| Consumer behavioral events | **Do not collect/sell** during review | Inferred health interests may trigger Washington and other health-data requirements. |

## Commercialization (not turned on)

Best candidate: seat- or team-based subscriptions for **licensed, factual, source-auditable R&D intelligence**, paid by research organizations. Alternative: issuer-verification workflow sold to legitimate labs if co-designed with a lab. A later research-only data/API product is possible if content rights and adverse-claim substantiation are solved.

**Do not** monetize identifiable/hashed visitor interests, compound watchlists, user query history or behavioral data. Do not accept vendor commission for sale traffic. Do not buy/sell or recommend restricted drug products.

### Securities law branch if the product expands into investment recommendations

Investment intelligence is not automatically securities advice, but under the Investment Advisers Act, providing compensated reports or advice about securities can raise adviser-status questions. The SEC describes factual, bona fide, impersonal publications differently from personalized investment advice. Avoid “buy these biotech stocks” recommendations or tailored portfolio analysis before separate securities counsel review.

Source: https://www.sec.gov/files/divisions/investment/iaregulation/memoia.htm

## Roadmap ledger

**Now / Phase 0**: evidence-only compliance branch. Public source browsing, research-purpose notice, concept page. New consumer accounts, verification uploads, personal profiles and vendor checkout paused. Fix all CI and review privacy/rights. Production unchanged.

**Next / Phase 1**: 5 source-anchored professional dossiers using only permitted material. Explicit research-user interviews and task-based benchmarking. No automated health or financial recommendations.

**Phase 2**: Verified ingestion of official trial, article-metadata and FDA datasets. Typed claim/evidence graph, exact citation validator and human-reviewed export.

**Phase 3**: Change monitoring + auditable AI research assistant if the narrower research task has demonstrable user retention and enterprise usefulness.

**Parking lot**: unapproved-peptide consumer shopping, paid vendor ranking, affiliate sales, public AI predictions of therapeutic success, automatic personalized alerts, clinical or securities advice.

**Open decisions**: intended legal operator; users' real jurisdiction(s); COA licensing; whether users are researchers, BD analysts or funds; whether the best first wedge is scientific evidence mapping or lab-document integrity.

**Goal check:** the popup and legal notice are just an enabler; the real product is better evidence and more reliable R&D decisions. Neither a checkbox nor a name change creates legal compliance.

**Release decision:** the current PR stays draft until exact-head CI is green, the preview is verified, source and privacy obligations are resolved, and qualified legal counsel signs off on the specific published version.


## October 17, 2026: working multi-source research release candidate

**Goal anchor.** Make public peptide R&D evidence auditable for scientists and biotech research/BD analysts. A good answer preserves a source identifier, date, link, uncertainty and limits. No peptide marketplace, dose/safety advice, personalized financial advice or health-interest data sales.

**Roadmap pivot.** Earlier: a concept page, then five curated dossiers, then a complete source graph. Revised: three working metadata-only keyword dossiers and a side-by-side research interface first; use this to validate workflows, then create five manually source-reviewed dossiers, a typed evidence graph and expert-supervised AI claim extraction. The current keyword dossiers are NOT systematic reviews and do not fulfill the five-curated-dossier milestone.

**Shipped in the draft branch:**
- A research workspace with three fixed R&D topics. Links to ClinicalTrials.gov studies by NCT ID and OpenAlex works by canonical ID or DOI.
- Timeline sorted by the recorded trial update date or work publication date, with original-source links and retraction flags.
- Cross-topic sample coverage comparison. Counts are strictly returned SEARCH SAMPLES, not complete research totals or efficacy scores.
- Client-side source filters, ordering, a Markdown source register, and one-click local export. This does not create a personal account or store a query.
- A research-only release shell without the old vendor catalog, search overlay, watchlists, seller navigation, recommendations or push worker. Previous VialGrade app-shell caches are retired.
- Provider outage and malformed-response handling. The UI displays unavailable sources rather than asserting that no research exists.
- Fixed source queries on the server, with six-hour cache directives. Optional OPENALEX_API_KEY is server-side only and is not set by this work.

**What is not shipped:** verified efficacy/safety findings, research-claim extraction by a model, automatic contradiction judgments, complete trial/paper coverage, FDA product-status determinations, company/financing datasets, user research accounts, subscriptions or regulatory clearance.

**Source rights and cost boundaries:**
- OpenAlex describes its own metadata as CC0. The corresponding full article PDFs/text retain their own copyright and license: https://help.openalex.org/data/how-its-built/ and https://help.openalex.org/access/fulltext/.
- OpenAlex changed to API-usage pricing in 2026. Keyless access has a shared smaller daily budget, so use caching and always show outages honestly: https://help.openalex.org/api/authentication/.
- ClinicalTrials.gov public data are accessed through the official v2 studies API. Trial registration and study status are not statements of clinical success: https://clinicaltrials.gov/data-api/api.
- There are no automated full-text downloads, copied vendor reviews, seller certificates or posted snippets of copyrighted article text in the new public research workspace.

**Verified technical behavior so far:** local lint/typecheck, targeted unit tests and production build; an evidence-only browser run covering anonymous access, original-source controls, citations, legacy-data quarantine and legal-page availability. Final GitHub CI, production-like environment, permissions to other material and regulatory counsel review are separate gates.

**Current phase:** release-candidate verification and source metadata integrity.
**Next:** full suite and preview verification; then manually validate relevance and completeness with professional researchers before automated AI claim summaries.
**Parking lot:** marketplace, affiliate fees, paid vendor grades, personal watchlists, treatment and investment recommendations.
**Open decisions:** operating entity and jurisdiction; history/backup data-rights procedures; ownership of older reports; first B2B customer niche; institution willingness to pay; whether optional API keys are worth managing.

**Goal check:** The benefit is less time reconstructing evidence, not more pages or a “research use only” pop-up. AI only becomes useful when its citations and claims can be validated against licensed primary material.

**Release decision:** Remain in draft until the exact-head CI is green, preview and access controls are verified, the actually exposed sources and privacy practices are legally reviewed, and there is an operator-approved release of the research-only configuration.
