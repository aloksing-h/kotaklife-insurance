# Accessibility Button (accessibility tool)

A floating launcher that opens the **Accessibility tool** panel (Figma "Accessibility pop up", desktop and mobile).

The site adds the tool to every page automatically (`loadAccessibilityTool` in `scripts/scripts.js`). Authors only add this block to a page to change the launcher there.

## Authoring (optional)

- **Accessibility Icon:** the launcher icon. The default is `icons/accessibility-button.svg`.
- **Position:** Left or Right edge of the viewport. The panel opens on the same side.
- **Button Label:** the launcher's accessible name. The default is "Accessibility options".

## What it does

- **Profiles:** each one turns on a group of settings.
  - Color Blind: colour correction for Protanopia, Deuteranopia or Tritanopia, plus Highlight Links.
  - Visually Impaired: Bigger Text 2, High Contrast, Highlight Links, large cursor, Line Height 1.
  - Motor Impaired: strong focus ring, large cursor, Highlight Links, larger inline link targets.
  - Dyslexia Font: OpenDyslexic, Text Spacing 1, Line Height 2, left align.
- **Settings:** each tile cycles through its levels and then off.
  - Contrast (Dark, Light, High)
  - Bigger Text (3 levels)
  - Line Height (3)
  - Text Align (Left, Center, Right)
  - Text Spacing (3; level 3 = the WCAG 1.4.12 values)
  - Highlight Links
  - Cursor
  - Saturation (Low, High, Grayscale)
  - Dyslexia Friendly
- **Profiles and your own choices:**
  - Your own tile choice always wins.
  - Turning a profile on clears your choices only for that profile's settings.
  - Turning it off removes only what it added.
  - Reset all clears everything.
  - Closing the panel keeps the settings.
- **Storage:** settings are saved in `localStorage` (`kotak-a11y`) and re-applied on every page before the first paint.

## Files

| File | Purpose |
|---|---|
| `accessibility-button.js` | Launcher, panel (native `<dialog>`), labels, events, announcements |
| `accessibility-button.css` | Launcher and panel styles |
| `a11y-state.js` | Settings, profiles, state rules, storage, and how settings are applied to the page |
| `a11y-adjustments.css` | The effects on the page. Loaded only when a setting is on; every rule is keyed to a `data-a11y-*` attribute on `<html>` |

## Notes

- Text effects apply inside `header`, `main` and `footer` only; the panel itself never changes size.
- Bigger Text records each text element's original size (`--a11y-fs`) and scales from it. Large headings grow by at most a fixed amount, so fixed-height banners keep their layout.
- Colour filters (contrast, saturation, colour vision) are combined into one `filter` on `<html>`, which doesn't change how fixed elements are positioned. Dark contrast inverts photos and video back to their real colours.
- The colour vision filters are approximations; they help some people more than others.
- An accessibility tool does not make a site WCAG compliant on its own. The site still needs its own accessibility testing.
- The OpenDyslexic font is under the SIL Open Font License (`fonts/OpenDyslexic-OFL.txt`).
