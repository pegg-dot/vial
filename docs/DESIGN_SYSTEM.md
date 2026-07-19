# Design System

## Design thesis

VIAL combines the clarity of financial infrastructure with the restraint of premium commerce.

The phrase used during design was **clinical luxury**, but the interface intentionally avoids looking like a clinic. It should feel calm, precise, expensive, and legible.

## Visual references translated into principles

### Stripe influence

- Clear information hierarchy
- Quiet confidence
- Precise data presentation
- Small interactive islands
- Restrained gradients
- Infrastructure visible when useful

### GOAT influence

- Product-first cards
- Strong editorial scale
- Minimal chrome
- Large whitespace
- Premium monochrome surfaces
- Fast comparison behavior

The implementation borrows principles, not copyrighted layouts or assets.

## Tokens

### Color

```text
Background       #F7F7F4
Surface          #FFFFFF
Soft surface     #F0F0EC
Foreground       #111214
Muted text       #6E7078
Hairline         rgba(17,18,20,0.08)
Primary accent   #6D5DFC
Violet accent    #B777FF
Mint accent      #8FFFD6
```

### Evidence colors

- Emerald: stronger confirmation state
- Violet: named evidence or issuer-confirmed record
- Blue: public-document state
- Amber: partial, stale, or review-needed state
- Neutral: unknown or unavailable state

Evidence color never means medically safe.

### Typography

The prototype uses a deterministic system font stack to avoid network-dependent builds.

- Large headlines use tight tracking and bold scale.
- Metadata uses smaller, calmer text.
- Prices and measurements favor tabular numerals.
- Labels use uppercase with generous tracking only at small sizes.

### Shape

- Primary cards: 24 to 36 pixel radius
- Compact controls: full pills or 12 to 16 pixel radius
- Borders: low-contrast one-pixel hairlines
- Shadows: broad and quiet, only on hover or elevated surfaces

### Spacing

The interface uses an eight-point rhythm with intentional exceptions for editorial type.

```text
4, 8, 12, 16, 20, 24, 32, 40, 56, 80, 112
```

## Core components

### Product card

Shows product, quantity, vendor, price, evidence state, freshness, save, and compare controls.

### Product visual

Uses original CSS-generated vial imagery. No external product photography is included.

### Evidence badge

A compact entry point into evidence provenance. Labels are concrete, such as `Issuer confirmed` or `Vendor-published`.

### Evidence matrix

One row per question. States are established, partial, or unknown. Every row includes an interpretation limit.

### Vendor mark

A generated identity block for fictional vendors.

### Search command

A modal search interface with keyboard escape, labeled dialog semantics, and grouped entity results.

### Compare dock

A persistent action surface appears only when records are selected.

## Motion

- Motion communicates state, not decoration.
- Hover lift is less than two pixels.
- Search and navigation transitions are fast.
- Price and evidence state changes should animate subtly in production.
- Reduced-motion preferences disable nonessential animation.

## Responsive behavior

- Core catalog content remains readable at 320 pixels.
- Navigation collapses behind an accessible menu.
- Product detail moves from two columns to one.
- Comparison tables retain horizontal scrolling rather than compressing evidence labels into unreadable columns.
- Touch targets remain at least 40 pixels in the main interaction paths.

## Accessibility

- Strong visible focus state
- Semantic headings and landmarks
- Dialog labeling
- Button labels that express state
- Sufficient color contrast
- No evidence state communicated by color alone
- Reduced-motion support
- Decorative product links removed from the accessibility tree

The saved Lighthouse accessibility audits score 100 on the audited routes.
