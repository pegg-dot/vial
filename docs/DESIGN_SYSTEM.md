# Design System

## Current visual language — the "hard" system (Gumroad × AscendBioLabs)

VialGrade's whole app uses one hard design system: **thick black borders, hard OFFSET shadows
(never soft blur), flat fills (no gradients / no soft glows), a limited palette, bold/extrabold
type, sharp radii.** It reads sharp and confident, not childish — no cartoon faces, no rainbow,
no gradient text. This superseded the earlier soft "clinical luxury" look; the durable
principles below (evidence-first, accessibility, responsive) still hold.

Utilities live in `src/app/globals.css` (do not redefine): `.ink` (2px `#111214` border),
`.ink-1` (1.5px), `.hard`/`.hard-sm`/`.hard-lg` (hard offset shadow in `#111214`),
`.hard-blue`/`.hard-mint`/`.hard-violet` (colored offset shadows),
`.press`/`.press-blue`/`.press-violet`/`.press-mint` (sink-into-shadow on hover), and `.field`
(the hardened input — use on every text input/select).

### Design thesis
Evidence-first market intelligence: calm, precise, expensive, legible — but never a clinic.
Every claim traces to a source; the interface never asserts "safe" from a document alone.

## Palette (locked)

```text
Background     #F7F7F4   (--background)
Surface        #FFFFFF
Foreground     #111214   (near-black — borders, ink, headings)
Muted text     #61636B   (--muted; meets WCAG AA on the cream background)
Royal-blue     #2B31D8
Violet         #6D5DFC
Teal           #12B3A6 / #0E8F80
Functional     coral #D3372C / #F5463D (bad) · amber #B26A00 (caution) · teal (good)
```

### Per-section signature color
Eyebrows, primary buttons, accents, and focus shadows take the section's signature:

| Section | Signature |
|---|---|
| `admin/*` (control plane; sidebar frame is near-black) | royal-blue `#2b31d8` |
| `seller/*` | violet `#6d5dfc` |
| `lab/*` and public `labs/*` | teal `#0e8f80` text / `#12b3a6` fill |
| consumer (main + secondary) | keep each page's existing accent, hardened; default royal-blue |

### Evidence / status tints (always with `ink-1`)
Color never means medically safe — it encodes evidence/operational state only, alongside text.

- good / verified / trusted → `bg-[#e6fbf4] text-[#0e8f80]`
- caution / partial / pending / stale → `bg-[#fff4e0] text-[#b26a00]`
- bad / blocked / avoid → `bg-[#fff1f0] text-[#d3372c]`
- info blue → `bg-[#eef0ff] text-[#2b31d8]` · info violet → `bg-[#f0edff] text-[#6d5dfc]`
- unknown / unavailable → neutral (`bg-[#f0f0ec] text-[var(--muted)]`) — **unknown stays visible**

## Typography
Deterministic system/Inter stack (no network-dependent build). Headlines: tight tracking,
`font-extrabold`. Metadata: smaller, `font-medium`, `var(--muted)`. Prices/measurements use
tabular numerals. Small labels: uppercase with generous tracking.

## Shape & elevation (hard)
- Cards: `rounded-[18px]`–`rounded-[20px]` with `ink`/`ink-1` borders and a `hard`/`hard-sm`
  offset shadow. Chips/pills may stay `rounded-full`.
- Buttons: `ink hard-sm press` + flat fill (`bg-[#111214]` neutral, or the section signature).
- Inputs: the `.field` class (ink border + hard blue focus shadow).
- Dark `bg-[#111214]` panels: keep dark, `ink` border, a **light** accent (admin `#8fa2ff`,
  lab `#8fffd6`, violet `#b7abff`); no `#111214` shadow on black (invisible) — use a colored one.
- NO soft `shadow-[0 … rgba]` / `shadow-sm/xl`, NO gradients, NO blur glows.

## Mechanical mapping (soft → hard), for restyling old markup
`border border-black/[.0x]` → `ink-1`/`ink` · soft/blur shadow → `hard`/`hard-sm` (or delete) ·
`rounded-[24–32px]`/`2xl`/`3xl` → `rounded-[18/20px]` · soft `-50/-700` pills → the tints above ·
gradient fill → flat tint · heading/stat `font-semibold` → `font-extrabold` · `text-black/4x–5x`
→ `text-[var(--muted)] font-medium` · `bg-black` button → `ink hard-sm press bg-[#111214]`.

## Where the system lives (highest-leverage shared building blocks)
Restyle these and whole trees reskin at once:
- Consumer: `site-header`, `site-footer`, `product-card`, `market-client`, vendor/compound panels
- Admin: `components/admin/admin-shell` + `internal-ops/ops-page` + `commerce-table` /
  `agent-run-table` / `commerce-operation-form`
- Seller: `components/seller/seller-shell` + `seller-ui`
- Lab: `components/laboratory/laboratory-shell` + `laboratory-ui`

## Core components
- **Product card** — product, quantity, vendor, price, evidence state, freshness, save/compare —
  at market density (2026-08-27): a fixed 148px photo box (a tile never grows with the image),
  a two-line title, and ONE line per fact. The trust verdict is text with an icon (`TrustLine`),
  not a pill; the evidence badge, trust chip and origin pill it replaced were all derived from
  the same trust status. Live/Demo stays on every card as the compact `DataOriginBadge`. Goal
  tags live on the compound page, not on tiles. Browse grids run four across at `xl`.
- **Compound ticker tile** — the same six things in the same six places on every tile:
  shorthand stamp · shelf · live ↗ / name / lowest price + the row's own metric / one evidence
  line. No price-change delta on tiles (see compound-ticker-card.tsx).
- **Price trend** (`lib/price-trend.ts`, `components/price-series.tsx`) — a listing's or a
  compound's observed prices, dated. Exactly one of five states renders, and the sentence is the
  chart's text alternative: *no history* ("Price checked once, on …"), *insufficient* ("N checks
  since … too short a span for a 30-day change"), *trending* ("−8.2 % over 30 days · N checks ·
  $a on … → $b on …. Observed, not projected."), *unavailable at last check*, and a *stale* suffix
  past three days. A percentage appears only when earned (baseline ≤7 days before the window,
  latest ≤2 days old, ≥14 days between; a compound needs three qualifying listings and prints
  "k of n"). The chart is a STEP on a time axis — a price holds until the next check — with
  unavailable days breaking the line. **Direction is never a colour**: rises and falls are both
  ink; the sign and the arrow carry direction. No buy language anywhere.
- **Price spread** (`market/price-spread.tsx`) — every priced listing for a compound on one
  log-scale line, median as a dashed tick, best $/mg as the black dot. The quick view draws this
  instead of a history sparkline because a listing price exists for every compound and a
  history does not yet.
- **Product photo / visual** — on a **Live** listing, show the vendor's **real product photo**
  (aggregated from their own product page's `og:image`, hotlinked with a graceful fallback);
  `ProductPhoto` renders it and falls back to the CSS-generated vial illustration
  (`ProductVisual`) when there's no image, the image fails to load, or the listing is Demo.
  The generated vial imagery is the one place gradients are allowed (it's the illustration, not
  chrome). *(Owner-approved 2026-07-29 — reverses the earlier "no external product photography"
  rule: real photos read as a real marketplace; the aggregator links out, so showing the
  vendor's own product image is consistent with the model.)*
- **Evidence badge / matrix** — concrete labels (`Issuer confirmed`, `Vendor-published`); one
  row per question, states established / partial / unknown, each with its interpretation limit.
- **Data-origin badge** — Demo vs Live (records are demo unless marked Live).
- **Vendor mark** — flat-fill + ink-border identity block (no gradient).
- **Search command** — labeled modal, keyboard-escapable, grouped entity results.
- **Compare dock** — persistent action bar, appears only when records are selected.
- **Trust chip / VialGrade verdict** — composed cross-seam verdict; never a single black-box score.

## Motion
- Motion communicates state, not decoration. Hover = the `press` sink-into-shadow.
- Search/navigation transitions are fast. Reduced-motion disables nonessential animation.

## Responsive behavior
- Core catalog content readable at 320px. Navigation collapses behind an accessible menu.
- Product detail: two columns → one. Comparison/data tables scroll horizontally rather than
  compressing evidence labels. Touch targets ≥ 40px on main interaction paths.

## Accessibility
- Strong visible focus states; semantic headings and landmarks; dialog labeling.
- Button labels express state. Sufficient contrast (`--muted` meets AA on the cream bg).
- No evidence state communicated by color alone. Reduced-motion support. Decorative product
  links removed from the accessibility tree.

## Working rules
- Restyling is styling-only: never change copy, logic, data, props, or layout to apply the look.
- Verify visible changes against desktop **and** mobile screenshots (Playwright → dev server →
  read PNG; internal pages need a demo login: `VialGradeDemo{Customer,Seller,Laboratory,Admin}!2026`).
- Never run `npm run build` while `next dev` is up (it deletes `.next`); never touch
  `.data/pglite` while dev runs.
