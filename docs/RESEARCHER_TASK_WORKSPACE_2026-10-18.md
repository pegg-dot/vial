# VialGrade researcher task workspace — UX and research-readiness gate

Date: October 18, 2026. Status: local branch, no push, no Vercel deployment.

## Goal anchor

First buyer/user hypotheses: small-biotech diligence analysts and researchers
verifying evidence for an investigational program. Test them separately.
The candidate core job is: start with a specific registered clinical trial,
identify its registered results and registry-cited publications, check which
paper links are independently indexed under that same trial, and export an
accurate short source brief with the unresolved questions.

The desired outcome is a faster and more accurate research task than navigating
the original registry and PubMed separately. That outcome is NOT verified.
No medical recommendations, patient-facing personalization, compound safety or
efficacy judgments, unreviewed historic seller data, investment advice or
commerce.

## Why the October 18 production interface was not researcher-ready

A manual browser walkthrough found:
- Homepage: about 2,816px scroll height on desktop and 5,099px on phone,
  with a fixed article puzzle instead of a tool a user can operate.
- Old audit page: about 6,206px on desktop and 10,300px on phone for a
  single canned question. The actual finding started after an oversized hero
  and extra scrolling.
- The guided audit accepted no new NCT IDs. Only four handpicked studies had
  source reconciliation; the other topics were admitted search samples.
- Early navigation presented the large report and "Topics" without a clear
  next action; copy/export was visible before the user had a useful result.
- This was an early evidence-reconciliation prototype, not a workflow.

These measurements are viewport-dependent observations, not usability study
statistics. A professional may care about different fields than a lay user.

## Sequence change

Before: ship the canned four-trial demo, add more metadata, then seek users.
Now: establish one self-serve one-trial task, verify source provenance and
output, run observed research tasks, THEN invest in broad discovery, historical
change alerts or UI rebranding. Revisit the product scope after at least five
real first-attempt tasks from relevant professionals, not another screenshot.

This user-driven pivot replaces the main entry point. The old four-trial
comparison and topic-index samples remain reachable but secondary.

## Narrow feature now implemented locally

- Single clear input for an NCT ID or exact ClinicalTrials.gov study URL.
  Strictly validate IDs, reject injected/foreign URLs, preserve the exact
  official NCT identifier. No arbitrary text or open-URL fetch route.
- Public server-only fetch of the exact registry record with max response-size
  checks, a seven-second timeout and Next data caching (up to six hours).
- Reuse original registry metadata parser but do NOT mislabel an arbitrary
  molecule as cagrilintide (the earlier fixed benchmark retains its
  cagrilintide-specific match annotations).
- Parse only bounded PMIDs already cited in the registry. One bounded NLM
  PubMed EFetch XML request independently checks each paper's NCT databank
  accession. Preserve RESULT and BACKGROUND registry labels.
- Short factual answer with registry-results status; linked-paper counts
  describe registry citations, not complete literature coverage.
- Original registry and PubMed source URLs, publication metadata, explicit
  failed/unavailable crosscheck status, and a source/limitations brief.
- No personal research profile, paid model, API key, third-party product
  referral or commerce path. Routine host logs still exist.
- Original program-comparison demo and other topic search samples stay under
  an expandable secondary section.

## Source and competitive boundaries

ClinicalTrials.gov is the original record for NCT registrations and posted
results; PubMed independently maintains bibliographic metadata. Trial-publication
linking can involve missing/late metadata or manual matching:
https://pubmed.ncbi.nlm.nih.gov/28669351/
https://pubmed.ncbi.nlm.nih.gov/38827077/

This MVP only checks papers *already linked in a registry's protocol
references*. It does NOT solve the harder problem of finding unlinked trial
result papers. It therefore cannot claim automatic literature completeness,
a new evidence database, superior indexing, study quality grading or
historical regulatory change reporting.

Commercial tools already cover broader study planning, trial benchmarks and
research data. For example:
https://www.citeline.com/en/products-services/clinical/trialtrove

## User test protocol and release criteria

1. Ask 5-8 consenting research professionals (separate scientist vs diligence
   groups) about their most recent real trial/paper reconciliation task.
2. Give each participant a new public NCT identifier and a time-limited
   source-verification task. Randomize their FIRST tool: this candidate
   workflow or their existing ClinicalTrials.gov/PubMed workflow. Compare
   first attempts only; offer the other interface after the task for feedback.
3. Score exact trial ID, correct role/source distinctions, actual source
   verification, citation quality, time to complete, confusion points, and
   whether they independently want to use it again. No private research files,
   health histories, screen capture without consent or participant tracking.
4. Require zero fabricated sources and zero false exact-NCT claims in the
   independently reviewed test set. Do not claim user value from source counts,
   attractive design, or local automated tests.
5. Do not ship broad topic search, paid AI, trial monitoring, or a rebrand
   until evidence of repeated work and material time/correctness advantage.

## Local engineering QA (not customer validation)

- 1,279 unit tests passed across 141 unit test files; all 87 isolated
  integration test files passed.
- The exact local research-only build passed 19 targeted Chromium browser
  checks. The earlier broader research run passed 24; the legacy-mode suite
  passed 44 with 11 intentionally skipped research-only cases.
- TypeScript, full ESLint, static security, HTTP role-boundary, structural
  accessibility and production dependency policy checks passed.
- Security audit across production dependencies found zero known reported
  vulnerabilities at the configured audit threshold. The separate developer
  dependency scan still flags five high-severity notices in the
  braces/micromatch/fast-glob/eslint-config-next chain, which require a
  compatible dependency upgrade and review; do not blindly force a breaking
  install. This is NOT a declaration of complete software security.
- Manual local desktop (1440px) and phone (390px) checks showed no horizontal
  overflow. The new one-trial page is about 2,095px desktop and 3,280px
  mobile in the selected-source fixture, versus 6,206px/10,300px for the
  old four-trial page. Different content and viewports can change heights.
- The dated official-source reconciliation test confirmed three exact
  NCT-to-PubMed associations; it is NOT a complete publication review.

## Remaining operational obligations

- Source licensing and retention/privacy/counsel review is open (#24).
- Admin mailbox forwarding and real receipt check is open (#23).
- Archived source from the old marketplace stays archived; public purchasing,
  checkout, seller referrals and APIs remain blocked (HTTP 410).
- We have not compared two independently preserved historical registry
  snapshots; last-updated dates are not version-diff proof.
- This local branch has not been pushed to GitHub or deployed.
  Do not add Vercel preview/production costs for each iteration.
