# VialGrade brand assets

Everything here is generated from the three SVG sources by `node scripts/render-brand.mjs`.
Edit the SVG, re-run the script, never hand-edit a PNG.

## Files

| File | Use it for |
|---|---|
| `vialgrade-icon.svg` | **The primary mark.** Scalable, use this wherever you can. |
| `vialgrade-icon-{1024,512,256,128,64,32}.png` | App icons, favicons, avatars, anywhere a PNG is required. Transparent outside the rounded square. |
| `vialgrade-v-mark.svg` | Just the V, no container, transparent. Inherits `currentColor`. |
| `vialgrade-v-mark-{white,black}-{1024,512}.png` | The bare V for placing over a solid colour. |
| `vialgrade-wordmark.svg` | Mark + "VialGrade" lockup, horizontal. |
| `vialgrade-wordmark-{2100,1050}.png` | The lockup as a PNG. |

## Colours

| Role | Hex |
|---|---|
| Ink (base, wordmark text) | `#111214` |
| Violet (top-right glow) | `#6d5dfc` |
| Mint (bottom-left glow) | `#8fffd6` |
| Mark counterform | `#ffffff` |

The gradient is a near-black ground with a violet radial lifting the top-right corner and a mint
radial lifting the bottom-left. The centre stays near-black — that contrast is what keeps the V
readable at 32px.

## Rules

- Keep clear space around the mark of at least **25% of its height** on all sides.
- Don't recolour the V. It is white on the container, or `#111214` on light ground via `v-mark-black`.
- Don't add a drop shadow, outline, or bevel to the container — it already carries its own depth.
- Don't stretch. Scale proportionally only.
- On a dark background use `vialgrade-v-mark-white`; the container mark works on either.

## A note on the wordmark SVG

The wordmark uses **live text** (Inter, falling back to Helvetica Neue / Arial), so it will render
slightly differently on a machine without Inter installed. If you're sending it to someone for
placement, send `vialgrade-wordmark-2100.png` alongside it — that's font-independent.
