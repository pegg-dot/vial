# VialGrade handoff: UX arc 10-20/21 and what comes next
Written 2026-10-21 for a fresh session with no memory of the previous one. Read this fully before touching anything. Then read `docs/SIGNUP_RETURN_AND_SOURCES_DESIGN_2026-10-21.md`.

## 0. Who and what
- Owner: Nate Pegg. Repo `pegg-dot/vial`, main checkout `~/VIAL`. Main is PR-only; the repo is PUBLIC.
- Product: VialGrade, a **research-evidence** site about peptides (source-linked dossiers, ClinicalTrials.gov/PubMed/PubChem lookups, a Research Desk). Audience: researchers and diligence analysts. It is NOT a retail marketplace, an efficacy index or medical advice.
- The site runs in an **evidence-only quarantine**: `VIALGRADE_PUBLIC_EVIDENCE_ONLY=true`. Implemented in `src/lib/public-research-release.ts` (`publicReleaseAction`) and `src/proxy.ts` (a minified single line). Public GET/HEAD on retired routes get a 307 to `/intelligence?notice=retired`; APIs and mutations get HTTP 410. Existing accounts, staff `/admin`, privacy/deletion paths and signed callbacks stay working. It is a route quarantine, **not a legal clearance**.
- New registration is paused on purpose (`src/app/register/page.tsx`): saved compounds, searches and alerts might reveal health interests.

## 1. State of the repo (verified 2026-10-21)
All of these are MERGED to main by Nate (main is at 883f264 or later):
- #35 Research Desk workbench, verifier context, single `<main>`, global search to verifier.
- #36 daily-analytics test pins the clock (the counting day rolls at 04:00 America/New_York; the old test failed at wall-clock times in 04:00 to about 12:00 UTC).
- #37 retired `/compounds/<slug>` 307 to `/intelligence/explore/<slug>` for slugs with a dossier (retatrutide, tirzepatide, semaglutide, cagrilintide, ll-37, oxytocin); `/compounds` goes to `/intelligence/market`.
- #38 Market filters/compare survive Back (URL mirror plus one-shot sessionStorage `vialgrade:explorer-return`); Pexiganan dead anchor fixed.
- #39 24px tap targets (`@layer base` rule in `src/app/globals.css` plus `min-h-6`).
- #40 role walkthrough fixes: hero "Check an exact source ID" form (`hero-source-check.tsx`), verifier accepts study links and offers a live lookup, staff landing is research-first ("Reader traffic"; vendor/order/referral figures moved under "Historical referral figures"), no stacked public header on `/admin`, `/login` redirects signed-in users, new `/orders` page that says order history is offline, `/orders` added to `CUSTOMER_ROUTES` in `scripts/lib/app-routes.mjs`. CI `verify` passed (19m50s).

Not merged: this docs branch `docs/signup-sources-design-2026-10-21` (worktree `~/VIAL-design`). Offer Nate a PR for it; do not merge.

Known leftovers, deliberately not done:
- Usability study never run. Keep the label **"not usability-validated"**.
- `docs/RESEARCH_UX_COHERENCE_AUDIT_2026-10-20.md` and the `PRODUCT_EXECUTION_LEDGER` have NOT been updated with the journey and role-walkthrough findings. Do it if asked (findings: Back lost filters; dead Pexiganan anchor; small tap targets; hero had no working ID door; staff saw an old commerce dashboard; stacked headers on /admin; signed-in `/login`; no `/orders`). Untracked evidence lives in `~/VIAL-ux/audits/` (generated; never commit `audits/`, `AGENTS.md`, `CLAUDE.md`).
- Market "Sort" lives under "More filters", and Pexiganan appears in two shelves. Nate said keep as is.
- `/seller` and `/lab` show a login page to anonymous visitors (documented in `access-policy.ts`); bare `/admin/partner` 404s; nothing links to it.
- `npm audit`: 5 high findings in the dev-only chain braces, micromatch, fast-glob, `@next/eslint-plugin-next`, `eslint-config-next`. No upstream patch. `npm audit --omit=dev` shows 0. Do NOT run `npm audit fix --force` (it downgrades Next). Accepted as dev-only.
- Stale merged worktrees you may remove after confirming with Nate (delete exact paths only, never by substring): `~/VIAL-flake`, `~/VIAL-slugs`, `~/VIAL-state`, `~/VIAL-tap`, `~/VIAL-roles`, `~/VIAL-ux`.

## 2. What Nate asked for in the last turn (the new work)
Nate said, roughly: he liked vendor click-throughs; the site should be more research-oriented but "we can't say anything about selling"; he asked whether researchers would actually buy peptides from vendors or whether it should be manufacturers only; people are not signing up; there should be a first-visit pop-up for signed-out readers within about 10 seconds; and there should be an incentive to come back. He said "we don't have to do all that now".

Decisions he gave in chat (also recorded in the design doc):
1. Email-only list: deferred to the assistant. My recommendation: build it later, after the "recently updated" strip, with consent, unsubscribe and deletion.
2. Published lab COAs: acceptable. Still check rights per document and label "document as published, not independently verified".
3. Vendor click-throughs: **undecided, leaning yes**. Do NOT build or re-enable. See section 4.
4. Usability study question "would you buy through this site?": undecided. Recommend asking.

## 3. Recommended build order (all behind approval of the PR)
1. **"Recently updated" strip** on `/intelligence`. No new data, no new decisions. Source it from data already in the repo (trial status and record dates). Test it.
2. **Sources section on dossiers**, step A1: originators and trial sponsors from data we already hold, with a source link on every row. No price, stock, cart or "available from" wording.
3. **Step A2**: published lab COAs as documents, with the "as published, not verified" label, after a per-document rights check.
4. **Email-only digest + slim first-visit prompt** (remembered dismissal, localStorage in try/catch, never required; show after about 10s OR first dossier scroll; never on `/legal/*`, `/login`, `/register`, `/admin*`; not for signed-in users; not a blocking modal). Needs privacy notice text, consent, unsubscribe, deletion path. Nate must approve the copy.
5. Per-compound alerts and saved comparisons stay behind the privacy review (they reveal health interests).

## 4. The vendor click-through question: how to think about it
Do not decide it for Nate and do not build it. The honest picture:
- Old click-through data is gone from the research framing. The quarantine and the 410 on referrals exist while "prior seller/COA sources, privacy rights, and editorial claims are reviewed". The `ORIGINAL_MARKETPLACE_RESTORATION` doc parks "vendor scores, actual material grades, checkout/referral fees, seller import".
- The main legal/regulatory risk is not that vendors are linked, it is that surrounding facts (peptide products for human use, "research use only" labels, affiliate fees) can read as marketing unapproved drugs. A "research use only" disclaimer is not an exemption. This needs a **lawyer**, not an engineer.
- Whether researchers want to buy via us is unmeasured. Nate suspects some do. The cheapest evidence is a usability-study question and possibly counting clicks on a manufacturer/sponsor page.
- If Nate still wants it after legal advice, the safe shape is a separate, clearly labeled, opt-in "Suppliers" area behind an explicit release flag, institution-oriented (RFQ/inquiry rather than cart), no prices, no referral fees until counsel agrees. Do not weaken `publicReleaseAction` to get there; add a deliberate, tested allow-list change in its own PR.
- Until then, the Sources layer (A1, A2) delivers most of the "who stands behind this" value.

## 5. How to work in this repo (the mechanism)
Workflow Nate expects:
- **One branch and one worktree per change**, cut from fresh `origin/main` (`git fetch`, `git worktree add -b <branch> ~/VIAL-<name> origin/main`). Never match worktrees by substring.
- Open a PR; **Nate merges**. Never merge without his say-so. Do not push to main. Never claim a test passed without running it; never claim CI green until you have seen it (`gh pr checks <n>`).
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Pause and confirm before removing any working surface. Do not touch production or reactivate commerce; release needs the owner's approval. Use they/them for people whose pronouns you do not know.
- Prefer a mutation check on every new test: make the fix fail on purpose and watch the test go red.

The CI `verify` chain (about 19 minutes), run these locally before pushing, not only lint and unit tests:
`lint` → `typecheck` → `test:all` → `audit:security` → `db:backup-drill` → `audit:dependencies` → `build` → `audit:roles` → `audit:accessibility` → `verify:live:selftest` → `test:e2e` (plus an evidence-only research subset). I once pushed without `audit:roles` and CI failed because a new `/orders` page was unclassified. **Any new route must be added to the right set in `scripts/lib/app-routes.mjs`** (public, customer, staff, etc.), and `npm run audit:roles` and `npm run audit:accessibility` must pass.

Gotchas that cost hours:
- macOS: no `timeout`; use `sed -i ''`; grep may be ugrep.
- Playwright specs **skip** unless `VIALGRADE_PUBLIC_EVIDENCE_ONLY=true` is set in the Playwright process. Legacy-shop specs need it UNSET. AI-analyst specs need `VIALGRADE_LOCAL_PREVIEW=true`.
- The Playwright-spawned server gave 401s. Start the production build by hand (`npm run build && npm run start`) with the flags, then point Playwright at it. Kill stale servers on ports 3100/3101 first (a leftover server tests a stale build).
- Next 16 has breaking changes. Read `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Next restores the history entry's original URL on Back even after `replaceState`. State that must survive Back needs a storage fallback.
- Tailwind v4: `@layer base` rules lose to utilities.
- Vitest fake timers with `toFake:["Date"]` also move PGlite `NOW()`. A PGlite file must have a single writer.
- `proxy.ts` is one minified line. Edit with care and re-read after.
- Local demo credentials (local dev only): customer `nora@example.test` / `VialGradeDemoCustomer!2026`; staff `jon@vialgrade.test` / `VialGradeDemoAdmin!2026` at `/admin/login` (label "Staff email", button "Continue securely").
- `AGENTS.md`, `CLAUDE.md`, `audits/` in worktrees are generated and untracked: never commit them.
- Do not use `git add <dir>`; add exact files.

Tests live in `tests/unit`, `tests/integration`, `tests/e2e`. Key files: `src/lib/public-research-release.ts`, `src/lib/research-explorer.ts`, `src/lib/research-explorer-state.ts`, `src/lib/nct-identifier.ts`, `src/components/intelligence/*`, `src/components/research-release-chrome.tsx`, `src/app/intelligence/**`, `src/app/admin/**`, `scripts/lib/app-routes.mjs`, `src/app/globals.css`.

## 6. Roles (what each sees)
Anonymous visitor: `/intelligence/**` and `/legal/**`. Customer (historical account): `/account`, `/for-you`, `/orders`, `/saved-searches`, `/watchlist`. Staff: `/admin/**` (login `/admin/login`). Retired seller/laboratory areas: login page for anonymous visitors, deliberate.
Pexiganan facts: `/intelligence/verify` is a curated Pexiganan register (PubMed/PubChem IDs checked against selected records only). `/intelligence/studies/<NCT>` is a live ClinicalTrials.gov lookup.

## 7. Paste-ready prompt for the next session

> Continue VialGrade work in `~/VIAL` (repo `pegg-dot/vial`). You have no memory of earlier sessions. First read `docs/HANDOFF_2026-10-21_UX_ARC_AND_NEXT.md` completely, then `docs/SIGNUP_RETURN_AND_SOURCES_DESIGN_2026-10-21.md`. Check `git fetch` and `gh pr list` so you know what is merged. The site is a research-evidence product running in an evidence-only quarantine (`VIALGRADE_PUBLIC_EVIDENCE_ONLY=true`); do not weaken it, do not touch production, do not re-enable commerce, referrals or vendor click-throughs, and do not merge anything: Nate merges. Do not claim tests or CI passed unless you ran them or saw them.
> Tasks in order: (1) Ask Nate whether to open a PR for the docs branch `docs/signup-sources-design-2026-10-21` (worktree `~/VIAL-design`). (2) Build the "Recently updated" strip on `/intelligence` from existing repo data, in its own worktree and PR, with tests and a mutation check, and run the full local CI chain including `audit:roles` and `audit:accessibility`. (3) Then the Sources section A1 (originators and sponsors, source link on every row, no buy wording). (4) Then, only after Nate approves the copy, the email-only digest and the slim first-visit prompt. (5) Do not start vendor click-throughs; if Nate raises them, explain section 4 of the handoff and recommend legal review first. Also ask Nate whether to add "would you buy through this site?" to the usability study.
> Follow the work mechanism in section 5 of the handoff. Keep the "not usability-validated" label until a real study runs. Be honest about anything you did not verify.
