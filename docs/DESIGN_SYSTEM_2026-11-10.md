# One visual system for every VialGrade screen
Date: 2026-11-10. Status: Phase 1 in progress (every `/intelligence/**` page). Phase 2 next (the browse pages, legal, login). Owner direction: "redesign every screen like `/intelligence`; make the structure and the experience intentional across every tab, page and slug."

## 1. What was wrong (measured 2026-11-10)
Of the 20 pages under `/intelligence`, four used the landing page's visual system (`/intelligence`, `/market`, `/explore/[slug]`, `/suppliers`). The other sixteen used **zero** `.ink` or `.hard` classes and one of two second palettes: cream `#faf9f7` with muted greens (`#2c7152`, `#26937b`, `#167f69`, `#dbe5dc`) or lilac (`#5c4ca4`, `#6c5d9e`, `#f1edff`). Headings were `font-semibold` at fixed sizes, frames were thin grey borders, and each component carried 30–80 of its own hex values (research-desk 75, pexiganan-evidence 81, material-review-workbench 53, research-ai-panel 51). A reader moving from the market to the Research Desk changed product.

## 2. The reference, written down
Everything below is lifted from `src/app/intelligence/page.tsx` and `src/components/intelligence/research-original-home.tsx`, and now lives as code in **`src/components/intelligence/research-ui.tsx`**. Pages compose that kit; they do not pick colours.

| Token | Value | Where it comes from |
|---|---|---|
| Ground | `var(--background)` `#f7f7f4` | body, hero |
| Ink | `#111214` (never `#17191b`) | borders, headings, dark cards |
| Muted text | `var(--muted)` `#61636b` | body copy |
| Secondary ink | `#3a3d46`, `#4a4d56` | body on white, eyebrow-muted |
| Blue | `#2b31d8`; tint `#eef0ff` | eyebrows, links, primary pill |
| Mint | `#e6fbf6`; ink-on-mint `#0b6b60`; teal `#12b3a6` / `#0e8f80` | snapshot strips, "recorded" status |
| Violet | `#6d5dfc`; tint `#f0edff`; ink-on-violet `#5a4be0` | AI / model-draft surfaces only |
| Warn | `#fff3d8`; ink-on-warn `#9b6b22` | limits, "does not establish" |
| Danger | `#ffecea`; `#ce403b` | errors, what a search result leaves out |
| Frames | `.ink` 2px, `.ink-1` 1.5px; `.hard` 5px, `.hard-sm` 3px, `.hard-lg` 8px offset shadows; `.press` hover lift | globals.css 206–222 |
| Radius | cards `rounded-[18px]` / `[22px]`; section frames `[16px]`; inner panels `[14px]`; pills `rounded-full` | |
| Type | Inter; `font-extrabold` with negative tracking for every heading; eyebrows `text-[11px] font-bold uppercase tracking-[.18em]` | |
| Art | `src/components/vial-art.tsx` with `gum-float*` and `drop-shadow-[5px_5px_0_#111214]`, always `aria-hidden` | |
| Inputs | the global `.field` class | globals.css 253–267 |

### The kit (`research-ui.tsx`)
- **Page chrome:** `PageHero` (breadcrumb, eyebrow, one h1, lead, note, pill actions, optional framed `aside`, floating `art`, `tone`, `size="compact"` for tool pages), `Breadcrumb`, `Section` (container + rhythm, optional full-bleed `band`), `SectionHeading`, `PageFootnote`.
- **Frames:** `Frame` (tone, shadow, pad, `as`, `press`), `CardLink` (whole-card link, the landing's "go deeper" card), `NumberedSection` (numbered eyebrow + h2 + intro + body; `flush` for row content; `titleId` when a test or link needs the h2's id; `headerTone`; `chips`; `actions`), `StickyContents` + `ContentsLayout` (the dossier's sticky numbered contents, label is a prop), `Quiet` (thin inner panel).
- **Parts:** `Pill` (link or button; `primary` blue, `secondary` white, `ink`, `mint`, `ghost`), `Chip` (uppercase label; tone says what kind of fact), `Stat` / `StatRow`, `Notice` (warn / danger / mint / blue; optional `role`, `live`), `Facts` (dl grid, optional tinted strip), `RecordList` (rows of linked records), `IconTile`, `FloatingArt`.
- **Tokens:** `UI.*` class strings (`UI.h1`, `UI.h2`, `UI.h3`, `UI.eyebrow`, `UI.body`, `UI.link`, `UI.field`), `TONE_ACCENT`.
- `dossier-layout.tsx` is now a thin wrapper: `DossierSection` = `NumberedSection`, `DossierToc` = `StickyContents` with the dossier label.

### The page template
1. `PageHero` — breadcrumb (when the page sits under the market), eyebrow, **one h1**, one-sentence lead, the fixed caveat as `note`, 1–3 pill actions. Tool pages use `size="compact"` so the first working control is above the fold at 1440×900.
2. Body in a `Section`, built from `NumberedSection` frames in a fixed order (01, 02, 03 …). Multi-section evidence pages (dossier, passport, case, study) add `ContentsLayout` for the sticky contents. Tool pages (desk, verify, materials) do not.
3. Limits as a `Notice tone="warn"` or a numbered "Limits" section, never a fifth card style.
4. `PageFootnote` for scope small print, linking to `/intelligence/grading`.

## 3. Rules that do not bend (tests enforce most of them)
- The root layout renders `<main id="main-content">`; pages never render `main`. Exactly **one h1**, outside any `Suspense`. No duplicate ids (streamed fallbacks need their own ids). Every button has a name; every input has a label.
- Standalone links and buttons are ≥24px tall at 390px (`inline-flex min-h-6` or taller; the kit's `Pill` is `min-h-11`). No horizontal overflow at 390px (scrollWidth ≤ 391).
- Keep every tested **id, aria-label, role, heading text, button name, link name and placeholder** listed in §5. Rename nothing a test or another page links to.
- Keep the copy limits: "not usability-validated", "not verified", "document as published, not independently verified", "file coverage is not a quality claim", "no purchasing", and the per-page fixed lines in §5. No "buy", "price", "cart", "available from", "in stock", "shop" anywhere on research pages. The one allowed mention is a disclaimer that *denies* it.
- Copy comes from the existing constants in `src/lib/*` (`PEXIGANAN_CLAIMS`, `RESEARCH_PROVIDER_RECORDS`, `MAGAININ_PEXIGANAN_CASE`, `DESK_TOPICS`, `FILE_GRADE_LIMITS`, …). Do not retype facts into JSX.
- Client components keep their logic byte-for-byte: state, `replaceState` URL sync, downloads (Blob filenames are tested), clipboard, Suspense boundaries, `notFound()`.
- No new colours. If a tone is missing, use the nearest kit tone and say so in the PR; do not add a hex.
- The evidence-only quarantine, `publicReleaseAction`, `access-policy.ts` and `vercel.json` are untouched by this work.

## 4. Phases
| Phase | Scope | Status |
|---|---|---|
| 0 | Audit (three read-only agents), kit, design doc, Research Desk as the worked example | done 2026-11-10 |
| 1 | Every other `/intelligence/**` page and the components they share; header mobile menu gains the browse links; `not-found`; the retired notice | in progress |
| 2 | Browse pages (`/compounds`, `/vendors`, `/labs`, `/passports`, `/grades`, `/how-we-check`) and their shared panels (`lab-tests-panel`, banners, `vial-grade-card`); legal pages; login/register. Also fixes found in audit: vendor page "N Listings" stat shown under evidence-only, dead "Storefront" jump chip, verdict sentence naming hidden sections, links to closed routes (`/stacks`, `/reference-standard`, `/news`, `/testing`, `/verify`, `/research`, `/enforcement`, `/about`), compound page `<title>` says "market", grades `CHECKED_ON` date mismatch, `persistVendorGrade` writing on a public GET | next |
| 3 | A visual walk of every page at 1440 / 1024 / 390 by a fresh-eyes agent against this document, then the owner's own look | after 2 |

## 5. Per-page contracts (what the rebuild must keep)
Short form of the 2026-11-10 audits. Spec paths are under `tests/e2e/`.

**desk** (`research-desk.spec.ts`, `research-ai-analyst.spec.ts`) — done. h1 "Research Desk"; `#desk-first-task`, `#desk-evidence-heading` (its `closest("section")` must end ≤4px below its last child's last child), `#desk-brief-heading`, `#desk-question-coverage` (`role=status`), `#desk-emphasis`, `#research-ai-title`; groups "Research questions" and "Source records for: …"; the first `article` in the DOM is the first claim; one "Analyst" button, one checkbox; names "Download source briefing", "Copy source pack for an AI model", "Analyze this research question"; texts "What it does not establish", "What this record does not prove", "Fixed evidence.", "This does not search.", "Model not connected", "Gateway configured", "AI draft · human review required".

**verify** (`research-ux-coherence.spec.ts:9-29`, `pexiganan-evidence-network.spec.ts:60-74`, `research-original-market-experience.spec.ts:85-92`, `research-clarity-audit.spec.ts:90-92`) — h1 "Verify what a source says."; eyebrow "Exact source ID lookup · Pexiganan pilot"; textbox "Exact NCT, PMID or CID", button "Check record", region "Original research source verification", `#research-source-id`; **after a check at 1440×900 the text "A review article is not the study's primary clinical results report." must be inside the viewport** → compact hero, verifier first; `?ref=` sync; headings "Not a recognised identifier format", "Not checked in this evidence file"; "Selected record found in file"; links "Open original PubMed record", "Open original ClinicalTrials.gov record", /Look up NCT00000001 live/ → `/intelligence/studies/NCT00000001`; chip button "PMID 18990064"; links to `/intelligence/passports/pexiganan#evidence-claim-<id>`.

**materials** (`research-materials-workflow.spec.ts`, `research-clarity-audit.spec.ts:65-84`) — h1 "Research material checks"; heading "{Name} material file"; **`getByText("0 independently authenticated physical lots")` must match one element** (no StatRow split); **exactly one `role="status"` on the page** (no `Notice role="status"`); placeholders "Exact ID from the label" / "…report"; `#material-workpaper` above `<details id="material-index">` which starts closed; exactly one button "Choose another compound" (opens the details); region "Research material identity index"; button "Review Semaglutide material evidence"; download filename contains "unverified"; link "Full source directory"; `#material-providers`; `?subject=` validated server-side.

**providers** (`research-materials-workflow.spec.ts:25-32`, `research-clarity-audit.spec.ts:99`) — h1 "Supplier quality documents"; exactly **2** links "Open source profile"; `/providers/bachem` 200 and fits 390px; profile h1 = provider name, `#source-profile-title`; keep "Independent checks pending", "Based on the organization's own site, not independent confirmation", "No names here constitute a preferred-supplier list", "Source class: COMPANY-AUTHORED", "not… an invitation to purchase".

**organizations** (`pexiganan-evidence-network.spec.ts:95-102`, `research-ux-coherence.spec.ts:35-40`) — h1 "Who sponsored the selected studies?"; headings "Dipexium Pharmaceuticals, Inc." and "Abeona Therapeutics, Inc"; link "Open source NCT00563394" (aria-label `"Open source " + nctId`, ≥24×24 at 390px); main contains "not current corporate ownership"; heading "No research-material testing verified here" (from `PexNoLabVerification`, shared with passports and the dossier); Suspense around the live NIH call with its fallback text.

**compare** (`research-explorer.spec.ts:50-56`, `research-evidence-workpaper.spec.ts:61-78`, `research-marketplace-ux.spec.ts:60`) — h1 "Compare compounds"; h2 subject names exact; text "PubChem reference · SID 528343961 (no CID)"; links "Analyst" and "Researcher" with `aria-current=page` (**substring match: no other link may contain "analyst"**); regions "{Name} selected trial source"; link "Read the source trail"; "No trial has yet been individually verified…"; `?subjects=` (≤3, deduped) and `?audience=`.

**updates / confirm / unsubscribe** (`email-updates.spec.ts`) — already on the system; h1s "Get a note when a source record changes.", "Confirm your email", "Unsubscribe"; `#digest-email`, `#digest-company` (honeypot), `#digest-consent`; the form stays `onSubmit` + `useTransition`; main text must not contain buy/shop/price/cart/"available from"/"in stock" even inside other words.

**suppliers** (`research-suppliers.spec.ts`, `tests/unit/supplier-sections.test.ts`) — already on the system; cards must not become links (`<a ` is banned in the unit test); one `main h1`.

**grading** (`research-file-grade.spec.ts`) — h1 "What have we actually checked?"; heading "Three visible source checks"; h3s "Molecular reference", "Named registry intervention", "Original experiment" (exact); text "An A here is not scientifically stronger than a C"; regions "Research file grade for Pexiganan / Cagrilintide / Magainin 2 / Retatrutide" each unique, containing "File coverage A / B / C" and "No file grade yet"; link "Original model-membrane study · PMID 12719236" inside the Pexiganan region; the Cochrane link unique. `ResearchFileGradeCard`/`ResearchFileGradeMark` are shared with the dossier (`bare`), compare, quick view and the explorer: keep the API and the texts.

**studies/[nctId]** (`study-workspace.spec.ts`, `research-evidence-workpaper.spec.ts:48`) — h1 "Evidence for {id}" (error h1s "Study not found", "Registry temporarily unavailable" with link "Check ClinicalTrials.gov directly"); heading "Original sources"; link "Open registry record" unique; heading "What to verify next"; buttons "Copy brief", "Download brief" (filename `vialgrade-{nct}-source-brief.md`); "Back to study lookup" visible at 390px; **`getByRole("search")` must be hidden at 390px** (the compact lookup form is `hidden lg:block`); no Suspense around the h1; `StudyLookupForm` (`role="search"`, ids `trial-id-repeat` / `trial-error-repeat`) is shared with the landing.

**cases/magainin-pexiganan** (`research-evidence-workpaper.spec.ts`) — h1 "When related peptides are not the same evidence."; heading "Three things the sources actually establish"; each observation is **one `<article>` that contains its "not prove" limitation text**; links /Compare the molecules/, /Inspect the clinical trial/; summary text "Full source register · 5 records"; links "Open original source: Hallock et al. · Biophysical Journal (2003), PMID 12719236" and "…NCT01594762"; button "Download workpaper" (filename `vialgrade-magainin-pexiganan-evidence-workpaper.md`); links to `/intelligence#explore`.

**[topic]** (retatrutide, cagrilintide, tirzepatide; `research-release.spec.ts`, `cagrilintide-audit.spec.ts:6-9`) — single h1 = topic label; heading "The dated evidence trail"; buttons "Trial registry", "Publications" (exact, `aria-pressed`); "Export citations" download; text "These are small search-result samples" exactly once; combobox "Trial name appears in"; `#dossier`, `#record-search`, `#registry-match-filter`; cagrilintide link "Open study audit"; "Cross-topic source coverage" never appears.

**[topic]/audit** (cagrilintide only; `cagrilintide-audit.spec.ts`) — h1 "Did this clinical trial publish any findings?"; text "This is a worked example with four selected records"; **exactly 4 `article` elements containing `span.font-mono`** (so numbered `font-mono` eyebrows must never sit inside an `article`; use `section` for frames); headings "What the records flag for follow-up", "Study-design audit", "Questions the current evidence cannot answer", "Publication evidence linked to this study"; first `article details` closed, containing "Interventions actually named" and "Primary outcomes registered"; a details whose summary contains "additional study-design checks", closed; "PMID 39279639" and "Registry label: RESULT" exact; link "Read PubMed record"; "Export cited Markdown"; `#findings`; `/intelligence/retatrutide/audit` → 404 with "There is no research page at this address." and link "View study audit".

**passports/pexiganan** (`pexiganan-evidence-network.spec.ts`, `research-clarity-audit.spec.ts:94-124`) — h1 "Pexiganan, with the receipts."; region "Pexiganan claim and evidence checks" with **exactly 6 `article`** (`id="evidence-claim-{id}"`, linked from the dossier workspace and the verifier); heading "The later DERIVED citation is a review, not a results paper"; links /PMID 36781451/ and /PMID 18990064/ unique; text "Open the complete original-source register (10 records)" (clickable summary); region "Original evidence source register" with **10 "Check source" links** to `/verify?ref=`; region "Pexiganan selected original trial records" with **exactly 4 `article`**, each NCT exact once; heading "No research-material testing verified here"; "Download workpaper" (`vialgrade-pexiganan-evidence-passport.md`); heading "What can we actually say?"; `#passport-claims`, `#pexiganan-trials` (Suspense fallback keeps its own `pexiganan-trials-loading` id). `pexiganan-evidence.tsx` is shared with the dossier (`PexEvidenceClaimGrid compact`, `PexSourceRegister`, `PexEvidenceWayfinder` with `#pexiganan-network` and "Pexiganan evidence connections") and organizations.

**market** (many specs) — already on the system; restyle only `research-explorer.tsx` controls (`ink-1 rounded-full` pills), `research-quick-view.tsx`, the "Comparison selection" bar, `ResearchFileGradeMark`. Keep every `data-testid="research-card"` count, the status "Showing … of 16 compounds", searchbox "Search research subjects", theme rail as **links**, comboboxes "Research file grade filter" / "Sort research file coverage", buttons "Quick view X" / "Compare X" / "Remove X", dialog "Quick research view: X", heading "Compounds" (no other heading may contain "compounds"), `#browse`, `#browse-title`, the `section:has(h2 "Browse everything")` containing only the explorer.

**header / footer** (`research-release-chrome.tsx`, `research-global-search.tsx`) — already on the system. Nav "Research navigation": "Market" → `/intelligence/market`, "Check a source" → `/intelligence/verify`, summary "More research" → nav "More research areas" (/Study sponsors/, /Supplier documentation/, /Sample report checks/, /All compounds/); nav "Mobile research navigation" with "Open menu"/"Close menu"; nav "Mobile research links" (Market, Compounds, Verify, Compare, Study sponsors, Supplier documents, Sample report checks); search button "Search VialGrade research", dialog "Search compounds and sources", searchbox "Search compound name, alias or study ID", link "Check {ID} in the source register". Phase 1 adds the browse links (Compounds, Vendors and labs, Grades) to the mobile menu when `publicBrowseRelease()` is on.

**dossier residue** — `dossier-trial-evidence.tsx` (lilac `#55479c`/`#6c5d9e`), `dossier-organizations.tsx`, `dossier-perspective.tsx`, `research-file-grade.tsx` greys. Tested by `research-dossier-structure.spec.ts`, `research-organizations.spec.ts`, `research-file-grade.spec.ts:53-68`, `pexiganan-workspace.spec.ts`.

**not-found** (`cagrilintide-audit.spec.ts:102-108`) — 404 status; heading "There is no research page at this address."; links "Explore research", "View study audit".

## 6. What this does not claim
No human usability study has been run; the site stays "not usability-validated". The audits read code and tests, not screens; Phase 3 is the visual walk. The structural accessibility audit never visits dynamic routes (`[slug]`, `[nctId]`, `[topic]`), so those are covered by the e2e specs only.
