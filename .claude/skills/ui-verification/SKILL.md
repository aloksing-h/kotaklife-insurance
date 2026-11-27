---
name: ui-verification
description: Use before finishing any UI work in kotaklife-insurance (blocks, block styles, pages from Figma or screenshots). Verify every state with Playwright - idle, hover, focus-visible, active/open, selected, disabled - on desktop and mobile (375x812), compare with the Figma spec, run lint, and save evidence (walkthrough.md and screenshots). Playwright only, never Puppeteer.
---

# UI verification (phases 3 and 4)

Run after the CSS is written (`css-layout`) from the spec (`figma-fidelity`), together with
the `accessibility` and `page-performance` checks. `matrix.md` explains the script and the
walkthrough.

## Rules

1. **Playwright only** for automated testing, DOM inspection and visual verification: the
   Playwright browser tools, or `verify-block.mjs` for the full matrix. Never Puppeteer or
   other browser automation libraries. (Lighthouse in `page-performance` is a measurement
   tool, not UI testing.)
2. **Browser:** launch the native Chrome channel first, and fall back to Playwright's bundled
   Chromium when Chrome is not installed (it is not, in this workspace). Say which one ran.

   ```js
   import { chromium } from 'playwright';
   let browser;
   try { browser = await chromium.launch({ channel: 'chrome', headless: true }); }
   catch { browser = await chromium.launch({ headless: true }); }
   ```
3. **One page at a time:** open a page, read it, close it. Every wait gets an explicit
   timeout (about 15 s).
4. **Never finish UI work without the full matrix**, on desktop (1440x900) and mobile
   (375x812).

## Verification matrix

| State | What to check |
|---|---|
| Decoration | wait for `.<block>[data-block-status="loaded"]` |
| Idle | layout, typography, spacing and colours against the spec; hidden-by-default elements hidden; no horizontal page scroll |
| Hover | cards, buttons, tabs, icons: borders, shadows, opacity, colours, elements shown only on hover |
| Focus-visible | Tab into the block (this switches on the site's keyboard focus mode): ring visible and not clipped, elements shown on focus |
| Active / open / selected | click tabs, dropdowns, menus: selected state, caret arrow centred, 4px scrollbar, active item colour (`--info-100`), overlay not clipped or covered (`elementFromPoint` at its centre and corners) |
| Disabled | end-of-list arrows and unavailable controls are really `disabled`, styled as in the spec |
| Mobile 375x812 | touch layout, stacking order, bottom sheets, always-visible mobile controls |

Compare the measured values (computed styles in the results) with `spec.md`: note every
difference over 1px and every colour that does not match, then fix it or explain it.

## Steps

1. Write a small config for the block (URL of the test page, block name, selectors for
   hover, click and open states, the styles to record) and run `verify-block.mjs`
   (`matrix.md`). It saves screenshots, `results.json` and `walkthrough.md` to
   `migration-work/qa/<block>/`.
2. Look at the screenshots of every state, compare with the Figma screenshots of the same
   variants, and fill in the "Compared with the Figma spec" part of `walkthrough.md`.
3. Fix what does not match and run the matrix again.
4. **Phase 4:** `npm run lint` (eslint + stylelint) with 0 errors and 0 warnings.
5. Report in the final message: the browser used, each state's result per viewport, the
   differences found and fixed, lint, and where the walkthrough is. The `migration-work/qa/`
   folder stays local (not committed).
