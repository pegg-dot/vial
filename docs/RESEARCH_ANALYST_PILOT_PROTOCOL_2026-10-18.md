# VialGrade Intelligence: first researcher task trial

Date: October 18, 2026.
Status: design for a future user validation study; NO participants recruited
and NO product-market-fit or time-savings claims established.

## Why this exists

The product hypothesis is that a research professional can resolve linked
trial-vs-paper evidence questions faster, and with fewer misclassifications,
using VialGrade than by manually navigating ClinicalTrials.gov, PubMed
and Google Scholar. It is NOT a claim that the new product has broader
coverage, is more accurate, or would attract subscription revenue.

First candidate users: biotech scientific/BD associates, independent scientific
diligence analysts, or researchers reviewing investigational molecules.
Avoid targeting people for their private medical or treatment interests.

## Study design

Find 6 to 10 consenting professionals if possible (five is a directional
minimum, not a basis for statistical confidence). Use the same *task* and
identical source-access time limits. Randomly assign their FIRST attempt
to either their regular tools or the local VialGrade research audit, so
everyone is not biased by first learning the answers on a different tool.
Give the other tool after submission for usability feedback, but do NOT
compare second attempts as unbiased independent timing observations.

Record the analyst's task-completion time, correctness against original
official URLs, citations opened and requests to use the tool again.
No personal medical information, full search history, screen recording
without explicit consent, or account profiles. Never automatically
ingest a tester's private research or employer documents.

## Actual prompt to hand a test participant

An analyst has four selected cagrilintide-related studies with NCT IDs
NCT03856047, NCT04982575, NCT05804162 and NCT07564414. The analyst's
client wants a brief, source-auditable summary of publication availability,
NOT a clinical or investment recommendation.

For NCT05804162, answer whether a missing ClinicalTrials.gov results
section means there is no published paper, and show exact official
NCT/PMID source URLs. For NCT04982575, explain why the registry reference
role BACKGROUND and the PubMed article's exact NCT association can both
be true, and which source is asserting each field.

Check whether the records allow healthy volunteers and whether the
registered conditions and study-arm labels differ. Do not assume that
identical compound names imply identical participant populations.

Separately identify which of these selected records only names
CagriSema as the intervention, and why that should not automatically
be treated as an identical standalone-cagrilintide exposure. State what
remains unanswered and do not compare cross-study efficacy.

Produce a short answer with at least two original-source links.

## Scoring rubric (independent reviewer)

Give one point for each item, with supporting official links required
for credit:

1. Accurately identifies NCT05804162's current registry results-section
   status (not present in the checked record), without claiming no paper exists.
2. Finds PubMed PMID 39279639.
3. Verifies PMID 39279639 is indexed under exact NCT05804162, not just
   based on title keywords.
4. Preserves the NCT05804162 registry citation role RESULT.
5. Finds PubMed PMID 37364590 for NCT04982575.
6. Correctly preserves the registry reference label BACKGROUND for this
   citation without automatically declaring it an error.
7. Verifies that PubMed indexes PMID 37364590 under exact NCT04982575.
8. Separately notes that NCT07564414 is a CagriSema combination-name
   record and the original source needs trial-specific intervention review.
9. Distinguishes posted registry results, indexed journal papers and
   clinical claims/regulatory compliance instead of merging them.
10. Cites official, working primary source URLs for the study and papers.

An independent scientific reviewer should adjudicate ambiguous answers
against the then-current official records; this answer key is a
dated task fixture, not a permanent assertion about changing registries.

## Metrics

- Time until a correct linked answer with sources.
- Score out of 10, plus count of false exact-NCT cross-links or fabricated
  citations (these failures are release blockers).
- Number of original records opened, and whether the user needed to
  search for a paper separately.
- Observed friction from missing links, inconsistent labels or misleading
  page descriptions.
- Unprompted return-use interest or requests for another real task.

Preliminary decision gate: zero fabricated sources, zero falsely
confirmed NCT/PMID pairs, equal-or-higher accuracy, and at least three
of five observed professionals completing the task faster in a
fair comparison. The threshold is a hypothesis, NOT an achieved result.

## Why a product pivot might still be necessary

If participants already resolve this in under a minute with existing
tools or report that this is an uncommon task, avoid building a
generic AI research product around it. Ask what real research
decision they repeatedly struggle with, then test a narrower job.
The original marketplace remains archived but inactive and is NOT
a fallback to selling unapproved research compounds.

## Operational separation

Study results should be entered into a local, consented task-level sheet
without company-confidential research notes or health profiles.
Do not deploy the new site to collect participants without separate
user approval. Email delivery, legal/privacy/source-rights and scientific
validation workstreams remain open in the execution ledger.
