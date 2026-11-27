# Flex recipes and allowed grid cases

All selectors are examples; scope them to the block.

## Header bar: title left, actions right, wraps on mobile

```css
.block .block-header { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 12px; }
.block .block-title { flex: 1 1 0; min-width: 0; margin: 0; }
.block .block-actions { display: flex; gap: 8px; margin-left: auto; }
```

## Wrapping card list with equal-height cards

```css
.block .block-cards { display: flex; flex-wrap: wrap; gap: 24px; margin: 0; padding: 0; list-style: none; }
.block .block-card { display: flex; flex-direction: column; flex: 1 1 100%; }

@media (width >= 600px) { .block .block-card { flex-basis: calc((100% - 24px) / 2); flex-grow: 0; } }
@media (width >= 900px) { .block .block-card { flex-basis: calc((100% - 2 * 24px) / 3); } }

.block .block-card-body { display: flex; flex: 1 1 auto; flex-direction: column; }
.block .block-card-cta { margin-top: auto; } /* pins the CTA to the bottom */
```

## Staggered rows (3 + 2, second row offset)

```css
@media (width >= 1200px) {
  .block .block-cards { flex-flow: row wrap; gap: 48px; width: calc(3 * 423px + 2 * 48px); }
  .block .block-card { flex: 0 0 423px; }
  .block .block-card-offset { margin-left: 230px; } /* JS marks the first card of row 2 */
}
```

## Media + text side by side, stacked on mobile

```css
.block .block-item { display: flex; flex-direction: column; gap: 16px; }

@media (width >= 900px) {
  .block .block-item { flex-direction: row; align-items: center; gap: 48px; }
  .block .block-media { flex: 0 0 45%; }
  .block .block-text { flex: 1 1 0; min-width: 0; }
  .block .block-item-reverse { flex-direction: row-reverse; }
}
```

## Pill / tag list

```css
.block .block-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.block .block-tag { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: var(--radius-full); }
```

## Horizontal scroller (years, chips) with hidden scrollbar

```css
.block .block-scroller { display: flex; gap: 40px; overflow: auto hidden; scrollbar-width: none; }
.block .block-scroller::-webkit-scrollbar { display: none; }
.block .block-scroller > * { flex: 0 0 auto; }
```

## Dropdown with caret and slim scrollbar

```css
.block .block-filter { position: relative; z-index: 10; }
.block .block-filter.is-open { z-index: 30; }
.block .block-menu {
  position: absolute; top: calc(100% + 10px); left: 50%; z-index: 20;
  max-height: 280px; overflow-y: auto; transform: translateX(-50%);
  scrollbar-width: thin; scrollbar-color: var(--gray-300) transparent;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.block .block-menu::-webkit-scrollbar { width: 4px; }
.block .block-menu::-webkit-scrollbar-thumb { border-radius: 4px; background: var(--gray-300); }
.block .block-menu::before { /* caret centred on the trigger */
  content: ''; position: absolute; top: -6px; left: 50%; width: 12px; height: 12px;
  transform: translateX(-50%) rotate(45deg); background: inherit;
  border-top: 1px solid var(--gray-200); border-left: 1px solid var(--gray-200);
}
.block .block-menu [aria-selected='true'] { background: var(--info-100); }
```

Note: a menu that scrolls clips its own `::before` caret; put the caret on the trigger
wrapper (or a non-scrolling menu frame) when the menu itself scrolls.

## Allowed grid cases (with the comment)

```css
/* grid: plan comparison, cells must align in rows and columns at once */
.block .block-compare { display: grid; grid-template-columns: 200px repeat(3, 1fr); }

/* grid: image and text overlap in the same area */
.block .block-hero { display: grid; }
.block .block-hero > * { grid-area: 1 / 1; }
```
