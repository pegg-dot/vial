# VialGrade — Complete Marketing Context Briefing

> **Purpose.** This is a full, self-contained briefing on VialGrade for a marketer and their AI assistant.
> It reflects the **current** product (post-redesign). Ignore older docs in this folder that say the
> data is "fake" or the UX is "jargon" — that predates this version. **Golden rule for all
> messaging: when unsure, under-claim.** VialGrade's entire reason to exist is honesty about evidence, so
> marketing that overstates ("guaranteed pure," "safe," "approved") breaks the product's core promise
> and creates legal risk. Read §12 (Guardrails) before writing any copy.

---

## 1. One-liner & elevator pitch

**One line:** *A trust-and-verification layer for the research-peptide market — it shows you what's
really in the vial before you buy.*

**Elevator pitch:** Research peptides are sold grey-market, on a stranger's word — any vendor can
claim "99% pure," borrow someone else's lab certificate, or launch a scam site overnight. VialGrade is a
"Bloomberg Terminal / Yahoo Finance" for that market: it aggregates every vendor's real prices, the
independent lab certificates behind their claims, and their reputation and regulatory record into one
screen, gives each a plain-English trust verdict you can trace to its sources, and hands you off to
the vendor to buy. **VialGrade never sells anything, never touches money, and never tells you to use a
compound — it exists so a buyer can avoid getting scammed, underdosed, or sold a fake.**

## 2. The problem (the "why now")

- Peptides for research are a **large, fast-growing grey market** with no gatekeeper. Sellers self-
  report quality; there's no FDA-style approval and no neutral referee.
- **The core failure is trust.** A buyer cannot tell a legitimate seller from a scam, or a real purity
  number from a fabricated one. Common harms: **counterfeit/underdosed product, borrowed or fake lab
  certificates, exit-scam sites, and prices set as bait.**
- Existing "review" sources are conflicted (vendor testimonials, affiliate blogs, Reddit noise).
- **VialGrade's thesis:** replace the vendor's *word* with the *receipt* — public, vendor-immutable
  evidence (lab certificates, government records, gathered reputation) presented decomposably so a
  non-expert can act on it.

## 3. What VialGrade is — and explicitly is NOT

**IS:** an independent **verification and comparison layer** (an aggregator + trust engine) over the
existing peptide market. It reads real public sources, structures them, and links out to vendors.

**IS NOT:**
- ❌ Not a store / pharmacy / marketplace that sells. It processes **no payments** and holds no
  inventory. Buying happens on the vendor's own site.
- ❌ Not a lab. It doesn't run tests; it **surfaces** independent tests others ran and who sampled them.
- ❌ Not medical, dosing, or investment advice. Compounds are framed **research-use-only**.
- ❌ Not an endorser. A good trust verdict is "no red flags on the record," never "this is safe to use."

## 4. Who it's for (audiences)

1. **Primary — research-peptide buyers** across the experience spectrum:
   - *Newcomers* who can't yet read a certificate (the product deliberately surfaces the safe,
     evidence-first option first, and explains every signal in plain English).
   - *Experienced researchers* who want depth: real cost per active mg, batch-matched COAs, blind-test
     counts, purity distributions.
2. **Secondary — vendors & manufacturers** (the `/sell` side): a seller workspace where a vendor can
   claim their profile, submit listings and evidence, and improve their standing — but every claim is
   **proposal-only until reviewed**, and self-serve never means blind trust.
3. **Tertiary — the broader "is this legit?" searcher**: someone who has a vendor/COA/batch code and
   just wants to check it (the `/verify` tool).

## 5. How the verification actually works (the core mechanic — this is the product)

**The chain of evidence.** VialGrade's homepage thesis is *"Trust is a chain of evidence."* Every public
claim is traced to: a **source snapshot** → a **review decision** → a **publication event** → a
**causal root**. Nothing is asserted without a traceable receipt.

**A) One certificate answers six separate questions.** A polished-looking COA (Certificate of
Analysis) can still dodge most of what matters. On every listing VialGrade breaks a test claim into
independent dimensions and marks each **established / partial / unknown** — e.g. *Is the issuer a real
independent lab? Is the exact batch linked? Where did the sample come from? How current is it?* It
never lets a nice-looking document stand in for the specific questions it doesn't actually answer.

**B) COA cross-check (counterfeit detection).** For each listing, VialGrade cross-checks the vendor's cited
batch against the independent lab feed:
- **Batch-verified** — the exact cited batch resolves to an independent record for *this* vendor
  (strongest documentary evidence).
- **Verified** — an independent record backs the vendor's testing for this compound.
- **Low purity** — an independent test measured below what these products advertise (~<95%).
- **Unbacked** — the vendor advertises testing, but no independent record confirms it yet.
- **Mismatch / borrowed certificate** — the cited certificate actually belongs to a **different
  manufacturer**. This is the clearest counterfeit signal, and VialGrade now catches it consistently on
  the market grid, the product page, and the comparison tool.
- **No claim** — nothing advertised or on record.

**C) The composed vendor trust verdict — decomposable, never a black-box score.** Every seam VialGrade
holds about a vendor folds into ONE plain-English verdict — **Trusted / Caution / Unproven / Avoid** —
and the verdict shows *exactly which facts it rests on*. The seams:
  1. **Government enforcement** — public FDA / DOJ / FTC actions and recalls.
  2. **Independent lab testing** — how many COAs, median measured purity, how many were blind.
  3. **Reputation record** — open risk flags, whether independent evidence corroborates itself.
  4. **Third-party trackers** — outside aggregator scores, shown as *their* opinion, not VialGrade's.
  5. **Operational signals** — domain age, payment rails, research-use disclaimer, risky storefront copy.
  6. **Buyer reviews** — gathered off-site buyer sentiment (never the vendor's own testimonials).
  7. **Community signal** — r/Peptides–style mentions (scam vs vouch).
  8. **Operator-network linkage** — shared hard identifiers with an already-flagged storefront.
  9. **Site status** — offline / parked (dead, an exit-scam end state) vs merely bot-blocked.
  10. **COA integrity flags** — borrowed/mismatched certificates.
The same verdict rides everywhere the vendor appears — the vendor page, the `/verify` tool, and the
vendor directory ranking all agree, because they compute it from the one source.

**D) The "too cheap" detector.** Real peptide has a floor cost, so a price far below market is treated
as a **warning** (underdosed, fake, or bait), not a deal.

**E) Real cost per *active* milligram.** Because vials come in different sizes and purities, the
sticker price lies. VialGrade computes cost-per-mg and then **cost per active mg** (adjusted for measured
purity) — the honest apples-to-apples number.

## 6. The full product — every page & feature

**Consumer / discovery**
- **Home (`/`)** — the thesis + a single big real number (*279 independent lab certificates, read by
  hand*), curated shortlists (trending, independently-verified, lowest cost/mg), and the "everything
  you'd check, already checked" value cards.
- **Market (`/market`)** — the curated marketplace: trending compounds, independently-verified picks,
  lowest-cost-per-mg, stacks/blends, newest live listings, and a full browsable/filterable grid
  (StockX/GOAT-style IA — categories, filters, quick-view modals).
- **Compounds directory (`/compounds`)** — one page per compound. Each **compound page
  (`/compounds/[slug]`)** carries a research-context knowledge layer (see §7): what it is, **how it
  works (mechanism)**, what it's studied for, how far the research has gone, and the key caveat — plus
  every vendor selling it, the live price range, the median, and a **price leaderboard** ranked by
  real cost per active mg.
- **Vendors directory (`/vendors`)** — rank **every vendor by what you care about**: *Most reliable
  (default), Best price, Highest purity, Most tested, Best reputation*. Flagged (avoid) vendors always
  sink to the bottom but stay visible and labeled. Split into **storefronts you can buy from** vs
  **upstream manufacturers**. Each **vendor page (`/vendors/[slug]`)** shows the full composed verdict
  with every contributing factor.
- **Product page (`/products/[slug]`)** — the buy box (price, market median, real cost/active mg,
  price-drop / too-cheap flags), the COA cross-check panel (the six dimensions), and the honest
  handoff ("Buy at vendor" → links to the vendor's own page; VialGrade takes $0).
- **Verify (`/verify`)** — the public "check a vendor / COA / batch before you buy" tool.
- **Compare (`/compare`)** — deep side-by-side of up to 4 listings across price, quality, reliability,
  and *"the signals most people miss"* (real cost/active mg, batch-matched COA, blind tests,
  enforcement history, vendor price index), with base-rate deltas ("−36% vs market"), winner
  highlighting, priority modes, and a differences-only toggle. Tagline: *"Compare the claims, not just
  the price."*
- **Personalization** — `/for-you` (picked-for-you with reasons), `/search`, `/watchlist`,
  `/saved-searches` (behind a lightweight sign-in; guest saves merge on signup).

**Evidence & trust surfaces**
- **Testing (`/testing`)** — how the 279 certificates were **sampled**: blind purchase (strongest —
  the seller couldn't hand-pick the unit) vs vendor-selected. VialGrade labels which is which rather than
  treating them as equal.
- **Labs (`/labs`, `/labs/[slug]`)** — the independent laboratories that issued the certificates.
- **Passports (`/passports`, `/passports/[slug]`)** — batch passports: real batches projected from the
  certificates, with per-batch measured purity.
- **Enforcement (`/enforcement`)** — the public regulatory-action record VialGrade tracks.
- **How we check (`/how-we-check`) & Methodology (`/methodology`)** — the trust-chain explainer:
  *"How much a lab test really proves," "One report answers six separate questions," "Software
  proposes, people publish"* (AI proposes changes; a human reviews before anything is published).
- **Reference standard (`/reference-standard`), Research (`/research`), Signals (`/signals`),
  News (`/updates`, `/news`), Status/Operations (`/status`, `/operations`), Developers/Terminal
  (`/developers`, `/terminal`)** — supporting evidence, market-intelligence, transparency, and API
  surfaces.

**Seller side**
- **Sell (`/sell`)** — vendor/manufacturer onboarding: *"Keep control of every claim," "Self-serve
  without blind trust," "Authorized people decide."* Sandbox onboarding, listing/evidence submission,
  all proposal-only until reviewed. (Deeper seller workspace lives behind auth.)

**Legal** — `/legal/terms`, `/legal/privacy`, `/legal/disclaimer`, `/legal/us-regulations`.

## 7. The compound knowledge layer (a content asset worth marketing)

Every compound carries a neutral, **research-use-only** briefing with these fields (no dosing, no
protocols, ever):
- **mechanism** — how it works (receptor / pathway / class).
- **researchedFor** — what it's been studied for.
- **researchStatus** — how far the science has gone (FDA-approved for X / in clinical trials /
  preclinical-animal / limited human data), with specifics.
- **knownAs** — aliases.
- **caveat** — the single most important neutral, safety-relevant caveat.

*Example (AOD-9604):* "A synthetic 16-amino-acid fragment of human growth hormone's C-terminus;
proposed to trigger lipolysis via beta-3 adrenergic/cAMP signaling… Limited human data; its largest
Phase 2b trial (2007, ~536 subjects) failed to reach significance for weight loss and development was
discontinued." This honest, sourced tone is the brand — it's a strong content/SEO pillar.

## 8. The data — sources, provenance, current numbers

- **Provenance is explicit.** Every record is marked **Live** (aggregated from a real public source
  through a reviewed pipeline) or **Demo** (clearly-labeled seeded fixtures). Global "everything is
  fictional" language is wrong — it's "**demo unless marked Live**."
- **Live sources:** vendor product pages (WooCommerce/Shopify catalogs), the **Janoshik Analytical**
  public COA feed (purity read from certificate images by hand/vision), enforcement records,
  aggregator ratings, buyer reviews, community mentions, real product photos.
- **Current numbers (safe to cite):** ~**95 vendors** (≈39 storefronts + ≈56 upstream manufacturers),
  ~**534 live listings** with real photos, **279 independent lab certificates**, ~**60 compounds**,
  11 sourced labs, plus batch passports.

## 9. Business model (how it makes money — honestly)

- **Affiliate-out, click-tracked.** When a buyer clicks "Buy at vendor," VialGrade records the click and
  redirects to the vendor's own product page. **No affiliate deals are live yet**, so links pass
  through clean; the accumulating outbound-click data is the **leverage** for negotiating vendor deals
  after launch.
- **$0 from users.** VialGrade never charges the buyer and never takes payment. ("what we take: $0" is
  literally on the homepage.)
- Future upside: affiliate/referral deals, a premium/pro tier for power users, and the seller
  workspace.

## 10. Positioning vs. alternatives

- **vs. vendor sites / testimonials:** conflicted; VialGrade is independent and shows the receipts.
- **vs. affiliate "best peptide vendor" blogs:** pay-to-rank; VialGrade ranks on **verifiable facts only,
  never who a product is "for."**
- **vs. Reddit / forums:** unstructured and gameable; VialGrade structures the same community signal and
  cross-checks it against lab and government records.
- **vs. a lab:** VialGrade doesn't test; it aggregates independent tests and, crucially, tells you **how
  the sample was chosen** (blind vs vendor-selected).

## 11. Brand, voice & design

- **Voice:** calm, precise, evidence-first, quietly contrarian toward the grey market. Explains, never
  hypes. Always honest about limits ("a certificate proves one tested batch, not the vial you'll
  receive"). Human, not architecture-jargon.
- **Design language:** warm off-white + near-black with **violet and mint** accents; bold, high-
  contrast, "hard" edges with offset shadows (Gumroad / StockX energy) — premium, legible, dense-but-
  clear. Not neon-supplement, not clinical/medical. Restrained motion; strong accessibility.
- **Live taglines (use for voice reference):**
  - *"Know what's really in the vial."*
  - *"Trust is a chain of evidence."*
  - *"Read by a human, not a scraper."* (over the 279 number)
  - *"Compare the claims, not just the price."*
  - *"Rank every vendor by what you care about."*
  - *"Trust us — it's 99% pure." → "Here's the test. Check it yourself."*
  - *"One habit, zero scams."*
  - *"We never sell you anything — we help you not get scammed."*

## 12. Guardrails — do NOT market these ways (product principle + legal/ethical)

- ❌ Never call a product **safe, pure, approved, clean, or verified-safe** from a document. Say
  "independently tested," "batch-matched certificate," "no enforcement record on file" — never
  "guaranteed pure" or "safe to use."
- ❌ Never give or imply **dosing, injection, cycling, or human-use** guidance.
- ❌ Never position VialGrade as **selling** anything or as a pharmacy/marketplace — it's a verification
  layer that links out and takes no payment.
- ❌ Never imply **medical or investment advice**; keep the **research-use-only** framing.
- ❌ Never present a **vendor as endorsed**; a verdict is a summary of evidence, not a recommendation.
- ✅ Do lean into: independence, traceable receipts, counterfeit detection, "we take $0," honesty
  about the unknown, and helping non-experts not get scammed.

## 13. Glossary (so the assistant uses terms correctly)

- **COA (Certificate of Analysis):** an independent lab's test report for a batch; the core evidence.
- **Batch / lot:** a specific production run; a COA is only really proof for its exact batch.
- **Purity (HPLC %):** the measured fraction that's the actual peptide; ~98–99% is the advertised norm.
- **Blind test / blind purchase:** an independent buyer purchased without the seller choosing the unit
  — the strongest signal, because nothing was hand-picked.
- **Vendor-selected sample:** the vendor chose which unit went to the lab (weaker signal).
- **Borrowed / mismatched certificate:** a cited COA that actually belongs to a different maker — a
  counterfeit red flag.
- **Real cost per active mg:** cost-per-mg divided by measured purity — the true price of the peptide.
- **Trust verdict:** VialGrade's decomposable Trusted/Caution/Unproven/Avoid summary of all vendor signals.
- **Live vs Demo:** aggregated-from-a-real-source vs clearly-labeled seeded fixture.
- **Janoshik:** the independent analytical lab whose public COA feed is a primary evidence source.

## 14. Current status (be accurate about maturity)

- The **product is built and current** (the marketplace, trust engine, compare, verify, vendor/
  compound directories, seller workspace) with a **real aggregated dataset** loaded locally.
- It is **not publicly deployed yet** — there is no live public URL at the time of writing (the owner
  can spin up a private preview). No affiliate deals are live. No payments anywhere.
- Marketing can proceed on **positioning, messaging, content (compound library, "how we check"),
  audience, and launch assets** now; hold any "launch / it's live at <url>" claim until the owner
  deploys.

## 15. Messaging pillars (starting points for campaigns)

1. **"The receipts, not the vendor's word."** — independence + traceable evidence.
2. **"Know what's really in the vial."** — counterfeit/underdose protection for non-experts.
3. **"Every vendor, ranked by what *you* care about."** — the decision tool.
4. **"We never sell you anything."** — the trust/business-model differentiator ($0 taken).
5. **"Read by a human, not a scraper."** — the hand-verified-COA credibility proof.

---

*Self-contained briefing — hand this file to a marketer or paste it into an AI assistant as full
product context. For the running product, ask the owner for a private preview link.*
