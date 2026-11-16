import { loadCSS } from '../../scripts/aem.js';
import { button } from '../../scripts/dom-helpers.js';

/*
 * Banner V2, style "Insurance Guide Banner" (insurance-guide-banner):
 * Figma Inner page banners 9142:9325 (desktop) / 9142:9813 (mobile).
 * Loaded by banner-v2.js only for this style; its CSS is scoped to the class.
 * Mobile: the description is cut to two lines with an inline "Read more".
 */

const MOBILE_QUERY = window.matchMedia('(width < 600px)');
const LINES = 2;
const ELLIPSIS = '....';

/**
 * Cuts the description to LINES lines on mobile, ending in "Read more";
 * the full text comes back on desktop, and for good once Read more is used.
 * @param {HTMLElement} description
 */
function readMore(description) {
  const original = [...description.childNodes];
  const words = description.textContent.trim().split(/\s+/);
  const head = document.createTextNode('');
  const more = button({ class: 'banner-v2-read-more', type: 'button', 'aria-expanded': 'false' }, 'Read more');
  let expanded = false;
  let width = 0;

  const restore = () => description.replaceChildren(...original);
  const fits = (max) => description.offsetHeight <= max;
  const update = () => {
    if (expanded || !MOBILE_QUERY.matches) {
      restore();
      return;
    }
    restore();
    const max = parseFloat(getComputedStyle(description).lineHeight) * LINES + 1;
    if (!description.offsetHeight || fits(max)) return;
    // the most words that still fit with ".... Read more"
    const cut = (count) => `${words.slice(0, count).join(' ').replace(/[,;:.!?]+$/, '')}${ELLIPSIS} `;
    description.replaceChildren(head, more);
    let low = 0;
    let high = words.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      head.data = cut(mid);
      if (fits(max)) low = mid;
      else high = mid - 1;
    }
    head.data = cut(low);
  };

  more.addEventListener('click', () => {
    expanded = true;
    restore();
    description.focus({ preventScroll: true });
  });
  description.tabIndex = -1;
  // measure once the section is shown and whenever the width changes
  new ResizeObserver(([entry]) => {
    const next = Math.round(entry.contentRect.width);
    if (next === width) return;
    width = next;
    update();
  }).observe(description.parentElement);
  MOBILE_QUERY.addEventListener('change', update);
  document.fonts?.ready.then(update);
}

/**
 * @param {Element} block the decorated banner-v2 block
 */
export default async function decorate(block) {
  await loadCSS(`${window.hlx.codeBasePath}/blocks/banner-v2/banner-v2-insurance-guide.css`);
  const description = block.querySelector('.banner-v2-description');
  if (description) readMore(description);
}
