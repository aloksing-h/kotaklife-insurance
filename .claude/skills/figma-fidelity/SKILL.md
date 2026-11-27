---
name: figma-fidelity
description: Use whenever UI is built or changed from a Figma URL, node ID, design image or screenshot in kotaklife-insurance. Extract exact values (geometry, typography, colours, gradients, shadows) and every variant state from the parent component set, for desktop and mobile, before writing CSS. Never guess values.
---

# Figma fidelity (phase 1: exhaustive spec extraction)

Extract first, write CSS second (`css-layout`), verify last (`ui-verification`).
`extraction.md` lists the exact tool calls and how Figma values map to CSS and tokens.

## Invariants

1. **Zero guesswork.** Never estimate or approximate pixel values, font sizes, colours,
   padding or effects when a Figma node or image provides them. If a value is missing, use a
   design token from `styles/variables/`; if there is none, ask. Never invent one. Record
   where every value came from (node ID, token, or "asked").
2. **Never stop at the rendered instance.** Instances on page frames show one static state
   (usually Default). Interactive states (Hover, Focus, Active, Open/Dropdown, Selected,
   Disabled) live in the parent `COMPONENT_SET`. For every component or instance you inspect,
   resolve its parent component set and extract the full variant matrix before writing CSS.
3. **Both viewports.** Always find and inspect the desktop frame and the mobile frame. Never
   assume mobile is a proportional scale of desktop: record each viewport's own fixed
   values, paddings and stacking order (for example mobile heights 86 / 130 / 178px vs.
   desktop 77 / 148 / 227px).

## What to extract (every part, every state, both viewports)

- **Geometry and layout:** width, height, min/max width and height, auto-layout direction
  (`layoutMode` -> flex direction), `itemSpacing` (gap), each padding (top, right, bottom,
  left), corner radius (or each corner), alignment and sizing (fixed, hug, fill).
- **Typography:** font family, numeric font weight (400, 500, 600, 700, 800), font size, line
  height, letter spacing, text case and decoration.
- **Colours and effects:** hex with alpha; gradient type, angle, stops and percentages;
  every shadow (x, y, blur, spread, RGBA); border colour, width, style and border gradients;
  overlays and blend opacity.
- **Interaction:** elements that appear only on interaction (an icon shown on card hover or
  focus), transitions (duration such as 0.2s, easing, animated properties), and
  sub-components: dropdown menus, caret pointers, modal backdrops, tooltips, badges.

## Steps

1. Get the node: `get_metadata` on the URL's node (depth 2-3) to see the frame tree; find
   the mobile frame (same page, often named "- M" or "Mobile") as well as the desktop one.
2. For every component instance: find its main component and parent `COMPONENT_SET`, then
   list all variants with `get_metadata` and `includeHidden: true` (see `extraction.md`).
3. `get_design_context` on each variant node (Default, Hover, Open, ...) and on each frame;
   `get_variable_defs` for the tokens the design uses; `get_screenshot` for a visual
   reference of each state.
4. **Reading images and screenshots** (when there is no node, or to cross-check):
   - look for Figma inspect overlays, Dev Mode sidebars and tooltips that show exact CSS,
     gradient stops, padding or token names, and use those values;
   - measure at 1:1 scale and do not round to "round numbers";
   - tell vector circles (`border-radius: 50%`) from rounded rectangles;
   - make secondary attributes (dashed lines, indicators, border gradients) match the active
     and hover marker colours consistently.
5. **Write the spec** to `migration-work/qa/<block>/spec.md` (local, not committed): one table
   per part with a row per state and columns for desktop and mobile values, each value with
   its source. Map values to tokens where they match exactly (`extraction.md`, section 3).
6. Only then write the CSS, from the spec.

If something cannot be extracted (asset links expired, node not found, a state missing in
Figma), say so and ask instead of filling the gap.
