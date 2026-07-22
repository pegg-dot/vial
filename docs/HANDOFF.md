# VIAL — Vision, Architecture & Handoff (START HERE)

**Read this top to bottom before touching anything.** The code is complete through v10.0 and
backed up at `github.com/pegg-dot/vial`. What is **not** done is the *product*: the data is 100%
fake, the UX speaks in architecture jargon instead of human, and the target user was never nailed
down. This doc is the single source of truth for continuing that work.

---

## 1. What VIAL is (plain English)

**A Bloomberg Terminal / Yahoo Finance for the research-peptide market.** You look up a compound
(BPC-157, tirzepatide, semaglutide) or a vendor like you'd look up a stock, and you see the real
market on one screen: who sells it, at what price across vendors, which batches are actually
lab-tested and how pure, which vendors are trusted vs scams, and an AI that answers "show me tested
BPC-157 vendors under $50."

- **Primary user = the everyday peptide BUYER.** Fitness / weight-loss / longevity / recovery
  people. **Not scientists.** They don't care about "chain of custody" — they care about *"is this
  real, will it work, and am I about to get scammed?"*
- **The job = "don't get scammed; buy what's actually legit."**
- **Secondary users (later, downstream of buyers): vendors** (onboard to get discovered + prove
  they're legit) and **labs** (onboard for testing deal-flow). Neither matters until buyers exist.

## 2. The core reframe — why a solo founder + AI can build this

**VIAL is an AGGREGATOR, not a lab.** Yahoo Finance doesn't audit companies or execute your trades;
it aggregates public data and links you to your broker. VIAL **never tests a peptide.** It
aggregates data that already exists publicly and presents it like a terminal. → No lab, no
scientists, no touching product. This is a "founder behind a computer with Claude Code" business.

**Corollary — CONFIRMED (Nate, 2026-07-21): affiliate-out, no native checkout.** Like Yahoo links you to your broker,
VIAL links the buyer out to the vendor (affiliate link). VIAL never touches money → this sidesteps
the payments / legal-gray-zone problem **and** preserves neutrality. The cart/checkout that exists
today is likely the wrong model (see §8).

## 3. How the data actually gets there (THE crux question)

This market already has structured, public data — it's just scattered across 20 tabs. VIAL
centralizes it:

1. **Lab results — the killer source.** [Janoshik Analytical](https://www.peptidehackers.com/blogs/q-a/third-party-peptide-testing-guide)
   is the de-facto standard tester and publishes a **QR-verifiable public database**: every
   certificate resolves to a record on their servers, batch → purity %, and **vendors cannot edit
   COAs after the fact.** Plus MZ Biolabs and Colmaric (US). This is the "audited financials" —
   unfakeable, and free to verify against without testing anything.
2. **Prices + listings** — scrape vendor sites. Same compound across N vendors, tracked over time =
   the "ticker."
3. **Reputation** — Trustpilot, r/Peptides (which already polices fake reviews), forum sentiment =
   the "analyst ratings + news" layer. AI summarizes it.
4. **Scam signals** — the red flags buyers already use are *computable*: no batch-matchable COA,
   price too-good-to-be-true, no real business address, astroturfed reviews, cold-emailing.

**All of this is AI-scrapable/parseable. None of it requires testing.** And critically: **VIAL
already has the ingestion engine built** — `src/server/refresh/` (SSRF-hardened fetch, immutable
snapshots, the pipeline), the extractor provider seam (`src/server/agents/extractors/`), parser
contracts, and the review→publication cascade. It is currently **pointed at fixtures.** Making the
data real = pointing it at Janoshik's public DB + real vendor URLs + reviews. That is the entire gap
between "made up" and "real," and it is automatable exactly as the founder wants.

## 4. The Bloomberg mapping (the product shape)

| Finance | VIAL |
|---|---|
| Ticker | Compound (`/compounds/bpc-157`) — price across vendors, aggregate tested-purity, news |
| Company | Vendor (`/vendors/...`) — reputation, price competitiveness, test coverage, red flags |
| Audited financials | Batch passport — the specific Janoshik record backing a claim |
| Analyst research / assistant | The AI terminal ("is PureRawz legit for BPC-157?") |
| Your broker | The vendor's site (affiliate link out) |

## 5. Architecture (what exists today)

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · PGlite (dev/test) /
managed Postgres (prod) · zod. The DB is abstracted so it runs locally and on managed Postgres
unchanged. Schema at **v13**; app version **10.0.0**.

**Server domains (`src/server/`):**
- `catalog/` — compounds, vendors, products, listings (the "market")
- `market-data/` — canonical entity graph + fuzzy resolution (the identity substrate)
- `registry/` *(10.0)* — public `vial:{type}:{slug}` IDs + resolver (the standard)
- `evidence-network/` — labs, samples, hash-chained custody, reports, **batch passports** (the proof)
- `reputation/` *(10.0)* — decomposable vendor/lab records, **never a single score**
- `intelligence/` — opportunity/risk signals + the **cascade**
- `refresh/` — source ingestion: safe-fetch, snapshots, pipeline ← **the engine to point at real data**
- `agents/extractors/` — deterministic + model extractor seam (model inert until benchmarked/approved)
- `api-access/` *(9.0)* — bearer API keys, public read API
- `commerce/` *(v5)* — **SANDBOX** marketplace (fake payments, kill-switched)
- `seller/`, lab ops — vendor & lab onboarding tools
- `auth/` — deny-by-default perimeter (`access-policy.ts`), sessions, roles

**Frontend (`src/app/`):** public pages (`/`, `/market`, `/compounds`, `/vendors`, `/passports`,
`/labs`, `/signals`, `/developers`, `/methodology`…), `account/*`, `seller/*`, `lab/*`, `admin/*`.

## 6. Cascading traces (the causal audit graph)

Every reviewed change writes an **immutable `publication_event`** (before/after) *in the same
transaction* as the change. `runPublicationCascade` threads a single `root_event_id` from the
originating source event through **every** derived metric, alert, and opportunity signal, and
`trace_edges` link parent→child. So any published number can be walked all the way back to the
snapshot and source that justified it — like tracing a stock figure back to the filing. This audit
spine is genuinely strong and is a real moat; keep it.

## 7. Compounding loops (the moats)

- **A — Time:** the historical graph (prices, evidence, batches over time) can't be reconstructed by
  a new entrant.
- **B — Participation:** cross-lab corroboration on a batch — more independent tests → denser, more
  authoritative record; **conflicts are preserved, never averaged away.**
- **C — Identity:** resolution accuracy improves as the alias corpus grows.
- **⭐ STILL OPEN (biggest cheap win):** the **resolution learning loop.** Today, human corrections
  and resolution confirmations are *discarded* instead of written back as canonical aliases. Wiring
  that write-back makes every correction permanently sharpen the registry — the network-effect the
  audits flagged as the top "11.0" candidate.
- Reputation is the emergent product of A+B and must **never** become a stored score.

## 8. What's real vs fake vs deferred (be honest with the founder)

- **Data: 100% fictional fixtures.** No real ingestion has ever run.
- **Commerce / checkout: sandbox, fake payments, kill-switched.** Probably the wrong model (§2 →
  affiliate-out instead).
- **Model extractor: built but inert** (deterministic only; needs a benchmark pass +
  `ANTHROPIC_API_KEY` + approval flag to go live).
- **Native mobile app: deferred** (dev machine has no Xcode; web-ambient chosen instead).
- **Users: none.** No real buyer, vendor, or lab.

## 9. Open product decisions (resolve WITH the founder before building)

- **Marketplace vs info service** → recommendation: information terminal + **affiliate-out**; drop
  real checkout.
- **Monetization:** affiliate to vendors, premium terminal subscription, vendor "verified"
  placement (careful with neutrality), lab lead-gen.
- **Neutrality landmine:** if paying vendors can buy better ratings, the entire trust value dies.
  The money layer and the truth layer must stay cleanly separated.
- **Which user first:** the **BUYER.** Hide or cut scientist-facing surface (the developer API,
  registry-as-product) until buyers exist.

## 10. UX / UI — what's wrong, and the direction

**Problems (the founder called these out directly):**
- Copy speaks **architecture, not buyer**: e.g. "Normalize the market / Attach evidence / Track
  change / Gate transactions", "the internal object model behaves more like a financial data
  terminal." Nobody buying peptides talks like this. Rewrite in buyer language: *"See who's actually
  legit before you buy."*
- **Too many surfaces/tabs** for a product with no chosen user (for-you, signals, waitlist, cart,
  and a cluttered developer/account area whose tabs don't make sense to a normal person).
- The experience should feel like a **terminal that's powerful but human** — data-dense where it
  helps a buyer decide, dead-simple on the surface, science tucked behind a "details" link for the
  5% who want it.

**Design system (keep — from `AGENTS.md`):** warm off-white, near-black, violet, blue, mint;
restrained motion (respect reduced-motion); strong focus states + semantic landmarks; **avoid**
generic-dashboard templates, neon-supplement aesthetics, medical-clinic visuals.

**Approach:** go **section by section.** For each page/tab ask: *who is this for, what's the one
job, does the copy speak human, keep/cut/merge?* Do this audit first, then rewrite copy, then do the
visual polish with Fable 5 / Cloud Design.

## 11. Roadmap from here (sequenced — do NOT build more versions)

1. ~~**Product + UX audit**~~ **DONE 2026-07-21** — full audit doc at `docs/audit/vial-ux-audit.html`.
2. ~~**Make the data real**~~ **DONE 2026-07-21** — BPC-157 is live end-to-end. 3 real vendors
   (Eternal $34.99, Bluum $42, Biotech $49.40) fetched live from their real product pages +
   the Janoshik public COA feed, run through snapshot→extract→review→publish, marked **Live**.
   Run it: `VIAL_LIVE_INGEST_APPROVED=true node --import tsx scripts/ingest-real-bpc157.mjs`
   (dev server stopped first — file-backed PGlite is single-writer). Network-only proof:
   `node --import tsx scripts/live-source-smoke.mjs`. See progress log below.
3. ~~**UX cleanup**~~ **DONE 2026-07-21** — see progress log below.
4. **Design polish** — Fable 5 / Cloud Design visual pass on the cleaned surfaces.
5. **Monetization** — affiliate-out model (decision CONFIRMED by Nate 2026-07-21; the product
   page CTA is already "Buy at [Vendor] →", inert until data is real).
6. **Deploy** — Vercel + managed Postgres (the DB layer is already built for this).

### Progress log — 2026-07-22 (lab registry: sourced, tiered, wired — defamation-safe)

Nate's concern: as this scales, don't get sued for defamation over half-true lab claims, and make
sure evidence is actually WIRED into VIAL, not just gathered. Both addressed.

- **Provenance-first research on all 11 labs** (`docs/labs-research.md`) caught two live liabilities:
  **Horizon Analytical** and **SteriGenix** are shown on vendor COAs as independent labs, but
  neither is a confirmable real/independent lab (Horizon shares an address + domain-timing with a
  vendor group; SteriGenix = 2-month-old domain, no address/phone/registry). And **Vanguard** is
  genuinely A2LA ISO-17025 accredited — but its scope is food microbiology/heavy metals, NOT
  peptides (verified against A2LA's scope PDF), so "ISO-17025 accredited" on a Vanguard peptide COA
  overstates it. Also: **Janoshik** confirmed a real Czech entity but NOT ISO-17025 (vendor sites
  falsely claim it is); MZ/Colmaric/Freedom/BTLabs/Nutri = real independent; Kovera/SR-Bio = real
  but independence unverified.
- **`src/server/labs/registry.ts` is the single source of truth.** Each lab tiered
  independent / independence-unverified / unverified; every accreditation carries its verification
  status + whether scope covers peptides; every claim sourced. `canonicalizeLabName` collapses
  split names (Janoshik/Janoshik Analytical); `labCountsAsIndependent` gates what VIAL vouches for.
- **Wired end-to-end + proven:** recordLabTest applies the registry on write (canonical name +
  is_independent, migration v25); `reconcileLabsFromRegistry` fixed the 250+ existing rows;
  reputation counts only confirmed-independent COAs; passports project only from them **and now
  prune stale passports** (fixed a real sync bug — Vici showed 1 COA / 2 passports). Self-published
  vendor COAs (no lab) → "Vendor self-tested"; unverified labs → "Unverified lab · <name>" — shown,
  never counted. `/labs` rebuilt from the registry (tiers + scope-aware accreditation + sources);
  `/labs/[slug]` full sourced profile; public `/api/public/v1/labs` (`labs:read`); batch API
  declares `evidenceType`. Fixed a Cloudflare email-artifact leak in vendor derivation.
- **7 cross-surface sync invariants verified** (no empty passports, passports only from independent
  evidence, every passport registry-resolvable, no orphan ids, all lab names canonical, no
  garbage slugs) + locked as a regression test. Gate green: lint, 156 unit, all integration, build,
  e2e 11/11. Pushed (tip a02bb8d), NOT deployed. Open: reviews for ~50 COA-derived (mostly B2B
  manufacturer) vendors is gathering; real `laboratory_profiles` entities still deferred (evidence
  network stays demo — the registry is the real lab surface now).

### Progress log — 2026-07-22 (deepen evidence: blind tests + independent COAs + REAL passports)

The reframe (Nate: "get more STUFF for the vendors we have — lab tests, independent
records, passports, batches, reports"): VIAL had a full evidence-network architecture
(labs → sealed samples → hash-chained custody → reports → **batch passports**) running on
**1 demo record**, while 250+ real certificates sat in a flat side-table beside it, never
connected. Three increments closed that gap:

1. **Blind-test + analysis-type tag (95070dd).** Janoshik's feed labels each test — the BLIND
   flag (buyer-obtained sample the vendor couldn't cherry-pick — the strongest independence
   signal) and the category (purity vs a distinct **sterility/endotoxin/heavy-metals** safety
   test). Migration v23 (test_type/is_blind/test_note); classifyTestNote; both ingest paths +
   an idempotent same-source backfill. Panel shows a blind chip/count + safety badge, blind
   sorts first. Backfill: 63 blind tests + distinct safety records across 253 COAs.
2. **Independent-lab COAs for the storefronts buyers actually shop (54bd0a2).** The high-traffic
   vendors (Umbrella, Swiss Chems, Peptide Pros, PureRawz, Ascension, Loti, Chemyo, Core,
   Eternal, Vici) held ZERO independent evidence → "Independently tested? → none on record."
   5 parallel gather-agents found real, document-verified COAs naming real third-party labs
   (MZ Biolabs, Vanguard [A2LA], Freedom Diagnostics, Kovera, SR Bio, Nutri Analytical,
   SteriGenix, BTLabs). 21 recorded. ⚠️ Honesty split: self-branded no-lab-named docs
   (Behemoth/Biotech/Nootropic) deliberately EXCLUDED from the independent path. Lab facts
   saved to scripts/data/testing-labs.json (⭐ Janoshik NOT ISO-17025; Colmaric/Vanguard ARE).
3. **⭐ Real batch passports (0dd0a1a).** projectLiveBatchPassports groups every
   (vendor, compound, batch) cluster of real certificates into a published LIVE batch passport:
   **143 real batches across 44 vendors** (was 1 demo). Decomposed, explainable confidence
   (volume · lab diversity · blind-independence · purity agreement · recency), capped <93%
   (external COAs never prove every vial). Honest by construction: does NOT fabricate VIAL's
   custody chain the COAs never passed through — links real lab_test_records via a new
   passport_lab_tests join (migration v24) and says so in limitations. Reuses the passport
   surface → appears on /passports, mints vial:batch registry IDs (144), feeds the vendor
   "Independent evidence corroboration" dimension. Detail page forks on origin.

Result vs Nate's screenshot: Vici Peptides went from "No independent tests on record" to
"2 independent COAs · median 99.9% · 2 batch passports" (established). Gate GREEN: lint ·
141 unit · all integration (+2 new) · build · e2e 11/11. Pushed to origin/main; NOT deployed.
Follow-ups: full laboratory_profiles entities for the real labs (Janoshik/MZ/etc — /labs still
demo-only); self-published-COA honest surfacing; batches w/o codes don't form passports (honest).

### Progress log — 2026-07-22 (Janoshik NEW-test discovery)

- **Discovery closes the Janoshik loop:** `src/server/ingest/janoshik-discovery.ts` +
  `scripts/collect-janoshik-discover.mjs` (gated, `--offline` re-pass supported). One run now:
  refreshes the on-disk feed snapshot, ingests tests we don't hold (minting newly-named client
  vendors), backfills vision-read purities (`applyPurities`, COALESCE — never overwrites),
  runs the liveness pass, and recomputes linkage + compound stats. The portal shows a bounded
  window and verify URLs stay valid after roll-off, so each run grows history the feed later
  drops (moat A). "Not in current feed" wording = rolled off OR delisted; feed can't distinguish.
- **⭐ Real parser bug found by the first live run:** the portal pins blind-test results as
  `<li class="sticky" data-test-id=…>`; the parser split on the literal `<li data-test-id="` and
  had NEVER seen any sticky entry (50 in today's feed, incl. Janoshik's GLP-1 blind-test program).
  Now attribute-order-robust + feed-level dedupe (49 stickies were pinned duplicates). Net new
  today: **#101083** Retatrutide 20mg (InnoPeptide) — ingested, cert vision-read
  (99.814% low-vial, batch RT20/2026-01-09-A, 22 JAN 2026), dose-check "100%: the dose is there",
  live-verified on the vendor page. 201 COAs stored (163 with purity).
- Verify: lint · typecheck · 129 unit · 33 integration files · build · e2e 11/11 all green.

### Progress log — 2026-07-21 (deep-dive audit + full remediation)

Full audit at `docs/audit/vial-deep-dive-audit.html` (6 parallel auditors). Every
finding was then fixed across 5 committed batches (all pushed):
- **B1 trust inversion + labeling:** real vendors no longer look worse than fake ones
  (empty-evidence state, no "0 (0)" rating, risk-flags count only fraud not opportunity
  signals, "unknown" not "0%" docs); cascade recomputes price_change; evidence label
  advances off "Awaiting first check"; swept remaining "fictional" copy; removed a
  buyer-facing name leak.
- **B2 commerce quarantine:** cart provider off the global layout; /cart & /checkout
  308→/market (code kept, dormant); admin nav grouped with a "Legacy · simulation"
  section; /signals, /operations, /developers de-orphaned into the footer.
- **B3 backend edges:** live entities now mint vial: registry IDs (resolvable via the
  public API); docker `scheduler` service + CRON_SECRET (was: no scheduler → stale
  data); storefront junk claims auto-reject (queue no longer fills with garbage).
  ⚠️ Deferred with reason: a runtime path to create REAL batch passports needs COA
  OCR + batch matching — building it without real lab data would fabricate evidence,
  so live listings honestly show "no lab evidence yet".
- **B4 buyer self-serve signup:** `/register` + registerCustomer (customer-only;
  vendors are discovered, not self-onboarded) + guest-watchlist merge on sign-in.
- **B5 polish:** styled error boundary, AA-contrast muted text, guest signup nudge.
- Verify across all batches: 80 unit, 25 integration suites (+9 new), e2e 11/11,
  build, lint, registry+security audits — all green.
- ⚠️ Two product calls I made (flag if you disagree): commerce = quarantine not delete;
  self-serve = buyer signup only (no vendor/lab self-onboarding).

### Progress log — 2026-07-21 (real data executed)

- **BPC-157 is real, end to end.** `origin` column ('demo'|'live') is the keystone (migration 14).
  New create-path `src/server/ingest/live-sources.ts` (was gap #1/#2) inserts real vendors/listings
  and registers real `transport='http'` policies, gated by `VIAL_LIVE_INGEST_APPROVED`.
  `src/server/ingest/bpc157.ts` provisions Eternal/Bluum/Biotech + the Janoshik feed and runs the
  real fetch → snapshot → extract → review → publish; only sane in-range price/availability
  auto-approves, junk (batch/issuer regex noise) is **held for a human** — the review gate on real data.
- **⭐ Production bug fixed (found by live smoke, not units):** `safe-fetch`'s DNS pin shim returned a
  single address when Node's http agent called `lookup` with `{ all: true }` → real fetches errored
  "Invalid IP address: undefined". Would have broken ALL real ingestion. Now `pinnedLookup()`, IPv4-preferring, unit-tested.
- **Honest labeling (the connected keystone):** `DataOriginBadge` Live/Demo on cards + product/vendor/
  compound; banner/footer/legal reworded to "demo unless marked Live"; live vendors no longer say
  "Fictional profile". `AGENTS.md` product boundaries updated to codify demo/live + inert-affiliate.
- **Affiliate CTA is real-aware but still INERT:** live listings show the real destination host and a
  "would link to …" note; it does not navigate until Nate approves the affiliate step.
- **Known small gaps (not blockers):** COA purity lives in a JPG on Janoshik verify pages → needs
  OCR/vision (deferred); a live vendor with no extracted availability shows "Unavailable" (no "Unknown"
  in the enum); freshly-ingested live vendors show 0% docs / empty reputation dims (honest "unknown").
- **Verify:** lint, typecheck, 80 unit, all integration (+4 new), build, e2e 11/11, audit:registry,
  audit:security all green.

### Progress log — 2026-07-21 (audit + UX cleanup executed)

- **Nav collapsed 13 → 5 doors:** Market · Compounds · Vendors · How we check (+ For you when
  signed in). Search is the header omnibox. Watchlist is now "Saved" and pairs with saved
  searches via tab pills. Cart/checkout/orders are out of every menu (code kept, routes alive).
- **New `/how-we-check`** absorbs methodology + evidence/testing/passports/labs framing in buyer
  language; `/methodology` permanently redirects there. Route added to the public perimeter in
  `access-policy.ts`.
- **Copy pass, buyer language, all buyer surfaces:** home ("Don't get scammed buying peptides"),
  market, search, compounds, vendors (+ plain-English reputation labels, UI-side only — the API
  keeps formal labels), product ("What we could verify", affiliate CTA), passports, labs,
  research, signals, personal pages, help FAQs, about.
- **Bug fixed (pre-existing, real):** logging in wiped the user's server-side comparison —
  the marketplace provider survives the login redirect with stale `[]` state and PUT-synced it
  over the seeded comparison. Now syncs only after a real user change (`compareDirty` ref).
- **e2e suite green for the first time on this machine (11/11):** Playwright harness moved from
  `127.0.0.1` to `localhost` (CSRF origin check requires it — same rule as dev), a stale
  test targeting a long-gone hero button now uses the header search, and CSP's
  `upgrade-insecure-requests` is emitted only when `NEXT_PUBLIC_SITE_URL` is https (it broke
  http-localhost production builds). Build for local e2e with
  `NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build`.

**Guardrail: no new infrastructure or "11.0" until the buyer experience is real and legible.**

## 12. Repo facts / how to run

- **Repo:** `/Users/natepegg/vial` · `github.com/pegg-dot/vial` (private) · `main` @ 10.0.0, schema v13.
- **Run:** `npm run dev` → **http://localhost:3000** (use `localhost`, NOT `127.0.0.1` — CSRF blocks
  the login POST on `127.0.0.1`).
- **Demo logins** (dev-seeded; password `VialDemo<Role>!2026`, e.g. `VialDemoCustomer!2026`):
  customer `nora@example.test` · seller `marcus@helixtest.test` · lab `elena@aperture.test` ·
  admin `jon@vial.test` · reviewer `maya@vial.test`.
- **Verify:** `npm run verify:v10` (lint · typecheck · tests · 9 audits · build). Known: `audit:roles`
  fails **in this sandbox only** (it boots a production `next start` server whose token-seed doesn't
  work here) — proven pre-existing at baseline `1bbba48`, not a regression.
- **Hard boundaries (`AGENTS.md`):** information-only; no real payments/checkout/dosing/human-use
  guidance; **unknown stays visible; no black-box score;** all seeded data is fictional.

---

*Sources for §3 (real peptide-market data landscape):*
[PeptideHackers third-party testing guide](https://www.peptidehackers.com/blogs/q-a/third-party-peptide-testing-guide) ·
[QSC on Janoshik COA verification](https://qsc-usa.com/janoshik-analytical-lab/) ·
[The Peptide Catalog — independent labs](https://thepeptidecatalog.com/testing-labs) ·
[PeptideDeck — legit vendors & scam red flags](https://www.peptidedeck.com/blog/best-legit-peptide-vendors-2026) ·
[NorthPeptide — COA checklist](https://northpeptide.com/recent-research/got-scammed-buying-peptides-how-to-avoid)
