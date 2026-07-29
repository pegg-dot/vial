# Design System

## Current visual language — the "hard" system (Gumroad × AscendBioLabs)

VIAL's whole app uses one hard design system: **thick black borders, hard OFFSET shadows
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
- **Product card** — product, quantity, vendor, price, evidence state, freshness, save/compare.
- **Product visual** — original CSS-generated vial imagery (the one place gradients are allowed:
  they are the illustration, not chrome). No external product photography.
- **Evidence badge / matrix** — concrete labels (`Issuer confirmed`, `Vendor-published`); one
  row per question, states established / partial / unknown, each with its interpretation limit.
- **Data-origin badge** — Demo vs Live (records are demo unless marked Live).
- **Vendor mark** — flat-fill + ink-border identity block (no gradient).
- **Search command** — labeled modal, keyboard-escapable, grouped entity results.
- **Compare dock** — persistent action bar, appears only when records are selected.
- **Trust chip / VIAL verdict** — composed cross-seam verdict; never a single black-box score.

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
  read PNG; internal pages need a demo login: `VialDemo{Customer,Seller,Laboratory,Admin}!2026`).
- Never run `npm run build` while `next dev` is up (it deletes `.next`); never touch
  `.data/pglite` while dev runs.
