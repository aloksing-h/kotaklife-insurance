---
name: component-reuse
description: Before creating any new block or component in kotaklife-insurance (from Figma, a screenshot, a URL or a description), check the existing blocks and their styles for one that fits, and reuse it with a new style when it is at least 80% similar. Also use when asked to review blocks or pages for reuse, duplicates, or components that could be merged.
---

# Component reuse

Prefer extending an existing block over adding a new one. Every new block is more code to
load, test and maintain, and one more thing for authors to learn in Universal Editor.

Run **Part A** before writing any block code. Use **Part C** to reuse safely. Run **Part B**
only when the user asks for a review. See `reference.md` for how styles are built in this
repo, with examples.

If the user explicitly asks for a *new* block, still run Part A and tell them about any close
match (block, score, main differences), but follow their instruction.

## Part A: check before building

1. **Describe the new component** in neutral terms (not the page it is on):
   - content: fields and repeated items (for example "heading, then years, each with cards:
     image, category, name, code, status, location, optional link");
   - behaviour: static, tabs, slider or carousel, accordion, paging, filters, form;
   - layout: columns, stacked, staggered, grid of cards, split media and text;
   - visual pieces: pills or badges, year ruler, arrows, icon rows, stats, CTA buttons.
2. **Build an inventory** of `blocks/`. For every block read:
   - `_<block>.json`: models, item types, filters and the `classes` style options;
   - the header comment and the `decorate` logic of `<block>.js`;
   - style files next to it (`<block>-<style>.js`, `<style>.css`) and `README.md` if present.
3. **Shortlist candidates** by purpose (cards, tabs, timeline, carousel or swiper, banner,
   plan cards, impact cards, accordion, columns, ...). Do not stop at the first name match.
4. **Score each candidate** from 0 to 100%:

   | Criterion | Weight | Full marks when |
   |---|---|---|
   | Content model | 40% | Same fields and items, or new fields can be added at the end |
   | Behaviour | 30% | Same interaction (tabs, paging, slider, ...) |
   | Layout | 15% | Same structure, or reachable with style CSS only |
   | Visual pieces | 15% | Same parts (ruler, arrows, pills, icon rows, ...) |

5. **80% or more: reuse automatically.** Extend the best candidate with Part C, without
   asking first, unless Part C says reuse would break existing content.
6. **Under 80%: build a new block.** Still reuse shared pieces: icons in `icons/`, design
   tokens in `styles/variables/`, helpers in `scripts/`, and code patterns (tabs keyboard
   handling, arrow buttons) from the closest block.
7. **Report** in one short paragraph, before the code work: the block reused (or that none
   fitted), the score, the main differences and what will be added.

## Part C: reuse without breaking existing pages

- **New look = new style.** Add an option to the block's `classes` field ("Style") in
  `_<block>.json`. Use a clear name (for example "Initiatives (CSR)", value `initiatives`).
- **Style code in its own files.** Put the style's CSS and JS in `<block>-<style>.css` and
  `<block>-<style>.js`, loaded only when the class is present (dynamic `import()` or
  `loadCSS`). Pages without the style load nothing extra.
- **Content model rules:**
  - never rename, remove or reorder existing fields or item types;
  - add new fields at the end of a model, optional, with a description that says which
    style uses them;
  - add new item types to the block's filter instead of changing existing ones.
- **Default output stays identical.** Gate every behaviour or markup change on the new class.
- **Keep the block's contract.** Authored rows and cells must still be read the same way for
  the existing styles.
- **Verify before finishing:**
  - existing styles of the block still render the same in the preview (use its test pages,
    `drafts/` pages or a quick sample);
  - `npm run build:json` after model changes, then `npm run lint`;
  - if the new style needs more cells than the 4-cell rule allows, add the model to the
    `xwalk/max-cells` exceptions in `.eslintrc.js`, as other blocks do.
- **Build a new block instead (and say why) when reuse would break content**, for example:
  - the cells would have to be reordered or reinterpreted;
  - the block is used on many pages or in installed content packages and the change is risky;
  - the block would need a second, unrelated behaviour that makes it hard to author.

## Part B: review for reuse (only when asked)

1. Scan the scope the user names: one block, one page or all blocks.
2. Look for:
   - blocks with similar models or behaviour (two card blocks, two year rulers, two tab sets);
   - copied CSS (identical rules, repeated pills, arrows, tick lines, card shadows);
   - repeated helper code (arrow buttons, tabs keyboard handling, icon token parsing,
     picture optimisation);
   - near-identical style options across different blocks;
   - hex colours or font sizes that should be design tokens.
3. Report each finding with:
   - what is duplicated, with file and line references;
   - the recommendation: make it a style of block X, move a helper into `scripts/`, use a
     token, or keep it separate (and why);
   - the risk: which pages, drafts or content packages use the affected blocks.
4. Rank findings by value (most code removed, least risk first).
5. **Do not change code in review mode** unless the user asks for a specific change.
