# Research publication reconciliation: local cagrilintide test

Date: October 18, 2026.
Status: LOCAL branch only. No GitHub push, PR, preview build or deployment.

## Goal anchor

Help a scientist or biotech analyst complete a source-auditable research task:
establish which selected trial investigates the actual molecule, what was
registered, whether results are shown in the registry, which publications
are actually indexed under the exact NCT ID, and what remains unknown.

Not an ecommerce product catalog, medical recommendation, outcome-comparison
algorithm, Google Scholar replacement or authorization to sell any product.
Four selected studies are NOT systematic or exhaustive coverage.

## Specific source-reconciliation result

Question: Among four selected cagrilintide-related ClinicalTrials.gov records,
which trials have posted registry results, which cite PubMed papers, and which
papers independently index the exact same trial ID?

| Registry ID | Results section in current registry response | Registry-linked PMID | Registry label | PubMed independently indexes this NCT | What to review |
| --- | --- | --- | --- | --- | --- |
| NCT03856047 | Present | 34798060 | RESULT | Yes | Registry results and a published article are separate original sources. |
| NCT04982575 | Present | 37364590 | BACKGROUND | Yes | The registry citation label is BACKGROUND even though PubMed associates the paper to this same NCT; read original article before classifying its findings. |
| NCT05804162 | Not present | 39279639 | RESULT | Yes | The trial has a published paper despite having no independently posted registry results section in this retrieved record. |
| NCT07564414 | Not present | No PMID in the selected protocol reference fields | None | Not checked | Combination-name trial; absence of a citation does not imply no paper exists. |

Primary-source URLs:
- https://clinicaltrials.gov/study/NCT03856047
- https://clinicaltrials.gov/study/NCT04982575
- https://clinicaltrials.gov/study/NCT05804162
- https://clinicaltrials.gov/study/NCT07564414
- https://pubmed.ncbi.nlm.nih.gov/34798060/
- https://pubmed.ncbi.nlm.nih.gov/37364590/
- https://pubmed.ncbi.nlm.nih.gov/39279639/

## Mechanism

1. Four preselected ClinicalTrials.gov API v2 study IDs are fetched read-only,
   bounded and cached in Next.js for up to six hours.
2. Their protocol references are parsed into exact PMIDs, bounded citation
   strings, and their registry-authoritative type labels (RESULT, BACKGROUND,
   DERIVED or OTHER). The application never silently reclassifies them.
3. All unique PMIDs are checked together with ONE official NLM PubMed EFetch
   XML request. The parser extracts only metadata: PMID, title, journal,
   publication date and the exact ClinicalTrials.gov databank accessions.
   Article abstracts and full text are not exported or stored.
4. Confirmation requires PubMed's source record to list the exact NCT in that
   databank accession, not merely mention the compound or have a similar title.
5. The UI separates original registry results-section status, registry
   reference classification and PubMed study association. Any unavailable or
   uncorroborated source link stays visibly uncertain.
6. The guided audit separately shows bounded registered eligibility metadata,
   including listed conditions, age, healthy-volunteer eligibility and trial
   arm labels. These are source fields, NOT verified enrolled-population
   distributions or clinical dosing instructions.
7. The source-linked Markdown audit can be downloaded locally in-browser.
   No user research-interest queries, account profiles or old marketplace
   interaction histories are sent to external providers.

An on-demand live source-drift check is available through the local command:

    npm run audit:study-evidence

Exit 0 is current-source concordance, exit 1 means source metadata needs
human review, and exit 2 means a provider was unavailable. This is an
optional test, not a cron or a subscription feature.

NIH query count: one bounded bulk PMID lookup per cache interval, no more than
twelve selected pairs. The source XML response size is bounded and a provider
failure is reported as unavailable, never "no paper exists."

## Limitations

- A paper and a registry results section are DIFFERENT artifacts. Their
  differing availability is NOT a determination of legal reporting compliance.
- A PubMed trial association and a registry BACKGROUND tag are not necessarily
  contradictory. Keep both labels, then read the paper.
- The protocol-linked citations are not a complete literature review; more
  papers can exist and may be absent from registry metadata.
- Indexed papers are not automatically high-quality research, clinical
  efficacy or safety proof, medical advice, investment advice, product
  authorization or permission to sell.
- We have not collected two dated verified source snapshots, so no claim of
  historical changes is supported by this feature.
- Technical source accuracy does not establish that researchers want it or
  would pay. The target audience remains an unvalidated hypothesis.

## Independent user task benchmark

Give at least five professionals an actual recent research task. Compare their
current method (PubMed, Google Scholar, ClinicalTrials.gov and existing paid
tools) with this source-reconciliation workflow. Measure correctness from
the official links, total completion time, errors and return-use interest
with consent. Collect only task-level results, not health history or a
personalized medication-interest profile.

Tentative gate (not achieved): zero fabricated citations, zero false exact-NCT
links in an independently reviewed sample, and faster completion for at least
three of five professionals without lowering correctness.

## Roadmap ledger

Current: source identity and cross-source registry-publication evidence audit.
Next: independent scientific review plus task benchmark with real analysts.
Deferred: broad indexing, generic AI chatbot, claims about changes over time,
user personalization, rebrand, pricing and archived retail marketplace.
Open: source rights and retention review (#24), receiving-mail verification
(#23), SME sign-off, and product-specific regulatory/legal counsel.
No GitHub push or production deployment has been requested for each iteration.
