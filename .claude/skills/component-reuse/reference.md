# Component reuse: how styles are built in this repo

## 1. Style option in the model

Blocks offer looks through the `classes` field, shown to authors as "Style". The value
becomes a class on the block element. Add new options at the end.

```json
{
  "component": "multiselect",
  "name": "classes",
  "label": "Style",
  "options": [
    { "name": "Awards", "value": "awards" },
    { "name": "Initiatives (CSR)", "value": "initiatives" }
  ]
}
```

Use `select` when only one style can apply, `multiselect` when styles combine (for example
`faq-v2` with `faq-search` on the accordion).

## 2. Style code loaded only when used

**JS and CSS module per style** (pattern used by `banner-v2`): the main block decorates the
shared structure, then imports the style module, which loads its own CSS.

```js
// blocks/banner-v2/banner-v2.js (end of decorate)
if (block.classList.contains('error-banner')) {
  const { default: decorateError } = await import('./banner-v2-error.js');
  await decorateError(block);
}
```

```js
// blocks/banner-v2/banner-v2-error.js
import { loadCSS } from '../../scripts/aem.js';

export default async function decorate(block) {
  await loadCSS(`${window.hlx.codeBasePath}/blocks/banner-v2/banner-v2-error.css`);
  // style-only markup and behaviour
}
```

**CSS only per style** (pattern used by `cards`):

```js
if (block.classList.contains('product-benefit-card')) {
  loadCSS(`${window.hlx.codeBasePath}/blocks/cards/product-benefit-card.css`);
}
```

Scope every style rule to the block and the style class, for example
`.banner-v2.block.error-banner .banner-v2-visual { ... }`.

## 3. Content model rules (Universal Editor / xwalk)

- Each model field is one cell, in field order. `image` + `imageAlt` (and `link` +
  `linkText` / `linkTitle`) collapse into one cell.
- Never rename, remove or reorder fields: pages already authored keep their cell order.
- New fields go at the end, optional, with a description naming the style that uses them.
- Items are separate rows; add new item types to the block's filter in `_<block>.json`.
- The `xwalk/max-cells` lint rule allows 4 cells; larger models are listed as exceptions in
  `.eslintrc.js` (for example `'job-listing-item': 7`).
- After any model change: `npm run build:json`, then `npm run lint`.

## 4. Shared design tokens

Use the variables in `styles/variables/` instead of hex values and pixel font sizes:

- colours (`colors.css`): `--brand-red-500` `#FA1432`, `--brand-red-600` `#E1122D`,
  `--brand-blue-500` `#1E4679`, `--gray-200` `#E9EAEB`, `--gray-300` `#D5D7DA`,
  `--gray-600` `#535862`, `--gray-900` `#181D27`, `--red-900` `#7F2224`,
  `--text-primary`, `--text-tertiary`, `--info-500` (focus outlines);
- typography (`fonts.css`): `--heading-1-font-size` / `-line-height` (48/60),
  `--heading-3-*` (32/36), `--body-1-*` (16/20), `--body-2-*` (14/18),
  `--caption-*` (12/14), `--font-weight-light` ... `--font-weight-extrabold`;
- radius: `--radius-md` (8px), `--radius-xl` (16px), `--radius-full`.

Reuse icons in `icons/` (for example `chevron-left.svg`, `chevron-right.svg`, `location.svg`)
before adding new ones.

## 5. Worked example: CSR "Our initiatives" (Figma 12130:9366)

New component: heading, a ruler of financial years with prev/next arrows, and per year a set
of cards (image, category, name, code, status, location).

| Candidate | Content | Behaviour | Layout | Visual | Score |
|---|---|---|---|---|---|
| `timeline` (style `awards`) | 35/40: year items + cards; needs a status field | 30/30: year tabs, arrows, centring | 10/15: card layout differs | 13/15: same ruler, ticks, pill, arrows | **88%** |
| `cards` | 20/40 | 0/30 | 10/15 | 5/15 | 35% |
| `tabs` | 20/40 | 20/30 | 5/15 | 5/15 | 50% |

Result: reuse `timeline` with a new style "Initiatives (CSR)" (`initiatives`):

- reuse: the year ruler, tabs and keyboard handling, prev/next arrows, active-year centring;
- add: an optional `status` select at the end of the card model, the card markup for the
  category, name, code and status/location list, the staggered card layout and paging,
  all gated on `.timeline.initiatives`;
- keep: the `awards` style output unchanged; check it on its test page after the change.

This is how the `our-initiatives-component` branch builds it. The separate `csr-initiatives`
block on the `test` branch is the same design built as a new block (the user asked for a new
block), and is a candidate to merge into the Timeline style in a reuse review.
