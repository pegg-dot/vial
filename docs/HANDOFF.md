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
