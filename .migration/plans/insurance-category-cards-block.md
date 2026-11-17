# Insurance Category Cards: Figma to EDS Block Plan

## Status
**Approved and ready to run.** I'm still in plan mode, so I can't change any project files yet. Switch to **Execute mode** and I'll start with step 1 of the checklist.

## Goal
Build a new **Cards variant** for the insurance category section from the Figma frames (desktop `6068-23349`, mobile `6068-24394`):
- The **heading and CTA** are authored as Rich Text. They get styled by targeting the content next to the Cards block that carries the new variant class.
- The **category cards** reuse the existing Cards component, with a glass effect over the background and alternating pink/blue tints.

## What I found in the project
| Area | Finding |
|---|---|
| Cards block | `blocks/cards/cards.js` turns rows into a `ul/li` list with `.cards-card-image` and `.cards-card-body`. Variant CSS loads on demand (see the `category-info-cards` pattern). |
| Card model | `_cards.json` has a `card` item with **Image** (reference) and **Text** (richtext). The Text field covers the card's text, description and CTA without a model change. |
| Style options | `cards` model has a `classes` multiselect. The new variant gets added here. |
| Tokens | `styles/variables/colors.css` (brand red/blue, gray, …), `styles/variables/fonts.css` (type scale, weights, families), `styles/variables/base.css` (spacing, radius, shadows) |
| CTA block | None exists. The heading and CTA stay as Rich Text, as you asked. |

## Proposed authoring structure
**Section** (no new section class, since section classes are limited)
1. **Rich Text**: Title (H2) and CTA link (authorable)
2. **Cards block**, Style = `Insurance Category Cards` (class `insurance-category-cards`, name to be confirmed against Figma layer names)
   - Card item: **Image** (illustration) and **Text** richtext with Title (H3), Description, and CTA link with an arrow

## Styling approach
- **Block-level class only.** All selectors are scoped to `.cards.insurance-category-cards`. The heading and CTA get styled through `.section:has(.cards.insurance-category-cards) .default-content-wrapper`, so no section class is needed.
- **Variant CSS file:** `blocks/cards/insurance-category-cards.css`, loaded from `cards.js` the same way as `category-info-cards`.
- **Tokens only.** No hard-coded values: colors from `colors.css`, type from `fonts.css`, spacing, radius and shadow from `base.css`. Shared button and link styles from `styles.css` get reused where they exist.
- **Card look:**
  - The background shows through a glass layer: a semi-transparent tint, `backdrop-filter: blur()`, and a thin translucent border.
  - Cards alternate tints with `li:nth-child(odd)` (pink, `--brand-red-25/50`) and `li:nth-child(even)` (blue, `--brand-blue-25/50`).
  - Exact values come from Figma.
- **Responsive, mobile-first** (`min-width` queries only):
  - **280px:** single column, smaller illustration, CTA can wrap, no overflow
  - **360/375px:** two-column grid as in the mobile frame
  - **600–899px:** mobile layout continues, with wider gaps and capped card width so text stays readable
  - **900px+:** desktop layout. The heading and CTA sit in one row and the grid gets the desktop column count.
  - **1024px:** laptop gutters and spacing
  - **1200px:** canonical container width (`max-width: 1200px`), scaling evenly up to 1440px
- **Images:** `object-fit: contain` with an aspect-ratio box, so illustrations don't stretch or cause layout shift.

## Accessibility and SEO
- Heading order: section title is H2, card titles are H3.
- Each card is an `li` inside a `ul`. Each card has one CTA, with an accessible name taken from the card title (for example "Explore Term Insurance") so there are no repeated generic "Know more" links.
- Arrow icons are decorative (`aria-hidden="true"`).
- Visible `:focus-visible` outline using tokens. Touch targets are at least 44×44px.
- Text contrast is AA (4.5:1) over the glass tints. I'll check it against the darkest background area.
- `prefers-reduced-motion` turns off hover transitions. Hover is enhancement only, never the only signal.
- Images get descriptive alt text from the author, `loading="lazy"` and an optimized picture. No extra wrapper elements.

## Order of work in Execute mode
1. **Turn on the Figma add-on.** I create `.agents/settings.json` (it doesn't exist yet) with `{"enabledPlugins": {"excat-figma@excat-extended": true}}`, then pause. You send one more message so the add-on loads.
2. **Pull the Figma data** with the add-on: specs and assets for both frames.
3. **Build:** model, JS and CSS.
4. **Check:** preview at every breakpoint, Figma comparison, accessibility and lint.

## Checklist
- [ ] Create `.agents/settings.json` to turn on the Figma add-on, then pause for your next message so it loads
- [ ] Pull the desktop and mobile frames from Figma: spacing, type styles, colors, glass/blur values, border, radius, the pink/blue pattern, illustrations and arrow icon
- [ ] Map every Figma value to an existing token and list any value that has no token
- [ ] Export the illustrations and the arrow icon, optimized (SVG/WebP), into `icons/` or the author's assets
- [ ] Add the `Insurance Category Cards` option to `blocks/cards/_cards.json` and run `npm run build:json`
- [ ] Load `insurance-category-cards.css` from `blocks/cards/cards.js` when the variant class is present. Add the arrow, CTA accessible names and `aria-hidden` icons without changing the base Cards output.
- [ ] Write mobile-first `blocks/cards/insurance-category-cards.css`: grid, glass effect, alternating pink/blue, heading and CTA row via `:has()`, focus states, reduced motion
- [ ] Create a test page in `drafts/` with sample heading, CTA and 6 cards
- [ ] Check the preview at 280, 360, 375, 768, 1024, 1200 and 1440px: no horizontal scroll, no overlap, no stretched images
- [ ] Compare against the Figma frames at 375px and 1200px, and fix any visual differences
- [ ] Run accessibility checks: heading order, contrast, keyboard tab order, focus visibility, link names
- [ ] Run `npm run lint` (JS, CSS and models) and fix everything until it's clean
- [ ] Summarize the changes, the authoring steps and any token gaps for you

## What I may need from you
- The block/variant name you prefer, if `insurance-category-cards` doesn't match your naming
- Whether the card background image is authored per card or is one shared section background (I'll check Figma first)
- Final CTA labels and URLs, if they differ from the Figma placeholders
