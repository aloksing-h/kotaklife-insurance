# Running the verification matrix

`verify-block.mjs` (next to this file) runs the whole matrix for one block with Playwright:
desktop 1440x900 and mobile 375x812, idle, hover, focus-visible (Tab), clicks, open
overlays (hit test with `elementFromPoint`), disabled controls and console errors. It saves
one screenshot per state, `results.json` and a `walkthrough.md`.

## 1. Set up (once per workspace) outside the repo

Playwright is not a project dependency. Install it in a scratch folder, using the browsers
the workspace already has:

```bash
mkdir -p /tmp/ui-verify && cd /tmp/ui-verify
[ -f package.json ] || echo '{"type":"module","private":true}' > package.json
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-audit --no-fund --prefer-offline playwright@1.65.0
```

Use the Playwright version that matches the installed browsers (`ls /ms-playwright`:
`chromium-1254` goes with 1.65).

## 2. Config for the block

```json
{
  "url": "http://localhost:3000/content/csr-initiatives-test",
  "block": "csr-initiatives",
  "out": "/backups/aloksing-h/kotaklife-insurance/repo/migration-work/qa/csr-initiatives",
  "styles": {
    ".csr-initiatives-title": ["font-size", "line-height", "font-weight", "color"],
    ".csr-initiatives-panel:not([hidden]) .csr-initiatives-card": ["border-radius", "border-color", "box-shadow"]
  },
  "hover": [".csr-initiatives-card-linked", ".csr-initiatives-arrow-large:not(:disabled)",
    ".csr-initiatives-year[aria-selected='false']"],
  "click": [{ "trigger": ".csr-initiatives-year:nth-child(3)", "expect": "#csr-initiatives-1-panel-2" }],
  "open": []
}
```

- `styles`: the values to compare with `spec.md` (idle state).
- `hover`: the first visible match is hovered; the check passes when the element or one of
  its first children changes style (colour, background, border, shadow, opacity, transform).
- `click`: clicks `trigger`, then expects `expect` to be visible (tabs, accordions, pagers).
- `open`: `{ "trigger": ".filter-button", "overlay": ".filter-menu", "close": "Escape" }`
  clicks the trigger and checks the overlay is visible and not covered at its centre and
  corners; records its `z-index` and `scrollbar-width`.
- `viewports` (optional) replaces the default desktop and mobile sizes.

## 3. Run

```bash
cd /tmp/ui-verify
cp /backups/aloksing-h/kotaklife-insurance/repo/.claude/skills/ui-verification/verify-block.mjs .
PLAYWRIGHT_BROWSERS_PATH=/ms-playwright timeout 280 node verify-block.mjs <block>.json
```

The script prints the browser used, the states to check, and the walkthrough path. Run the
copy from `/tmp/ui-verify` so `playwright` resolves.

## 4. Read and finish the walkthrough

`walkthrough.md` has a table per viewport (state, pass or **check**, details, screenshot).

- **check** on hover: the hover style may be on a parent or a later child; confirm on the
  screenshot, or point `hover` at the element that changes.
- **check** on focus-visible: no ring found on the element, its `::after` or its children:
  the ring is missing or clipped.
- **check** on open: `coveredPoints` above 0 means another element sits on top of the
  overlay (z-index or clipping problem).
- Console errors from site-wide parts (header, footer, favicon) on local test pages are
  expected and listed but do not fail the block.

Then fill in "Compared with the Figma spec": the key values per state against `spec.md`,
the differences over 1px or in colour, what was fixed, and open items.

Example run (CSR Initiatives test page, 27 Nov 2026, bundled Chromium): all checks passed
on desktop and mobile (heading 48/60 Light desktop and 32/36 mobile, card hover shadow
change, arrow hover `#E1122D` -> `#C81028`, year hover label colour, focus ring
`2px #005fcc`, tab click shows its panel, end arrows disabled).
