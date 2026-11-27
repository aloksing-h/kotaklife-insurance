---
name: accessibility
description: Use whenever creating or changing a block, block style or page code (scripts, styles, head.html) in kotaklife-insurance. Write the code to WCAG 2.1 AA (semantic HTML, keyboard, screen reader names, focus, contrast, zoom, motion) and run the accessibility checks in the preview before finishing.
---

# Accessibility (WCAG 2.1 AA)

Follow the rules while writing the code, then run the checks before saying the work is done.
Run `component-reuse` first when a new component is requested; this skill governs how the
code is written. `checks.md` holds the check script and how to read it.

## Rules while coding

1. **Semantic HTML first.**
   - Headings in order: one `h1` per page (usually the first banner), block titles `h2`,
     items inside a block `h3`. Never pick a level for its size; style it with CSS.
   - `ul`/`li` for lists of cards or links, `button` for actions, `a` for navigation.
   - No click handlers on `div` or `span`.
2. **Keyboard.** Everything clickable is reachable with Tab and works with Enter/Space.
   Widgets follow the WAI-ARIA patterns:
   - tabs: `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls`, arrow keys,
     Home/End, only the selected tab in the Tab order (roving `tabindex`);
   - accordion: a `button` with `aria-expanded` and `aria-controls`;
   - carousel or slider: labelled prev/next buttons, no auto-rotation (or a pause button);
   - modal: focus moves in and is trapped, Escape closes, focus returns to the opener.
   No keyboard traps.
3. **Names and state.**
   - Icon-only buttons get `aria-label` ("Next initiatives", not "Next").
   - Toggles expose `aria-expanded` / `aria-selected`; unusable controls are really
     `disabled`. When the focused control becomes disabled, move focus to its sibling.
   - Changes not announced otherwise (paging, filtering, results count) go to a polite live
     region (`<p class="sr-only" aria-live="polite">`).
4. **Images and icons.**
   - Keep the authored alt text; an empty alt means decorative.
   - Decorative icons: `aria-hidden="true"` and `alt=""` (as `decorateIcons` does).
   - Never show information by icon or colour only: write the status, error or state out
     (visually, or with `.sr-only` text such as "Status: ").
5. **Focus.** The site draws the focus ring itself: in keyboard mode (`scripts.js` sets
   `data-keyboard-navigation` on Tab) every link, button, field and `[tabindex]` gets a 2px
   `#005fcc` outline with `!important`, and outside keyboard mode rings are hidden.
   - Rely on that ring; do not remove outlines.
   - Make sure it is not clipped: no `overflow: hidden` right around a focusable element
     without room for the outline.
   - For stretched links (`::after` covering a card) and custom widgets, add a block-level
     `:focus-visible` ring on the part that is visible (2px `--info-500`, offset 2px).
6. **Contrast.** Text at least 4.5:1, large text (24px, or 18.66px bold) at least 3:1;
   icons, meaningful borders and focus rings at least 3:1.
   - Use the tokens: `--gray-600` (#535862) or darker for small text on white.
   - Never use `--gray-400` (#A4A7AE) or lighter for text; it is for disabled icons only.
   - Text on gradients or images: check against the lightest part of the background.
7. **Text, zoom and reflow.**
   - Font sizes in `rem` or the typography tokens, so the browser text size applies.
   - Works at 320px width and at 200% zoom with no horizontal page scroll and no clipped
     text. Long names wrap (`overflow-wrap: anywhere`).
   - No text in images (except logos).
8. **Targets.** Controls at least 24 x 24px; main controls on mobile 32px or more.
9. **Motion.** `prefers-reduced-motion: reduce` turns off transitions, animations and
   smooth scrolling (`behavior: 'auto'`). Nothing flashes more than 3 times a second.
10. **Hidden content.** Use `hidden` (and `display: none` in CSS when the element has its own
    `display`) for content that is truly hidden, `.sr-only` for screen-reader-only text.
    Hidden panels must not leave focusable items in the Tab order.
11. **Forms.** Every field has a visible `label` (or `aria-label`), errors are text linked
    with `aria-describedby`, required fields are marked in text and with `required`.
12. **Universal Editor.** Keep `moveInstrumentation` on rebuilt elements; when an item is
    selected in the editor but hidden (other tab, other page), show it (`aue:ui-select`).

## Checks before finishing

Run these in the preview on a test page with realistic content, at 360px and at 1200px+:

1. **Check script:** run the function in `checks.md` with `SCOPE` set to the block. Fix every
   issue it reports that the change caused. A missing `h1` on a block test page is expected.
2. **Keyboard pass:** Tab through the block, then use the widget keys. Focus order follows
   the visual order, focus is always visible and never lost.
3. **Accessibility tree:** take a page snapshot and read the block: roles, names and states
   make sense (tablist "Financial year", tab "2024 - 23" selected, button "Next ..." disabled).
4. **Reduced motion and zoom:** emulate `prefers-reduced-motion: reduce`; check at 320px
   width (200% zoom equivalent) that nothing is cut off or scrolls sideways.
5. **After pushing to a branch:** the Lighthouse accessibility score from the
   `page-performance` checks; fix failures whose selectors are in the block.

In the final message, report what was checked, what passed and anything left open (for
example issues in site-wide parts such as the header or footer).
