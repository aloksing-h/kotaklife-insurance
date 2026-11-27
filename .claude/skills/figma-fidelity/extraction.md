# Figma extraction: tool calls and mappings

The Figma tools come from the Figma plugin (keep it enabled). The node ID in a URL
`...?node-id=12130-9366` is `12130:9366`; the file key is the path part after `/design/`.

## 1. Tool call order

1. **Frame tree:** `get_metadata` (`nodeId`, `fileKey`, `maxDepth: 2` or `3`). Lists child
   frames, instances, positions and sizes. Use it to find parts, the mobile frame and the
   instance IDs (`I<instance>;<node>` IDs are nodes inside an instance).
2. **Hidden content and variants:** `get_metadata` with `includeHidden: true` on the
   instance's parent and on the component set page or frame. Hidden nodes are tagged
   `hidden="true"`: these are carousel slides, tab panels and other states.
3. **Component set:**
   - `get_design_context` on an instance names the component it uses; `get_metadata` on the
     component's page or section (depth 2-4) shows the `COMPONENT_SET` with one child per
     variant, named like `Property 1=Hover, Size=Large`.
   - When the set is in a library file that cannot be opened, ask for a link to the
     component set (a URL with its node ID).
   - Code Connect and desktop file mode tools (`get_context_for_code_connect`, `use_figma`)
     are not available here; use the metadata route above.
4. **Exact styles:** `get_design_context` on every variant node and on each frame. Large
   nodes are saved to a file: read it fully in chunks. The output is React + Tailwind: read
   the values, do not copy the code.
5. **Tokens:** `get_variable_defs` on the node, for the named colours and type styles.
6. **Visual reference:** `get_screenshot` per frame and per variant.
7. **Assets:** the asset URLs in the design context expire after about 14 days. Download
   icons and images early, into a new folder outside the repo, then optimise (SVG for icons,
   WebP at the shown size for images).

## 2. Figma property -> CSS

| Figma | CSS |
|---|---|
| `layoutMode: HORIZONTAL / VERTICAL` | `display: flex; flex-direction: row / column` |
| `itemSpacing` | `gap` |
| `paddingTop/Right/Bottom/Left` | `padding` (keep each value) |
| `primaryAxisAlignItems` / `counterAxisAlignItems` | `justify-content` / `align-items` |
| sizing Fixed / Hug / Fill | fixed `width`/`height` / `fit-content` / `flex: 1 1 0` |
| `cornerRadius` / per corner | `border-radius` |
| stroke (inside, 1px) | `border: 1px solid` (outside strokes: `outline` or `box-shadow`) |
| drop shadow x, y, blur, spread, colour | `box-shadow: x y blur spread rgba()` |
| linear gradient angle and stops | `linear-gradient(<angle>deg, color stop%, ...)` (Figma and CSS angles can differ: check against the screenshot) |
| text auto-height, line height px | `line-height` in px or the token |
| letter spacing % | `letter-spacing: <value / 100>em` |

## 3. Values -> site tokens (`styles/variables/`)

Use the token only when the value matches exactly; otherwise keep the exact Figma value.

- Colours: `#181D27` `--gray-900`, `#535862` `--gray-600`, `#717680` `--gray-500`,
  `#D5D7DA` `--gray-300`, `#E9EAEB` `--gray-200`, `#F5F5F5` `--gray-100`, `#FA1432`
  `--brand-red-500`, `#E1122D` `--brand-red-600`, `#FED0D6` `--brand-red-50`, `#7F2224`
  `--red-900`, `#1E4679` `--brand-blue-500`, `#D1E9FF` `--info-100`, `#84CAFF` `--info-300`,
  `#2E90FA` `--info-500`.
- Type: 48/60 `--heading-1-*`, 40/48 `--heading-2-*`, 32/36 `--heading-3-*`, 24/28
  `--heading-4-*`, 16/20 `--body-1-*`, 14/18 `--body-2-*`, 12/14 `--caption-*`; weights
  `--font-weight-light` (300) to `--font-weight-extrabold` (800). Font: Manrope.
- Radius: 4 `--radius-xs`, 6 `--radius-sm`, 8 `--radius-md`, 12 `--radius-lg`, 16
  `--radius-xl`, 20 `--radius-2xl`, 9999 `--radius-full`.

## 4. Spec table format (`migration-work/qa/<block>/spec.md`)

```markdown
## Card (node I12130:9371;3769:7637)
| Property | Default (desktop) | Hover (desktop) | Default (mobile) | Source |
|---|---|---|---|---|
| size | 423 x 182 | same | 343 x auto | 12130:9371 / mobile 12130:9452 |
| border | 1px #E9EAEB (--gray-200) | 1px #E9EAEB | same | design context |
| shadow | 0 1px 12px rgb(0 0 0 / 6%) | ... | same | design context |
| padding | 16 right, 0 left | same | 12 right | design context |
```

## 5. Worked example: "Our initiatives" (node 12130:9366)

- `get_metadata` depth 3: header (heading 352x60, slider 734x55, arrows 50x24), cards frame
  with 5 card instances (423 x 182) in two rows (x 0 / 471 / 942, then x 230 / 701, row gap
  48), bottom arrows 72 x 32.
- `get_metadata` on one card (`I12130:9371;3769:7637`): visual 178 x 160 at the bottom-left,
  content column 213 wide at x +194, badge 81 x 24 at the top, list at the bottom.
- `get_design_context`: heading Manrope 300 48/60 `#181D27`; inactive year 500 14/18 `#666`;
  active year pill gradient `-36deg #E1122D 0%, #E1122D 59%, #7F2224 100%`, border
  `#FED0D6`; card border `#E9EAEB`, radius 8, shadow `0 1px 12px rgba(0,0,0,0.06)`, glow
  `radial-gradient(#D1E9FF, #84CAFF)`; ticks `#D5D7DA`, active ticks `#FA1432`.
- The card "Button" instances have Hover and Disabled variants in their component set:
  extract those too rather than guessing the hover colour.
