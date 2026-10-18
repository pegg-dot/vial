# VialGrade usefulness refocus — local work only

October 18, 2026. This is a product hypothesis and a LOCAL experiment, not a validated
business, clinical study, deployment, expert scientific conclusion or permission to sell.

## Goal anchor

**The job:** Reduce the time and errors involved in preparing a source-auditable research
brief for a specified experimental molecular program. Instead of returning a list of
papers, answer: which official studies concern the actual compound, what do they measure,
which have registry results, what has changed since a known earlier observation, what
sources support the facts, and what is still unknown?

**First buyer hypothesis:** a small biotech research/BD or independent scientific
diligence team that cannot rely on a large curated database for every question. This is
NOT a proven customer segment. Test scientists and diligence users separately before
picking pricing, terminology or scope.

**Non-goals:** general literature-search engine, another ChatGPT-style medical answer,
clinical efficacy rankings, human-use recommendations, approval prediction, vendor
trust grades, retail peptide purchases or behavior-based targeting.

## Competitor reality

- Google Scholar provides broad scholarly search, citations, related works and recent-work
  discovery. Its corpus is far larger than VialGrade's current 8-per-topic OpenAlex
  sample. https://scholar.google.com/intl/en/scholar/about.html
- ClinicalTrials.gov is the original authoritative trial-register record for NCT IDs,
  interventions, outcomes, recruitment statuses, registry results and posted record
  dates. The current API returns the latest record; it does not by itself give us an
  independently verified history of changes.
  https://clinicaltrials.gov/data-api/api
- Citeline Trialtrove already offers substantial curated clinical-trial detail,
  trial benchmarking and AI-assisted enterprise workflows. We cannot claim that
  VialGrade has comparable coverage.
  https://www.citeline.com/en/products-services/clinical/trialtrove
- TrialRedline already sells field-level clinical registry edits, sponsor mapping and
  event tracking. "We monitor trial status changes" alone is not a unique advantage.
  https://trialredline.com/

**Conclusion:** Public metadata and a basic citation export are a foundation, not a
product. A larger index, generic AI summaries, visual redesign or more topic filters
will not by themselves establish value. Nor is a generic trial-change feed unique.

## Pivot callout: value before coverage

Previous near-term sequence: add aliases and source listings -> improve filters/landing
page -> expand coverage -> consider AI summaries/rebrand.

Revised near-term sequence:
1. Test one **real research task** end-to-end with primary source records and honest gaps.
2. Measure researcher/analyst performance against direct registry searches and their
   existing tools, not a weak straw-man baseline.
3. Improve only the mechanics responsible for missed facts, wasted work and bad
   citations (identity, study design, source lineage, record-version provenance).
4. Add cross-source discrepancy checks and dated changes only when reliable and needed.
5. Expand sources/audiences and rebrand only after repeated task usage.

What is deferred: broad search, source-count bragging, a general-purpose clinical AI
chatbot, subscription plans, styling overhaul and large-scale dataset ingestion.
Revisit after at least five observed professional tasks and a quality review.

## Working proof: Cagrilintide study audit

The local branch prototype uses four pinned official studies with bounded,
read-only API calls and a 6-hour Next.js request cache:

- NCT03856047 — older NNC0174-0833 development-name study;
- NCT04982575 — cagrilintide + semaglutide study with separately named drugs;
- NCT05804162 — cagrilintide study with no registry results section in the
  October 18 public record;
- NCT07564414 — names CagriSema, a distinct combination-product label
  that **cannot be automatically treated as direct cagrilintide intervention evidence**.

The local page also links a dated primary-source sponsor statement describing CagriSema's
composition, clearly separated from the registry's own intervention labels. This is
an additional source-identity cross-check, not a basis for efficacy claims.
The local page shows the original study URLs, registered outcomes and timeframes,
enrollment type (actual/estimated), phase, status, primary completion type and date,
the existence or absence of a registry results section, and explicit source-identity
ambiguities. It exports a factual, source-linked Markdown audit in the browser.

This page is NOT a complete program review, an efficacy comparison, a finding about
results-posting compliance, a systematic literature review or a longitudinal change
report. It purposely does not auto-merge named combination products into standalone
molecules or infer treatment effects from study registration.

## Next real value test

Give 5+ professionals a recent real research question, not "Do you like our app?"
Ask them to answer with Google Scholar, ClinicalTrials.gov and any existing tools
they already use; then evaluate the same task with VialGrade.

Collect **task-level** evidence with consent and no patient histories:
- Could they reach a correct, fully cited answer?
- How many source records did they open and how long did it take?
- Which false links, missing studies or dates delayed the answer?
- Does a compact audit with gaps and explicit uncertainty save time?
- Will they return with a second genuine task or request a pilot?

**Initial go/no-go bar (a hypothesis, not achieved):** zero fabricated source links,
no false direct molecule/combination joins in the reviewed task set, visibly lower
research time for at least 3 out of 5 users on their task, and several requests to
use it again. If it fails, narrow the task or explore a laboratory document-identity
workflow; do not mask the failure with a visual rebrand.

## Engineering, data and cost controls

- Work on a LOCAL Git branch. Do not push to GitHub, create preview builds, merge
  to main or deploy to Vercel for individual iterations.
- Run TypeScript, unit tests, local Next.js builds and Playwright against a local
  server. Those do not consume Vercel deployment build minutes.
- When a milestone has task-test value, batch the changes into one reviewed PR,
  one CI/preview cycle and one explicitly authorized production deployment.
- This task uses no paid LLM, market source, third-party COA, visitor-profile
  database or additional commercial API.
- The archived original marketplace remains preserved and inactive. It is not a
  fallback to re-enable unapproved-drug purchases.
- Existing open legal/privacy/source rights and verified-email-delivery work
  (issues #23 and #24) must not be erased by the product refocus.
- PRs #29, #31 and #32 from the previous phase remain separately tracked;
  no production release occurs merely because local task tests pass.

## Honest next technical dependency

A genuinely useful "What changed?" feature requires **two dated, independently
verified versions of the same authoritative record**, immutable hashes, explicit
sources and comparison rules. ClinicalTrials.gov current-study queries do not
establish a past baseline; a last-updated date is not a field-level diff. An
unavailable provider means unknown, not unchanged. Source-level factual diffs are
not clinical materiality judgments. Multi-source claim reconciliation requires
licensed evidence and independent scientific review.

**Goal check:** Study-audit prototypes are a test of the core job. Additional
source indexing, UI polish and compliance mechanisms are enablers, not themselves
the value proposition.
