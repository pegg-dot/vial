# Research Explorer: first-use scientist and analyst evaluation

October 18, 2026. Pilot design only. No participants, observed time savings,
paid commitments, or professional scientific signoffs have been obtained.

## What needs to be proven

The catalog is a way to FIND a scientific question; the valuable part is
whether the user can then identify the exact substance and original study
evidence with fewer mistakes and less effort than PubMed, ClinicalTrials.gov
and an LLM chat. We must not assume a longer source list is more accurate.

Recommended participants: five independent research scientists and five
biotech diligence professionals, recruited with explicit consent.
Participants work only with public sources. No treatment decisions, private
company research, participant health data or stock recommendations.

First-attempt design: randomize VialGrade versus each participant's actual
baseline tools (ChatGPT, Claude, PubMed, Scholar, ClinicalTrials.gov, or
specialist platform as applicable). Do not grade their second tool attempt as
an independent measure. Record correct identity, source specificity, task
completion time, navigation mistakes, confidence, and recurring-use intent.

## Scientist tasks

| # | Prompt to user | What the adjudicator should check |
|---|---|---|
| S1 | Find a peptide involved in amylin-pathway research, then find an actual registered standalone trial. | Cagrilintide identity CID 171397054; NCT05804162 intervention; don't conflate CagriSema combination studies. |
| S2 | Investigate a natural host-defense peptide and identify a separately designed antimicrobial analog. | Magainin 2 CID 16130189 versus pexiganan CID 16132253; do not combine data across identities. |
| S3 | Starting with a native inhibitory neuropeptide, find a constrained synthetic analog and explain what remains unverified. | Somatostatin-14, octreotide or lanreotide separate PubChem identities; receptor and form specifics remain source-dependent. |
| S4 | Find a conotoxin-derived structurally constrained peptide and a scientific question about its target interaction. | Ziconotide CID 16135415; distinguish channel selectivity hypothesis from demonstrated study effect. |
| S5 | Find the paper under a specified trial where the official registry results section is not posted. | NCT05804162 official results-section status; PMID 39279639 exact NCT link and registry RESULT role; no assertion about reporting legality or efficacy. |

## Biotech analyst tasks

| # | Prompt to user | What the adjudicator should check |
|---|---|---|
| A1 | Compare the research program evidence context for a dual-receptor and a multi-receptor peptide. | Tirzepatide versus retatrutide target/pathway descriptions; distinct molecular records; no cross-trial efficacy comparison. |
| A2 | Find the clinical study attached to a pexiganan development record and verify what was tested. | Trial NCT01594762 intervention named topical pexiganan cream; distinguish magainin ancestor research. |
| A3 | Review a compound for which a name search gives multiple molecular identifiers. Explain how you'd avoid attributing the wrong records. | Tirzepatide PubChem CID 156588324 main page; variants from name search not automatically merged. |
| A4 | Review a program with no main PubChem compound CID but a source reference collection SID. | Retatrutide SID 528343961; no invented equivalent compound CID, sodium salt or impurity treated as identical. |
| A5 | Explain how you'd verify that a cited study/paper relationship is real instead of relying on broad mentions of a drug name. | Open exact NCT and PMID links, preserve registry labels RESULT/BACKGROUND, check PubMed exact accession; distinguish uncertain cases. |

Original reference starting points:
https://clinicaltrials.gov/study/NCT05804162
https://pubmed.ncbi.nlm.nih.gov/39279639/
https://clinicaltrials.gov/study/NCT01594762
https://pubchem.ncbi.nlm.nih.gov/compound/156588324
https://pubchem.ncbi.nlm.nih.gov/substance/528343961

The review panel must independently verify all task fixtures before testing;
these are *candidate answer keys*, not a completed adjudication.

## Scorecard

Per first attempt:
- Identity correct and no unreviewed alias/variant merge (0-2)
- Primary source actually opened or cited exactly (0-2)
- Correct distinction between registry metadata and a paper (0-2)
- Evidentiary limitations stated without fabricated claims (0-2)
- Complete answer and portable source notes within time (0-2)

Record minutes, wrong links, false exact claims, abandoned tasks, and a
spontaneous request to use the tool on another work question.

Tentative **go** criteria:
- Zero invented PubMed identifiers, study IDs or false confirmed matches
  in the reviewed pilot.
- Fewer mistakes and demonstrably faster completion than current tools
  for at least three of five professionals in EACH segment.
- At least two teams can identify an actual recurring task and ask for a
  working pilot.

If those fail, don't pad out the compound catalog or claim an AI product
differentiator. Narrow the job and improve evidence grounding instead.
