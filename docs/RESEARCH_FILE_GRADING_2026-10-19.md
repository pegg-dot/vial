# VialGrade: the marketplace framework with research-file grading

Local milestone, 2026-10-19. NO GitHub push, Vercel deployment,
customer database modification, data import, purchase or referral restart.

## Pinned product goal

VialGrade should give scientific researchers and biotech analysts an intuitive
scientific index with the speed and richness of the original marketplace:
browse categories, see dossiers, compare concepts, and follow exact source
records. The core benefit remains a useful, verifiable source-reconciliation
workpaper, not simply "more stuff than PubMed" or a prettier list.

We can grade the completeness of **our research files** from explicit
source checks. We cannot responsibly claim that peptide X is better,
safer, more effective, legally marketable or a better investment on the
basis of linked metadata or an "RUO" disclaimer.

## What the old application really graded

Verified against the original Git tag
archive/marketplace-pre-research-2026-10-18:
- Vendor VialGrade result decomposed FOUR dimensions: lab testing,
  government/regulatory records, buyer reports and operating information.
- It displayed the reasoning alongside the letter and withheld a letter
  where coverage was insufficient. This structure was useful.
- Other screens had collections, compound explainers, trust-tier chips,
  comparison, quick view and batch/price data.
- Vendor purity certificates, retail prices, vendor reputation, buyer
  click data, procurement advice and checkout cannot automatically
  become scientific claims about a peptide's underlying biology.
  These historical commerce data were NOT imported.

## Explicit pivot / order correction

**Old:** Marketplace UX shell -> professional pilot -> expand validated
research evidence.

**New:** Marketplace UX shell -> restore explainable three-dimensional
research-file grading and source-check details -> local interactive Mac
preview + correctness and accessibility testing -> researcher/analyst
pilot + independent methodologist checks -> only then expand review
coverage and consider one owner-approved batched production release.

**Why:** the user correctly observed that we dropped much of the
information architecture and grading transparency that made the old
product helpful. Scientific usefulness also depends on exposing the
difference between relevant studies, original experiments and vague
name-search hits, not just having links.

**Revisit:** after ten observed tasks (five biological scientists,
five biotech diligence users) comparing workpaper success/time/errors
with actual workflows and after qualified scientific review of the
published case and scoring criteria. If no advantage, revise job-to-be-done
before adding thousands of unverified compounds.

## Pilot research-file grading methodology

Method: research-file-coverage-v1, curated on October 19, 2026.
Three *source layers individually anchored by VialGrade*:

1. **Molecular reference:** an individually selected PubChem CID for
   the named compound, versus unresolved SID or generic variant source.
   A source identifier is NOT measured batch purity or biochemical
   efficacy.
2. **Named registry intervention:** one selected exact ClinicalTrials.gov
   NCT whose intervention field was checked to name the chosen peptide.
   This is ONE example, not all trials, full paper review or regulatory
   status.
3. **Original experiment:** one individually identified PRIMARY
   scientific experimental paper for the exact peptide and stated model,
   not a generic literature search or secondary review. Only the
   pexiganan/MSI-78 bilayer source (PMID 12719236) is currently admitted
   in the starter corpus, with clear limitations.

A = all 3 source layers linked. B = 2. C = 1. No letter when
the entity is not unambiguously resolved for grading, even when an
intervention record is available. This is NOT a formal GRADE certainty
rating of an outcome and cannot be used to decide whether to buy,
use or experiment with a peptide. The known methodological domains
for real study certainty are risk of bias, inconsistency, indirectness,
imprecision and publication bias. Review Cochrane
https://training.cochrane.org/handbook/current/chapter-14

Never infer "no research exists" from "not reviewed in this file".

Current 16 curated files:
- A: Pexiganan, 1/16.
- B: Semaglutide, Tirzepatide, Cagrilintide, 3/16.
- C: 10/16 with one curated compound identity reference only.
- Ungraded: Retatrutide (PubChem SID identity qualified),
  Nisin A (generic nisin reference does not resolve the variant).
Neither retatrutide nor nisin is necessarily less scientifically
researched than another subject. Their status is an honest identity gap
in this deliberately limited starter review.

For Pexiganan, a source paper about MSI-78 in model lipid bilayers is
NOT evidence that clinical trials succeeded. For Magainin 2, that paper
concerns a derivative, so the original peptide DOES NOT inherit its
"primary original experiment" checkbox. The independent scientific
review of interpretations remains pending.

Citable public source method:
- NIH clinical registration identifiers and intervention definition:
  https://clinicaltrials.gov/policy/protocol-definitions
- Cochrane scientific certainty method (which this is NOT):
  https://training.cochrane.org/handbook/current/chapter-14
- NIH translational science spectrum, which is not a single grade:
  https://ncats.nih.gov/about/about-translational-science/spectrum

## What the interface now does

- Keeps the marketplace-style category pills, mint/black visual art,
  swipeable selected-study cards, denser catalog, quick-view panel and
  context compare tray.
- Adds a small, neutral "File coverage A/B/C/ungraded" mark on
  subject cards, quick views, dossiers and compare cards.
- Every mark points to a decomposed file-grade card: three source
  checks with the exact reason, linked original record (if any),
  missing evidence status and subject-specific research next step.
- Adds a complete PUBLIC methodology at /intelligence/grading, which
  deliberately distinguishes our file completeness letter from
  clinical evidence grading.
- Enables filters for file grade and sorting by in-file documentation
  rather than an unsupported "best peptide" score.
- Maintains research and analyst perspectives, source workpaper,
  official NIH record lookups and 410 storefront/checkout/referral blocks.

## Validation and release gates

1. Exact research-only production build and a separate permanent
   Documents/VialGrade/Research_Preview_App build.
2. TypeScript, ESLint, unit tests for all 16 scores, original-source
   mapping and no-letter cases, Playwright for the new grading route,
   grade filters, quick-view, dossier, comparison, mobile and links.
3. Full security, role and accessibility audits, no-sale APIs.
4. Default historical release regression so archived operator systems
   remain available in Git without unexpectedly mounting on public
   research surfaces.
5. Original-source checks and independent scientist/methodologist
   judgment are distinct from passing engineering checks.
6. No GitHub PR, Vercel preview or deployment for this prototype.
   Open local Safari only after the exact build passes.

## Current / next / parked / open

Current: three-source-layer file-grade integration on branch
local/vialgrade-research-grading-2026-10-19, layered on local
marketplace-style preview 0f22e86.

Next: real user preview and scientific source-review calibration for
which research questions or evidence discrepancies matter most.
Compare against PubMed, Scholar, ChatGPT, Claude and specialist
sources. Validate both researchers and analysts separately.

Parked: thousands of vendor-derived listings, ingredient purity
certification, commercial seller grade, research material
recommendations, pricing, market comparison, batch verification,
automated clinical verdicts, drug efficacy/safety scores,
personalized research histories and commercial source licenses.
Commercial lab-material questions need a separate expert legal and
quality-evidence review, not just research-use labels.

Open: scientific expert signoff; actual professional demand; source
rights; missing publication coverage; individual molecular ID nuances;
historical customer privacy; domain mailbox routing; decision to
batch a production deployment.

Goal check: a file completeness grade is an ENABLER for accurate
source reconciliation, not proof one research program is promising.
