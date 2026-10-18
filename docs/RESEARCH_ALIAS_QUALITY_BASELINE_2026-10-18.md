# Research-identifier quality baseline, October 18, 2026

## Purpose

This is a **read-only, diagnostic experiment** using three carefully scoped historical peptide development-code candidates and the official ClinicalTrials.gov v2 API. It assesses what the legacy compound taxonomy could contribute to science source discovery. It does not import historical vendor data, consumer data, COAs, reputation signals, private research queries or clinical health records. The public search terms, source counts and allowed routes remain unchanged. A separate match-location annotation in this branch labels returned study records as intervention-field, title-only or keyword-only matches.

Run:

    node --import tsx scripts/evaluate-public-research-identifiers.mjs
    node --import tsx scripts/evaluate-public-research-identifiers.mjs --live

The first command is offline. The second makes a maximum of six **fixed**, non-personal registry search requests, capped at 100 returned study entries per query. The script does not write to a database or file, and intentionally prints aggregate diagnostics rather than old vendor records or source text.

## Candidate identity evidence

| Research topic | Legacy development-code candidate | Example official study | Source notes |
| --- | --- | --- | --- |
| Retatrutide | LY3437943 | [NCT05929079](https://clinicaltrials.gov/study/NCT05929079) | Official intervention metadata names Retatrutide and lists LY3437943 among other names |
| Cagrilintide | NNC0174-0833 | [NCT02958085](https://clinicaltrials.gov/study/NCT02958085) | Earlier registry entries use this development code; candidate equivalence must be checked against scientific/issuer references |
| Tirzepatide | LY3298176 | [NCT02759107](https://clinicaltrials.gov/study/NCT02759107) | Official intervention metadata names Tirzepatide and lists LY3298176 |

Additional aliases from the legacy taxonomy such as Mounjaro, Zepbound, Triple G, Cagri and AM833 are **not automatically included** in the production source pipeline. Brand names, investigational codes, molecule families and combination products must not be collapsed into one entity without a reviewed identity relationship.

## Empirical fixed-query observations (2026-10-18 16:30 UTC)

The following were obtained from the official ClinicalTrials.gov v2 API and the read-only evaluation script. 'Alias-only' means absent from the **returned canonical query sample**, not absent from every relevant study or from the full registry. Returned counts reflect text-query behavior, not clinical development maturity.

| Topic | Canonical query returned sample / source-reported total | Alias query returned sample / source-reported total | IDs found in alias sample but not canonical returned sample | Alias-only intervention-field matches | Alias-only title-only | Alias-only search-hit-only |
| --- | --- | --- | --- | --- | --- | --- |
| Retatrutide | 34 / 34 | 34 / 34 | 1 | 1 | 0 | 0 |
| Cagrilintide | 45 / 45 | 13 / 13 | 9 | 8 | 0 | 1 |
| Tirzepatide | 100 / 319 | 81 / 81 | 60 | 60 | 0 | 0 |

**Interpretation:** The cagrilintide canonical query returned all 45 source-matched records, while the NNC0174-0833 query returned nine IDs not among those 45. Eight additional records explicitly name one of the scoped identifiers in an intervention name field; one did not, making it a **keyword-only candidate** unsuitable for automatic inclusion. This demonstrates both potential extra coverage and the need to reject broad-text false positives.

**Important limitation for tirzepatide:** The canonical source reports 319 hits, but the script retrieves only 100. The 60 differences relative to the first 100 are **not** proof that 60 studies are absent from a full Tirzepatide search. More pages and reviewed entity/relevance criteria would be needed for a coverage estimate.

An intervention-field match does not mean the drug was the central investigational treatment. It could be a comparator, co-administered drug, or listed control. Neither the query counts nor match categories establish efficacy, safety, drug approval, quality or regulatory status. Results are time-sensitive.

## Where these candidate codes enter the system

They enter the scoped candidate map in src/server/intelligence/topic-identity-candidates.ts and the offline/opt-in diagnostic script. The current public trials source uses this map **only to annotate where existing keyword-result names appear in each returned record**, without sending alias expansion queries or changing the sample membership. The annotations are visible as uncertainty notes in the research evidence trail and citation export. There is no homepage, OpenAlex ingestion, live data store, commerce, or user-profile change.

The association classifier distinguishes:

- intervention-recorded: a candidate name/code appears in a structured intervention name or other-name field; still not proof of intervention role or successful outcome;
- named-in-title: a candidate appears in an official or brief title but is not verified through the intervention list;
- search-hit-only: neither intervention nor title establishes the identity; **do not promote automatically**.

String matching uses token boundaries and recognizes separators in development codes, reducing accidental prefix/suffix matches. This is a triage rule, not a biomedical entity-resolution model.

## Acceptance gates before public alias expansion

1. Assemble 30-50 independent reviewer-annotated study examples from canonical and alias candidate queries; include unrelated studies, combination/comparator studies and historically renamed codes.
2. Compare each candidate against the original record, its intervention fields, the sponsor/developer where relevant, and primary-source identity evidence. Record false positives, false negatives and conflicts. Check exact alias equivalence separately.
3. Distinguish a **retrieval timestamp** from a study's last update and from a newly observed scientific finding. A new returned record is not necessarily a new event.
4. Preserve source IDs, primary URLs and uncertainty. No false cross-drug linkage, no unsupported FDA approval claims, and no extrapolation from laboratory COAs to finished-vial safety.
5. Assess rate limits/costs and partial-provider failure states. A failed alias query must be shown as unavailable, not as proof of absence.
6. Only if this improves source-level accuracy should a reviewed subset enter the public research index, behind a tested release gate. No personal query tracking or marketplace feature reactivation.

## How this fits the roadmap

See docs/PRODUCT_EXECUTION_LEDGER.md and issue #28. This work advances source relevance and entity identity, which are prerequisites for meaningful version-change intelligence. The adjacent workstreams for legal/privacy (#24), working email (#23), customer validation, UI improvements (#27) and archived commerce (#26) remain active. The future milestone is **a verified, dated change report for a research asset**, not a longer unsupervised list of web search results.
