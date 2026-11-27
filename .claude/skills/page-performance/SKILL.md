---
name: page-performance
description: Use whenever creating or changing a block, block style or page code (scripts, styles, head.html, fonts) in kotaklife-insurance. Keep pages at Lighthouse 100 on mobile (LCP < 2.5s, CLS < 0.1, INP < 200ms): follow the Edge Delivery loading phases, keep JS, CSS and images small, and measure in the preview and on the branch preview before finishing.
---

# Page performance (Lighthouse 100)

Follow the rules while writing the code, then measure before saying the work is done.
`checks.md` holds the measurement script, the budgets, and the PageSpeed and Lighthouse
commands.

## How this site loads (keep it this way)

- **Eager** (`loadEager` in `scripts/scripts.js`): the first section, waiting for its first
  image (LCP). `head.html` preloads only Manrope Light and Regular.
- **Lazy** (`loadLazy`): the other sections and blocks, header, footer,
  `styles/lazy-styles.css` and the remaining fonts.
- **Delayed** (`loadDelayed`): `scripts/delayed.js`, 3 s after load, for martech, chat and
  third-party scripts.

## Rules while coding

1. **Respect the phases.** Never add work to the eager phase for content below the fold.
   Third-party scripts go in `delayed.js`, or load on interaction or when visible.
2. **No libraries unless unavoidable.** Prefer plain JS and CSS (scroll-snap, `details`,
   transitions). If a library is needed (date picker, chart), load it only in the block
   that uses it, and only when that block is on the page.
3. **Split by style.** Style-specific CSS and JS live in `<block>-<style>.*` files loaded
   only for that style (see `component-reuse`).
4. **Images.**
   - Authored images go through `createOptimizedPicture` with a width close to the shown
     size (2x is enough: a 178px card image uses `width: '400'`).
   - Lazy by default; **eager for the LCP image**: if the block can be the first section,
     make its first visible image eager (`loading="eager"`, `fetchpriority="high"`).
   - Give images `width` and `height` attributes (or a fixed `aspect-ratio` box) so
     Lighthouse sees them as sized and nothing shifts.
   - Images committed to git: compressed WebP (or SVG for icons) at the shown size, under
     the budgets in `checks.md`.
5. **No layout shift.** Reserve space for content built by JS (fixed height,
   `aspect-ratio`, `min-height`); never insert content above what is already visible
   after load; keep the fonts and their fallbacks as they are.
6. **Lean JS (and good INP).**
   - No work at import time; build the DOM in one pass and replace the block's children once.
   - Delegate events on the block; no `scroll` or `resize` listeners: use
     `IntersectionObserver`, `ResizeObserver` or `matchMedia(...).addEventListener('change')`.
   - Keep each click or key handler small; avoid layout reads right after writes in loops.
   - Content in hidden tabs or pages: keep it in the DOM but `hidden`, so lazy images in it
     do not load until shown.
7. **Lean CSS.** Scope rules to the block, no global resets; effects with gradients and
   `box-shadow` instead of images; avoid large or many `filter: blur()`; animate only
   `transform` and `opacity`.
8. **Fonts and icons.** No new web fonts or weights without need (Manrope is set up in
   `styles/fonts.css` and `styles/variables/fonts.css`). Icons are small SVGs in `icons/`
   via `decorateIcons`; reuse existing ones; no icon fonts.
9. **Embeds.** Videos, maps and iframes load on interaction or when visible, with a
   poster image of the right size.

## Checks before finishing

1. **Preview measurement:** open the test page fresh and run the function in `checks.md`
   with `BLOCK` set, at 360 x 800 and 1440 x 900. Check:
   - CLS under 0.1 (aim for 0), no long tasks over 50 ms from the block, on load or on
     clicks;
   - block JS and CSS within budget, image sizes within budget;
   - `loadedOffscreenOrHidden` is empty (hidden tabs and pages load nothing);
   - no console errors from the block.
2. **After pushing to a branch:** run PageSpeed (mobile) on
   `https://<branch>--kotaklife-insurance--aloksing-h.aem.page/<page>`; when PageSpeed has
   no quota, run Lighthouse here (`checks.md`, section 4). The page must have been previewed
   from the author.
   - Target performance 100, LCP under 2.5 s, CLS under 0.1, TBT near 0.
   - Fix findings whose element or selector is in the block (lazy LCP image, unsized
     images, oversized images, long tasks). Report site-wide ones (header, breadcrumb,
     fonts, render-blocking `styles.css`) without changing them.
   - Unminified CSS/JS findings are expected (Edge Delivery serves files as committed and
     compresses them); keep files lean rather than minifying them.

In the final message, report the numbers: LCP, CLS, TBT or long tasks, block JS/CSS size,
image sizes, and the Lighthouse or PageSpeed scores, plus anything left open.
