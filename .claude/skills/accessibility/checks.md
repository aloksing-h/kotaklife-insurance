# Accessibility checks (preview)

Open the test page in the preview, wait for the blocks to load, then run the function below
with the browser evaluate tool. Set `SCOPE` to the block selector (for example
`'.csr-initiatives'`) or `'main'` for the whole page. Run it at 360px and at 1200px or more.

```js
async () => {
  const SCOPE = 'main';
  await new Promise((r) => { setTimeout(r, 1500); });
  const root = document.querySelector(SCOPE) || document.body;
  const issues = [];
  const add = (type, el, detail = '') => {
    const id = el.id ? `#${el.id}` : '';
    const cls = el.classList?.length ? `.${[...el.classList].slice(0, 2).join('.')}` : '';
    issues.push(`${type}: <${el.tagName.toLowerCase()}${id}${cls}> ${detail}`.trim());
  };
  const visible = (el) => !el.closest('[hidden], [aria-hidden="true"]')
    && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const name = (el) => (el.getAttribute('aria-label')
    || (el.getAttribute('aria-labelledby') || '').split(' ')
      .map((i) => document.getElementById(i)?.textContent || '').join(' ')
    || el.textContent || el.querySelector('img')?.alt || el.title || '').trim();

  // 1. images: alt attribute present (empty is fine for decorative images)
  root.querySelectorAll('img:not([alt])').forEach((img) => add('img-no-alt', img, img.src.split('/').pop()));

  // 2. buttons and links have an accessible name
  root.querySelectorAll('a[href], button, [role="button"], [role="tab"]').forEach((el) => {
    if (visible(el) && !name(el)) add('no-name', el);
  });

  // 3. heading levels are not skipped
  let last = 0;
  [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')]
    .filter(visible).forEach((h) => {
      const level = Number(h.tagName[1]);
      if (last && level > last + 1) add('heading-skip', h, `h${last} -> h${level} "${h.textContent.trim().slice(0, 40)}"`);
      last = level;
    });
  if (document.querySelectorAll('main h1').length !== 1) issues.push(`h1-count: ${document.querySelectorAll('main h1').length} (expected 1 on a page)`);

  // 4. duplicate ids and broken ARIA references
  const ids = {};
  document.querySelectorAll('[id]').forEach((el) => { ids[el.id] = (ids[el.id] || 0) + 1; });
  Object.entries(ids).filter(([, n]) => n > 1).forEach(([id, n]) => issues.push(`duplicate-id: #${id} x${n}`));
  root.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby]').forEach((el) => {
    ['aria-controls', 'aria-labelledby', 'aria-describedby'].forEach((attr) => {
      (el.getAttribute(attr) || '').split(' ').filter(Boolean).forEach((ref) => {
        if (!document.getElementById(ref)) add('broken-aria-ref', el, `${attr}="${ref}"`);
      });
    });
  });

  // 5. text contrast against the nearest solid background (AA: 4.5, large text 3)
  const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const background = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage !== 'none') return null; // gradient or image: check by eye
      const c = rgb(s.backgroundColor);
      if (c.length === 3 || (c.length === 4 && c[3] === 1)) return c.slice(0, 3);
    }
    return [255, 255, 255];
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement;
    if (el && walker.currentNode.textContent.trim() && !seen.has(el) && visible(el) && !el.closest('.sr-only')) {
      seen.add(el);
      const s = getComputedStyle(el);
      const bg = background(el);
      const fg = rgb(s.color);
      if (bg && (fg.length === 3 || fg[3] === 1)) {
        const [a, b] = [lum(fg.slice(0, 3)), lum(bg)].sort((x, y) => y - x);
        const ratio = (a + 0.05) / (b + 0.05);
        const size = parseFloat(s.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
        if (ratio < (large ? 3 : 4.5)) add('contrast', el, `${ratio.toFixed(2)}:1 "${el.textContent.trim().slice(0, 30)}"`);
      }
    }
  }

  // 6. focusable targets: at least 24 x 24 px, not inside hidden content
  const focusable = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  root.querySelectorAll(focusable).forEach((el) => {
    if (el.closest('[hidden], [aria-hidden="true"]') && el.getClientRects().length) add('focusable-in-hidden', el);
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    const inline = getComputedStyle(el).display === 'inline' && el.closest('p, li');
    if (!inline && (r.width < 24 || r.height < 24)) add('small-target', el, `${Math.round(r.width)}x${Math.round(r.height)}`);
  });

  // 7. focus is visible: focus each control and compare outline / box-shadow.
  // The site shows focus rings only in keyboard mode (set by scripts.js on Tab): switch it on.
  document.documentElement.setAttribute('data-keyboard-navigation', '');
  const focusIssues = [];
  [...root.querySelectorAll(focusable)].filter(visible).slice(0, 40).forEach((el) => {
    el.focus({ preventScroll: true });
    const ring = (s) => (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
    // the ring may be drawn on the element, its ::after (stretched links) or a child (tab label)
    const shown = el.matches(':focus-visible') === false || ring(getComputedStyle(el))
      || ring(getComputedStyle(el, '::after'))
      || [...el.querySelectorAll('*')].some((child) => ring(getComputedStyle(child)));
    if (!shown) focusIssues.push(el);
  });
  document.activeElement?.blur();
  document.documentElement.removeAttribute('data-keyboard-navigation');
  focusIssues.forEach((el) => add('no-focus-style', el));

  return { scope: SCOPE, issues: issues.length ? issues : ['no issues found'] };
}
```

## Reading the results

| Result | What it means | Usual fix |
|---|---|---|
| `img-no-alt` | An image has no `alt` attribute | Keep the authored alt; decorative images and icons get `alt=""` |
| `no-name` | A button, link or tab has no accessible name | Visible text, or `aria-label` on icon-only buttons |
| `heading-skip` | A heading level is skipped (h2 to h4) | Use the next level; style with CSS, not with the level |
| `h1-count` | The page has no `h1` or more than one | One `h1` per page, usually in the first banner |
| `duplicate-id` | Two elements share an `id` | Prefix ids with a per-block counter (`csr-initiatives-1-tab-0`) |
| `broken-aria-ref` | `aria-controls` / `aria-labelledby` points to a missing id | Create both elements with matching ids |
| `contrast` | Text contrast is below AA (4.5:1, large text 3:1) | Use a darker token (`--gray-600` or darker on white) |
| `focusable-in-hidden` | A focusable item sits inside hidden content but is still rendered | Use `hidden` / `display: none`, or `tabindex="-1"` while hidden |
| `small-target` | A control is smaller than 24 x 24 px | Make the button or its padding at least 24px |
| `no-focus-style` | No outline or shadow when focused | Add a `:focus-visible` outline (2px `--info-500`, offset 2px) |

The script checks text on solid backgrounds only. Text on gradients or images (pills,
banners) is skipped: check those by eye against the lightest part of the background.
It cannot judge reading order, alt text quality or keyboard behaviour: do the keyboard pass
and read the accessibility snapshot as described in `SKILL.md`.
