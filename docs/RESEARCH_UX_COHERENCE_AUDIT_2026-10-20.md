# Research UX coherence audit and fixes — 2026-10-20

Branch `ux/research-coherence-2026-10-20`, from `origin/main` 66ca056 (PR #34). Status: **engineering-verified, NOT usability-validated** (no human participants were available; protocol at the end). Nothing here touches production, commerce, `VIALGRADE_PUBLIC_EVIDENCE_ONLY`, account access or the HTTP 410 rules.

## Verified root causes (measured in Chromium, not assumed)

| # | Observed | Root cause | Severity | Fix |
|---|---|---|---|---|
| A | 1440×900: after choosing a question, the result heading sat at y≈816 of 900. 390×844: heading at y=987 (off-screen), scroll unchanged. | Page = 3-line intro + 4 chooser cards with `min-h-[165px]` inside a large panel, so the first screen was all chooser. Selection only swapped state; nothing moved the view or announced it. | High | Compact chooser; heading at y=538 (1440) and y=62 (390) after selection. On phones the panel scrolls into view only if below 55% of the viewport (respects reduced motion); a polite live region announces the result; focus stays on the control. |
| B | Custom-question box and Researcher/Analyst toggle looked like they drive retrieval. | `buildDeskBrief` only writes the text into the packet; the toggle swaps one `focus` sentence and one packet line. Evidence is fixed. | High (trust) | Label says "Your own wording for the brief". A status line states "This does not search" for any non-pinned text, and names a compound with no connected evidence (e.g. Semaglutide) as not answered. The same verdict is written into the exported brief. Toggle moved beside export, relabelled "Brief emphasis", with the truthful one-line effect. |
| C | Evidence panel 1118px tall with 117px empty tail. | Grid used `align-items: normal` (stretch) so the panel matched the taller sidebar. | Medium | Sidebar removed; brief/limitations/links are full-width rows. Panel tail gap now ≤ 4px (asserted). |
| D | Findings and sources disconnected (accordion + separate index). | Source links hidden in `<details>`; separate "inspect all sources" list. | High | Each observation has its own inspector: identifier chips → label, publisher·kind, documented observation, what the record does not prove, open-original link. First source shown by default (0 extra clicks). |
| E | Desk and dossier were two overlapping 4-way selectors. "Clinical program" and "Sponsor history" rendered identical content. | Both topics used the same `claimIds`. | Medium | Roles stated: dossier = inspect a compound; Desk = build and export a brief. Sponsor history now adds the recorded-sponsor attributions (and the brief section). Dossier lens → "Build a source brief from this" → `/intelligence/desk?topic=…`; the Desk keeps `?topic=` in the URL. |
| F | Two `<main>` landmarks on 46 of 63 routes. | Root layout wraps pages in `<main>`; 19 pages added their own. | Medium (a11y) | Nested ones demoted to `div`; guarded by a test. |
| G | Verifier: result below the fold, URL unchanged, related NCT not actionable, "banana" read like a valid-but-absent ID. | Client-only state; duplicated intro; one "not found" branch. | Medium | Compact intro, `?ref=` kept in the URL, "Check NCT…" in-place neighbour buttons with a bibliographic-link caveat, separate malformed-input message. |
| H | Global search: a PMID returned "no record in the 16-compound library". | Search only indexes compounds. | Low | Identifier-shaped queries offer "Check … in the source register" (Enter works too). |
| I | Organizations source-link icons 16×16px. | Bare icon anchors. | Low (WCAG 2.5.8) | 44px hit area. |

Crawl: 70 routes returned 200 with one h1; 136 page-views (63 routes × 360/390/768/1440 widths, de-duplicated families) showed no horizontal overflow, console errors, missing alt, or stretched empty boxes after the fixes.

## Journeys
- **A discover**: Market → compound/dossier works; original-experiment evidence present in the dossier. Not re-architected.
- **B paper**: PMID 36781451 → "secondary review", DERIVED caveat on screen without scrolling, one click to NCT01594762, shareable URL. 
- **C compare**: Pexiganan vs Magainin 2 keeps distinct CIDs and per-record limitations; verified unchanged and sound.
- **D material**: states UNVERIFIED regardless of matching lots; unchanged and sound.
- **E brief**: Desk now says when it cannot answer the typed wording.
- **F organizations**: sponsors are historical registry attributions, distinct from labs/suppliers; touch targets fixed.

## Feature-preservation checklist
All kept: four Desk questions, all claims/sources/limitations, Markdown download, copy-for-AI, opt-in AI panel (local only), dossier four lenses and inspector, passport, verifier (allowlist unchanged), compare, materials, grading, organizations, studies, providers, global search, mobile menu. Marketplace visual identity and shelves untouched. Purchase/referral endpoints still 410; retired shop URLs still redirect to `/intelligence?notice=retired`.

## Tests (executed)
- `npm run lint`, `npm run typecheck`: pass. `npm run test:unit`: 153 files / 1336 tests pass.
- Integration: 86 files pass. `daily-analytics.test.ts` fails 3/7 **identically on unmodified `origin/main`** (pre-existing; the isolated runner aborts at the first failure, so the rest were run explicitly).
- `audit:security`, `audit:accessibility` (63 routes), `audit:market-data`, `consumer-intelligence`, `seller-ops`, `seller-mcp`, `commerce-v5`, `evidence-v6`, `lab-mcp`, `registry`, `db:backup-drill`: pass. `audit:roles`: pass when run without the evidence-only flag (as the verify chain does).
- Production build: pass. E2E on the production build, by configuration: research specs 80 pass; AI-analyst + desk specs 10 pass **with `VIALGRADE_LOCAL_PREVIEW=true`** (they fail without it by design); legacy marketplace specs 31 pass with the flag unset.
- `npm audit --audit-level=high`: **fails, 5 highs** (braces→…→`eslint-config-next` dev chain). Unchanged by this branch (no package changes); needs its own fix.
- New guards were mutation-checked (coverage logic: two mutations turn the unit test red).

## Not done / remaining
- **No usability study**: protocol below; results unknown.
- Deeper pass on Quick View keyboard navigation, saved context, Market filters/sorting, and the 15 non-Pexiganan dossiers was limited to crawl-level checks (status, h1, overflow, console, landmarks); not journey-tested.
- Retired-URL remap (`/compounds/<slug>` → dossier) was built and reverted: existing tests pin the "explain the shutdown" notice. Owner decision; a banner on the destination would satisfy both.
- Researcher/Analyst remain framing-only. A genuine split needs different content (e.g. analyst: sponsor/timeline view) — hypothesis, not built.
- Typed Desk questions cannot retrieve new evidence; a real retrieval feature is a separate project.
- Source-file grade letters ("File coverage A") sit beside compound names; copy says coverage not efficacy, but the letter can still be misread. Hypothesis to test with users.

## Usability protocol (not run)
5 researchers + 5 biotech analysts, uncoached, think-aloud. Tasks: find the original experiment for Pexiganan; say why PMID 36781451 is not a trial result; compare Pexiganan/Magainin 2 without crediting findings to the wrong molecule; given a label and report with matching lots, state what is established; build and export a brief; name who sponsored NCT00563394 and where that comes from. Record success, time and clicks to the source, errors, wrong scientific inferences. Success bar: ≥8/10 reach the right source unaided; 0 inferences that a matching lot or a DERIVED link proves authenticity/results.

After the tasks, ask one closing question, once, neutrally, and record the answer verbatim: "Would you buy through this site? If yes, what for, and from whom: a manufacturer, a vendor or a distributor? If no, why not?" Added 2026-10-21 at the owner's request. It is measurement only: it does not decide the vendor click-through question (see `HANDOFF_2026-10-21_UX_ARC_AND_NEXT.md` section 4), and the answers are not a substitute for legal review. Ask it after, never before, the task work so it does not prime how participants read the sponsor and source tasks.

## Release recommendation
Mergeable to `main` behind the existing gates after review. Do not release to production until: PR review and a Vercel preview check, the `npm audit` highs are addressed, and the `daily-analytics` baseline failure is triaged. Owner approval required; production was not modified.

Screenshots: `docs/ux-audit-2026-10-20/` (before-*/after-*).
