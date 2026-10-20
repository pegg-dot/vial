# VialGrade research experience and comprehension audit

October 19, 2026 | **Local software/UI audit, NOT a user study or deployment approval**

## Goal anchor

- **North star:** Let a scientist or biotech diligence analyst start with a compound, identifier or research question, open the exact original-source record, and distinguish established relationships from uncertain or missing source links.
- **Experience enabler:** Preserve the beloved original VialGrade visuals, landing sections, strong cobalt/ink/mint palette, animated *discovery* ticker, market shelves and quick views.
- **Non-goals:** An unapproved-peptide seller, human-use clinical adviser, graded scientific efficacy index, independently tested lots, automatic claim verdicts, or unlimited source verification.
- **Safety:** The old merchant market, pricing and transactions stay isolated. Source-file A/B/C letters report anchored source *types*, never study certainty, efficacy or batch purity.

## Audit method and evidence

Read the local React page implementations and verified **15 research routes at two viewport sizes** on the currently running Mac localhost preview: 1440×900 and 390×844. Observed actual first-screen hierarchy, headings, clickable controls, navigation, page lengths and browser overflow in Playwright. Raw results and 30 before screenshots: `~/Documents/VialGrade/Local_Milestones/2026-10-19-ux-comprehension-audit/`. External heuristics checked against Nielsen Norman Group's published [progressive-disclosure](https://www.nngroup.com/articles/progressive-disclosure/) and [information-scent](https://www.nngroup.com/articles/information-scent/) explanations. **No real user's comprehension, speed or task success was measured.** These are design hypotheses grounded in actual page structures, not customer validation.

### Pre-change baseline (approximate visible main text and page height)

| Page | Desktop words | Rendered links | Desktop height | Mobile height |
|---|---:|---:|---:|---:|
| Home | 715 | 39 | 7,721px | 11,630px |
| Research market | 1,223 | 31 | 4,701px | 10,778px |
| Pexiganan dossier | 1,154 | 53 | 5,908px | 10,276px |
| Evidence passport | 1,076 | 41 | 4,538px | 8,867px |
| Source verifier | 254 | 5 | 1,811px | 2,999px |
| Study NCT01594762 | 286 | 4 | 2,022px | 3,598px |
| Compound comparison | 319 | 14 | 2,137px | 4,001px |
| File-grading method | 876 | 19 | 3,307px | 7,224px |
| Research Desk | 507 | 10 | 2,903px | 5,423px |
| Material checks | 855 | 10 | 4,057px | 10,115px |
| Study sponsors | 351 | 8 | 2,215px | 4,119px |
| Supplier documents | 245 | 6 | 1,800px | 3,415px |
| Supplier profile | 341 | 7 | 2,327px | 4,101px |
| Guided evidence case | 524 | 20 | 3,379px | 5,746px |
| Cagrilintide audit | 1,218 | 24 | 6,114px | 10,511px |

Counts include contextual source links and relevant citations, not just navigation. Long pages do not automatically indicate poor UX; they flag a stronger need for task-specific overview, scannable sections and visible pathways. The 15 first-screen desktop/mobile views had no page-level horizontal overflow.

## Findings, ranked by mechanism

1. **P0 - The labels reveal the code architecture instead of the user's task.** Global header said Market / Compounds / Organizations / Research Desk / Verify / How we check, plus Compare, while Market and Compounds often led to the same list. Worse, "Organizations" in the header led to supplier-authored QC documents, but a separate page called "Organizations" listed historical clinical-trial sponsors. A reader cannot reliably predict what they will find. **Fix:** Preserve all destinations, group main actions and label the two attribution types separately.
2. **P0 - The CTA appears more capable than the verifier is.** The beautiful homepage's fake-search-like input said "Check a study, claim, or compound source"; clicking opened a verifier limited to individually selected Pexiganan PMID/NCT/CID entries. **Fix:** Explicitly state "exact source ID, Pexiganan pilot", provide a starter input example and alternative starting points. This is a capability-boundary correction, not a hidden reduced feature.
3. **P1 - A user gets into detail before seeing a meaningful answer.** The dossier showed an A letter, theme, mechanism, PubChem link and seven narrow tabs before explaining how they related to the question. A normal user may mistake a file grade for a peptide grade. **Fix:** A concise "what it is / what is linked / what remains unverified" overview replaces the immediately technical metadata row. The original reference, mechanism and all seven specialist sections remain one expansion away.
4. **P1 - First action buried behind repeated browsing.** Material review displayed 16 cards before the chosen-lot checker despite the URL already selecting a compound and the user's task involving sample and report IDs. On mobile this made the key work form deep in a 10,115px page. **Fix:** Show the existing lot/report workpaper first, and preserve the complete 16-record chooser behind an obvious, easily reopened "Choose another compound" expander.
5. **P1 - Decorative and textual competition on evidence-reading pages.** The original moving cobalt ticker makes the landing and market recognizable; repeated motion beside serious audit/source content competes for attention. **Fix:** Keep the original ticker on home and market, remove it only on detail/report reading routes. No branding asset deleted.
6. **P2 - The research file uses insider terms in the first viewport.** "Evidence passport", "NCT", "PMID", "CID", "source relationships", "material workpaper", and "record attribution" appear without immediate framing. **Fix:** Plain-language summaries and specific link labels at entry points. Keep the original technical vocabulary beside the sources so researchers can still audit exact distinctions.
7. **P2 - Different pages lead back to different places under the same name.** Several "Back to Research Market" links went to the long marketing home rather than the browsable Market. **Fix:** Normalize primary breadcrumbs and back links to `/intelligence/market`; the home remains a separate marketing entry point.
8. **P2 - Distinct levels of scientific trust were visually adjacent.** The copy was generally cautious, but molecular record identity, one registered intervention match, the three-layer research-file grade, a study result and a physical batch were presented as similarly styled "checks". **Fix:** Clearly separate what is linked from what remains unverified before the detailed source cards. Do not collapse these concepts into a single trust or efficacy score.

## What changed in this pass

- Home and Market keep original artwork/typography/shadows, add explicit start-by-task links and make formerly static introduction tiles navigable.
- Shared navigation groups main tasks, preserves the Compare entry point and moves advanced areas into a labeled menu with destination descriptions. Mobile menu provides the same labels and direct access, with a scrollable panel.
- Compound dossier has a concise 3-answer summary, a technical-details disclosure and 3 prominent section links plus **More sections**, keeping every original source and detailed specialist area.
- Pexiganan evidence passport now has an actual plain-language answer before its detailed six checks, and the connected wayfinder asks "where to go next" rather than discussing past retail UI.
- Source verifier clearly states its limited lookup scope instead of claiming universal verification.
- Material form precedes reference grid; selected compound is always explicit and can be changed; all previous typed form/lot/export logic remains.
- Study-sponsor pages and supplier-document pages have distinct titles, breadcrumbs and practical explanations. Other study, comparison and trial-audit functions continue unchanged.
- Original brand ticker only appears on discovery pages; remains fully intact there.
- Scope/ethics/limitations retain prominent source-specific disclosures; checkout and referral API blocks are unchanged.

## After-change visual measurements and regression proof

The same localhost research-only app was rebuilt and the original 15-route × 2-viewport Playwright audit rerun. After captures and JSON: \`~/Documents/VialGrade/Local_Milestones/2026-10-19-ux-comprehension-pass/\`. All 30 after routes returned **HTTP 200**, all had no document-level horizontal overflow, and no browser script errors were captured. A side-by-side gallery at \`index.html\` links each before/after viewport and live page.

**Most significant measurable improvement:** Research materials page default mobile height went from **10,115px to 5,619px** (−4,496px, approximately −44%). Desktop went from **4,057px to 2,839px** (−1,218px, about −30%). All 16 source identities and their filters remain in the opt-in index, and the selected compound's form and export work without an upload or account. This is reduced initial visual length, **not** proof that research material data disappeared or that people complete the work faster.

The main dossier reduced desktop default visible length from 5,908px to ~4,697px before the final CTA adjustment; mobile remains a long detailed evidence file (~10kpx). That is intentional: expert original-source content is retained, but technical navigation is deferred until requested. Original Home (~7.7–7.8kpx desktop) and Market (~4.7kpx) remain almost unchanged; their distinctive approved visual identity is preserved. Passport gained a short introductory answer and is slightly longer; that is deliberate rather than falsely claiming a page-length reduction. Measurements can differ slightly based on asynchronous NIH source responses.

**Final observed gates for this phase:** optimized research-only build, full lint and TypeScript passed; all **65** focused research browser tests (including six new comprehension-preservation checks) passed after the final in-dossier CTA change, with exact source links, responsive navigation, Pexiganan provenance and checkout 410 checks retained; all **1,330 unit tests in 153 files** passed; 718-source static security audit, 63-route role-boundary audit and all-page structural accessibility audit passed. The earlier baseline integration run had all 87 files passing; this UI-only pass has not independently rerun the entire 87-file integration suite. No external human scientific claims were re-adjudicated and no true user comprehension was measured.

## Suggested observed-person usability script

Give a researcher or biomedical diligence analyst three realistic prompts, without explaining VialGrade's internal nouns: (1) starting from Pexiganan, find the precise molecule identity and one registered study; (2) investigate whether PMID 36781451 is a clinical trial result or a DERIVED review; (3) given a physical label and report with different lot numbers, find why the source trail cannot authenticate a material. Record their first clicked action, time to relevant exact source, incorrect inference, return path and whether they can explain what File A/B/C means. Repeat on phone. Decide improvement from those observations, not automatic visual scores.

## Roadmap ledger

- **Current phase:** Audit-informed *local comprehension pass* with before/after screenshots and regression tests. No deployment.
- **Next:** Owner checks the side-by-side 15-route before/after gallery and the real local running prototype; obtain 3–5 witnessed source-tracing tasks from scientists and analyst users. Keep original Home/Market brand unchanged.
- **Revisit checkpoint:** Owner click-through review of home, Market, Pexiganan dossier/passport, verifier and sample-report flow. Only then update the existing draft PR, run CI, arrange expert science/legal review, and consider production deployment.
- **Parked:** new assays, bulk literature ingestion, additional supplier data, lab ranking, automatic peptide-efficacy judgments, paid AI calls and personalized data.
- **Open:** Independent source accuracy, completeness, UI comprehension as witnessed on real user tasks, authenticated lots, legal/data rights, AI provider budget and production release approval.

### Explicit pivot

**Old sequence:** showcase every available module as a roughly equal top-level option → visitors discover how everything relates themselves.

**New sequence:** know what input the visitor has → show the first valid source question → give a brief source-grounded answer → let them open deeper methods, comparisons and linked evidence without losing the work.

Why: the desktop/mobile route audit shows high link count and jargon before clear action, not that the original visual language is bad. Defer another entire redesign and any commercial activation. Revisit after witnessed tasks and the user's visual signoff.

**Goal check:** Clear wayfinding is an *enabler* for the real research job: correctly separating original source facts, relationships and unresolved questions.
