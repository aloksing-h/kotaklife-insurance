---
name: css-layout
description: Use whenever writing or refactoring CSS in kotaklife-insurance (blocks, block styles, global styles). Use Flexbox (display flex) for layouts; use CSS Grid only where Flexbox is genuinely unsuitable, and say why. Mobile-first min-width breakpoints, scoped selectors and tokens, stacking and z-index rules, slim scrollbars and carets, specific transitions.
---

# CSS layout (phase 2: implementation)

Write CSS from the `figma-fidelity` spec, then verify with `ui-verification`.
`patterns.md` has flex recipes for the layouts used on this site and the allowed grid cases.

## 1. Flexbox first

- Always prioritise `display: flex` when authoring or refactoring layouts: rows, columns,
  wrapping card lists, header bars, media + text, centring, equal-height cards.
- CSS Grid (`display: grid`) only where Flexbox is genuinely unsuitable:
  - a true two-dimensional layout whose items must line up in rows **and** columns at once
    (for example a comparison table built from divs);
  - items that overlap in the same area (a stacked hero image and text) where flex would
    need absolute positioning;
  - placement that flex cannot express (dense packing, items spanning several rows);
  - named areas that rearrange between breakpoints in ways `order` and wrapping cannot do.
- When grid is used, add a one-line comment: `/* grid: <reason flex cannot do it> */`.
- When refactoring a block, convert grid to flex where the result is identical; do not
  touch unrelated blocks.

## 2. Mobile first, breakpoints

- Base styles are mobile. Then `@media (width >= 600px)`, `(width >= 900px)`,
  `(width >= 1200px)` only. No `max-width` queries in new code.
- Use the design's own values per viewport from the spec; do not scale desktop down.

## 3. Scope, values and tokens

- Every selector is scoped to the block: `.block-name .block-name-part`. Do not use
  `<block>-container` or `<block>-wrapper` as class names (they belong to sections).
- Values come from the spec. Use the tokens in `styles/variables/` when they match exactly;
  otherwise keep the exact Figma value (hex with alpha, px).
- Block-level custom properties at the top of the block rule (`--block-name-accent: ...`)
  for colours used more than once.

## 4. Stacking context and z-index

- Header and tool bars inside a block: `position: relative; z-index: 10;`.
- Open dropdowns, popovers and dialogs: `position: absolute; z-index: 20;` or higher.
- The wrapper of the item that is open: `z-index: 30;`, so the overlay floats over the
  sections and cards that follow.
- Never let an ancestor clip an overlay: no `overflow: hidden` on its ancestors; use
  `overflow-x: clip` only on the axis that needs it.
- Animations on `transform` or `opacity` create stacking contexts: draw glows with
  `box-shadow`, not with `z-index: -1` pseudo-elements inside an animated element.

## 5. Polished details

- Scrollable menus and popovers get slim scrollbars instead of native ones:
  `scrollbar-width: thin;` plus `::-webkit-scrollbar { width: 4px; }` with a rounded thumb.
- Caret arrows (`::before` on the menu) are centred on their trigger button and layered so
  the menu border runs under them cleanly.
- Active items in menus and lists use `--info-100` (`#D1E9FF`) unless the design says
  otherwise.
- Never `transition: all`. List the properties (`border-color`, `opacity`, `transform`,
  `box-shadow`, `background-color`, `color`) with the design's duration and easing
  (for example `0.2s ease`), and turn them off under `prefers-reduced-motion: reduce`.
- Content hidden with the `hidden` attribute must stay hidden: add
  `.block-name .part[hidden] { display: none; }` when the part sets its own `display`.

## 6. Lint

`npm run lint:css` (stylelint standard config) passes with 0 errors and 0 warnings. Order
rules by specificity (no `no-descending-specificity` errors).
