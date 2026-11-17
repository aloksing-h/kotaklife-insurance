import { loadCSS } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import {
  button, div, domEl, li, nav, p, ul,
} from '../../scripts/dom-helpers.js';
import {
  DEFAULT_SOURCE, HOVER_GROW_QUERY, PAGE_SIZE,
  buildCard, fetchIndex, fitHoverCopy, icon, pageList, prepare,
} from '../blog-listing/blog-listing.js';

/**
 * Category cards: on a category landing page (for example /insurance-guide/retirement),
 * every page of that category as a card, with the Blog Listing card design.
 *
 * Data: the insurance guide index (helix-query.yaml "blogs", /query-insurance-index.json).
 * Its "category" column is the category part of a page's path
 * (/insurance-guide/<category>/<page>), so the current category is the last part of the
 * landing page's own path, unless the author sets one. Cards, card styles, pagination
 * numbers and hover fitting come from the Blog Listing block.
 *
 * rows: [heading & text] [category] [index]
 */

/**
 * The category key of a page path: its last part, as the index writes it.
 * @param {string} path
 * @returns {string}
 */
function categoryOf(path) {
  const segments = path.replace(/\.html$/, '').split('/').filter(Boolean);
  return (segments.at(-1) || '').toLowerCase();
}

/** A path without .html and trailing slash, to compare with the index paths. */
function normalise(path) {
  return path.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
}

/**
 * loads and decorates the category-cards block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const [textRow, categoryRow, sourceRow] = [...block.children];
  const cellText = (row) => row?.querySelector('a')?.getAttribute('href')
    || row?.textContent.trim() || '';
  const category = (cellText(categoryRow) || categoryOf(window.location.pathname)).toLowerCase();
  const source = cellText(sourceRow) || DEFAULT_SOURCE;
  const here = normalise(window.location.pathname);

  // the Blog Listing card styles, scoped by the "blog-listing" list wrapper below
  const styles = loadCSS(`${window.hlx.codeBasePath}/blocks/blog-listing/blog-listing.css`);

  // --- heading (optional) ---
  const textCell = textRow?.firstElementChild;
  let header = null;
  if (textCell?.textContent.trim()) {
    header = div({ class: 'blog-listing-header category-cards-header' });
    moveInstrumentation(textCell, header);
    header.append(...textCell.childNodes);
    header.querySelector('h1, h2, h3, h4, h5, h6')?.classList.add('blog-listing-title');
    header.querySelectorAll('p').forEach((para) => para.classList.add('blog-listing-subtitle'));
  }

  const status = p({ class: 'blog-listing-status', role: 'status' });
  const cards = ul({ class: 'blog-listing-cards' });
  const empty = p({ class: 'blog-listing-empty', hidden: '' });
  const pagination = nav({ class: 'blog-listing-pagination', 'aria-label': 'Pagination' });
  const list = div(
    { class: 'blog-listing category-cards-list is-loading' },
    ...(header ? [header] : []),
    status,
    cards,
    empty,
    pagination,
  );
  block.replaceChildren(list);

  const state = { rows: [], page: 1, error: false };
  const pageSize = () => PAGE_SIZE.find(({ query }) => window.matchMedia(query).matches).size;

  const pageButton = (text, page, className, ...children) => button({
    class: className, type: 'button', 'data-page': page, 'aria-label': text,
  }, ...children);

  const renderPagination = (pages) => {
    pagination.replaceChildren();
    pagination.hidden = pages <= 1;
    if (pages <= 1) return;
    const prev = pageButton('Previous page', state.page - 1, 'blog-listing-page-step blog-listing-page-prev', icon('prev'));
    prev.disabled = state.page === 1;
    const next = pageButton('Next page', state.page + 1, 'blog-listing-page-step blog-listing-page-next', icon('next'));
    next.disabled = state.page === pages;
    const numbers = domEl('ol', { class: 'blog-listing-pages' }, ...pageList(state.page, pages).map((page) => {
      if (page === null) return li({ class: 'blog-listing-page-gap', 'aria-hidden': 'true' }, '...');
      const number = pageButton(`Page ${page} of ${pages}`, page, 'blog-listing-page', String(page));
      if (page === state.page) number.setAttribute('aria-current', 'page');
      return li(number);
    }));
    pagination.append(prev, numbers, next);
  };

  const render = () => {
    const size = pageSize();
    const found = state.rows;
    const pages = Math.max(1, Math.ceil(found.length / size));
    state.page = Math.min(Math.max(1, state.page), pages);
    const shown = found.slice((state.page - 1) * size, state.page * size);
    // no authored card images: the Blog Listing line art for the card type
    cards.replaceChildren(...shown.map((row) => buildCard(row, {})));
    fitHoverCopy(cards);
    cards.hidden = !found.length;
    empty.hidden = found.length > 0;
    empty.textContent = state.error
      ? 'Articles could not be loaded. Please try again later.'
      : 'No articles in this category yet.';
    status.textContent = state.error || !found.length
      ? empty.textContent : `${found.length} ${found.length === 1 ? 'article' : 'articles'}`;
    renderPagination(pages);
  };

  pagination.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-page]');
    if (!target || target.disabled) return;
    state.page = Number(target.dataset.page);
    render();
    // keep the first card of the new page in view
    if (block.getBoundingClientRect().top < 0) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    pagination.querySelector('[aria-current="page"]')?.focus();
  });
  PAGE_SIZE.forEach(({ query }) => window.matchMedia(query).addEventListener('change', render));
  // the hover copy is re-fitted when the card width or the fonts change
  let fitFrame;
  const refit = () => {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => fitHoverCopy(cards));
  };
  new ResizeObserver(refit).observe(cards);
  HOVER_GROW_QUERY.addEventListener('change', refit);
  document.fonts?.ready.then(refit);

  // --- data: the pages of this category, newest first, without this page ---
  try {
    const [rows] = await Promise.all([fetchIndex(source), styles]);
    const matching = rows.filter((row) => typeof row?.category === 'string'
      && typeof row.path === 'string'
      && row.category.trim().toLowerCase() === category
      && normalise(row.path) !== here);
    state.rows = category ? prepare(matching).map(({ row }) => row) : [];
  } catch {
    await styles.catch(() => {});
    state.error = true;
  }
  list.classList.remove('is-loading');
  render();
}
