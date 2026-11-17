import {
  a, div, h2, img, span, p, button, ul, li, input,
} from '../../scripts/dom-helpers.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

// const FILTERS = ['All', 'Equity', 'Debts', 'Hybrid'];

/**
 * Parses authored date strings such as "as on Oct-31-2025" into a numeric timestamp.
 * @param {string} str The date string to parse
 * @returns {number} Epoch timestamp in milliseconds, or 0 if unparseable
 */
// function parseNavDate(str) {
//   if (!str) return 0;
//   const cleaned = str.replace(/as\s+on\s+/i, '').trim();
//   let time = Date.parse(cleaned);
//   if (!Number.isNaN(time)) return time;
//   time = Date.parse(cleaned.replace(/-/g, ' '));
//   if (!Number.isNaN(time)) return time;
//   return 0;
// }

/**
 * Normalizes a fund category name for comparison.
 * @param {string} cat Category name
 * @returns {string} Lowercase normalized category
 */
function normalizeCategory(cat) {
  const c = (cat || '').trim().toLowerCase();
  if (c === 'debt') return 'debts';
  return c;
}

/**
 * Trimmed text of every child element of a cell (or the cell's own text if it has no children).
 * @param {Element} cell An authored row cell
 * @returns {string[]} Non-empty trimmed text values, in authored order
 */
function cellTexts(cell) {
  if (!cell) return [];
  const texts = cell.children.length
    ? [...cell.children].map((el) => el.textContent.trim())
    : [cell.textContent.trim()];
  return texts.filter(Boolean);
}

function readCardSummary(card) {
  return {
    schemeId: card.querySelector('.scheme-id')?.textContent.trim(),
    navValue: card.querySelector('.nav-val')?.textContent.trim(),
    navDate: card.querySelector('.nav-date')?.textContent.trim(),
    fundReturn: card.querySelector('.fund-val')?.textContent.trim(),
    fundReturnLabel: card.querySelector('.fund-data .fund-bm-txt')?.textContent.trim(),
  };
}

/**
 * Builds one fund card from an authored "Fund Card" item row:
 * [badge + name + code] [NAV + date + risk] [return + label + benchmark + benchmarkLabel] [link]
 * @param {Element} row The 4-column row authored with the fund's data
 * @param {number} index Authoring index for stable sorting
 * @returns {HTMLDivElement} The `.card-content` element
 */
function buildCard(row, index) {
  const [contentCell, navCell, returnsCell, linkCell] = [...row.children];
  const contentTexts = contentCell?.children.length
    ? [...contentCell.children].map((el) => el.textContent.trim())
    : cellTexts(contentCell);
  // const [badge = '', name = '', nameLink ='', code = '', fundCode = ''] = contentTexts;
  const [badge = '', name = '', nameLink = '', code = '', fundCode = ''] = contentTexts.length === 5
    ? contentTexts
    : [contentTexts[0], contentTexts[1], '', ...contentTexts.slice(2)];
  const navTexts = cellTexts(navCell);
  const navValue = navTexts[0] || '';
  const navDate = navTexts[1] || '';
  const [fundReturn = '', fundReturnLabel = '', benchmark = '', benchmarkLabel = ''] = cellTexts(returnsCell);
  // const fundAnchor = contentCell?.querySelector('a[href]');
  // const fundHref = fundAnchor?.getAttribute('href') || '#';
  const fundHref = nameLink || '#';
  const buttonAnchor = linkCell?.querySelector('a[href]');
  // const href = anchor?.getAttribute('href') || '#';
  const buttonHref = buttonAnchor?.getAttribute('href');
  const linkText = buttonAnchor?.textContent.trim() || 'Explore';

  const card = div(
    { class: 'card-content' },
    div(
      { class: 'card-upper-title' },
      div(
        { class: 'tag-expnd-wrap' },
        span({ class: 'tag-txt' }, badge),
        button(
          {
            class: 'expand',
            type: 'button',
            'aria-label': name ? `View NAV history: ${name}` : 'View NAV history',
          },
          img({ class: 'expnd-icon', src: '../../icons/expand-icon.svg', alt: 'expand icon' }),
        ),
      ),
      div(
        { class: 'fund-scheme-wrap' },
        a({ href: fundHref, class: 'fund-link' }, h2({ class: 'fund-name-title' }, name)),
        ...(code ? [p({ class: 'scheme-id' }, code)] : []),
      ),
    ),
    div(
      { class: 'nav-data-container' },
      div(
        { class: 'nav-risk-wrap' },
        div(
          { class: 'nav-data-wrap' },
          p({ class: 'nav-txt' }, 'NAV'),
          p({ class: 'nav-val' }, navValue),
          p({ class: 'nav-date' }, navDate),
        ),
        div(
          { class: 'nav-condition' },
          div(
            { class: 'risk-profile' },
            img({ class: 'risk-img', src: '../../icons/risk-profile.svg', alt: '' }),
          ),
          p({ class: 'risk-txt' }, 'Risk profile'),
        ),
      ),
      div(
        { class: 'fund-benchmark' },
        div(
          { class: 'fund-bm fund-data' },
          p({ class: 'fund-bm-val fund-val' }, fundReturn),
          p({ class: 'fund-bm-txt' }, fundReturnLabel),
        ),
        div(
          { class: 'fund-bm benchmark-data' },
          p({ class: 'fund-bm-val benchmark-val' }, benchmark),
          p({ class: 'fund-bm-txt' }, benchmarkLabel),
        ),
      ),
    ),
    ...(buttonAnchor ? [
      div(
        { class: 'fund-cta-wrap' },
        a(
          { href: buttonHref, class: 'fund-cta' },
          span({ class: 'cta-txt' }, linkText),
          img({ class: 'cta-icon', src: '../../icons/right-red-filled.svg', alt: '' }),
        ),
      ),
    ] : []),
  );

  moveInstrumentation(row, card);
  if (fundCode) card.dataset.fundCode = fundCode;
  if (badge) card.dataset.category = badge;
  // card.dataset.timestamp = String(parseNavDate(navDate));
  card.dataset.index = String(index);

  // Expand opens the fund NAV detail (graph / list view) for this card's fund
  card.querySelector('.expand').addEventListener('click', async () => {
    const { openFundNavDetail } = await import('../fund-nav-detail/fund-nav-detail.js');
    const modalContainer = card.closest('.cards-container')?.querySelector(':scope > .nav-performance-wrap');
    await openFundNavDetail({
      name, code, fundCode, summary: readCardSummary(card),
    }, modalContainer);
  });

  return card;
}

// Attach the same behaviour buildCard adds, to a card that is already in the HTML (server-rendered)
function hydrateCard(card, index) {
  const name = card.querySelector('.fund-name-title')?.textContent.trim() || '';
  const code = card.querySelector('.scheme-id')?.textContent.trim() || '';
  const { fundCode } = card.dataset;
  // const raw = card.dataset.timestamp || '';
  // card.dataset.timestamp = String(Number(raw) || Date.parse(raw) || 0);
  card.dataset.index = String(index);
  card.querySelector('.expand')?.addEventListener('click', async () => {
    const { openFundNavDetail } = await import('../fund-nav-detail/fund-nav-detail.js');
    const modalContainer = card.closest('.cards-container')?.querySelector(':scope > .nav-performance-wrap');
    await openFundNavDetail({
      name, code, fundCode, summary: readCardSummary(card),
    }, modalContainer);
  });
  return card;
}

export default function decorateNavPerformance(block) {
  const isAuthor = window.location.hostname.startsWith('author-p');
  const section = block.closest('.section');
  const customRteWrapper = block.closest('.custom-rte-wrapper');
  const defaultContentWrap = (
    customRteWrapper?.previousElementSibling?.classList.contains('default-content-wrapper')
      ? customRteWrapper.previousElementSibling
      : null
  ) || section?.querySelector(':scope > .default-content-wrapper')
    || section?.querySelector('.default-content-wrapper');
  const titleText = defaultContentWrap?.querySelector('h2');
  const descText = defaultContentWrap?.querySelector('p')?.textContent || '';
  const tagsUlList = defaultContentWrap?.querySelectorAll('ul li');
  const viewAllModalLink = defaultContentWrap?.querySelector('a')?.href;
  if (!isAuthor) {
    defaultContentWrap?.remove();
  }

  const rows = [...block.children];
  const cardRows = rows.filter(
    (row) => row.children.length > 1 && row.textContent.trim().length > 0,
  );

  // const allCards = cardRows.map((row, index) => buildCard(row, index));
  const prerendered = [...block.querySelectorAll(':scope > .card-content')];
  const allCards = prerendered.length
    ? prerendered.map((card, i) => hydrateCard(card, i))
    : cardRows.map((row, index) => buildCard(row, index));

  const cardsWrapper = div({ class: 'cards-wrapper' });

  const selectedSortText = p(
    { class: 'selectedtext', 'aria-labelledby': 'sortby-dropdown' },
    span({ class: 'sort-txt' }, 'Sort by: '),
    'Newest',
  );

  const dropdownList = div(
    { class: 'dropdown-wrap' },
    div(
      { class: 'dropdown-list' },
      button({
        class: 'drpdwn-txt sort-option', type: 'button', 'aria-selected': 'true', 'aria-label': 'Sort by Newest', 'data-sort': 'newest',
      }, 'Newest'),
      button({
        class: 'drpdwn-txt sort-option', type: 'button', 'aria-selected': 'false', 'aria-label': 'Sort by Oldest', 'data-sort': 'oldest',
      }, 'Oldest'),
    ),
  );

  if (titleText) titleText.classList.add('title-txt');
  const navPerformanceContainer = div(
    { class: 'nav-performance-container' },
    div(
      { class: 'control-container' },
      div(
        { class: 'txt-btn-container' },
        // ...(defaultContent ? [defaultContent] : []),
        div(
          { class: 'text-content' },
          titleText,
          p({ class: 'desc-txt' }, descText),
        ),
        div(
          { class: 'btn-content' },
          ul(
            { class: 'btn-list-wrap', role: 'tablist', 'aria-label': 'Filter funds' },
            ...Array.from(tagsUlList).map((label, i) => li(
              { class: 'btn-list', role: 'presentation' },
              button({
                class: 'btn-txt', type: 'button', role: 'tab', 'aria-selected': i === 0 ? 'true' : 'false',
              }, label),
            )),
          ),
        ),
      ),
      div(
        { class: 'inp-control-container' },
        div(
          { class: 'nav-inp-wrap' },
          img({ class: 'inp-icon', src: '../../icons/search-grey.svg', alt: 'Search Icon' }),
          input({
            class: 'search-inp', id: 'search-field', name: 'search-field', type: 'text', placeholder: 'Search by scheme or fund, ex: Frontline Equity Fund...', 'aria-label': 'Search by scheme or fund, ex: Frontline Equity Fund', autocomplete: 'off',
          }),
        ),
        div(
          { class: 'sort-view-wrap' },
          div(
            { class: 'sort-container' },
            p(
              { class: 'sortby-wrap' },
              img({ class: 'sort-icon', src: '../../icons/sortby-icon.svg', alt: '' }),
              span({ class: 'sort-txt' }, 'Sort by:'),
            ),
            div(
              { class: 'sort-select-container' },
              selectedSortText,
              dropdownList,
            ),
          ),
          div(
            { class: 'view-btn-wrap' },
            a({
              class: 'view-btn-link', href: viewAllModalLink, role: 'button', 'aria-haspopup': 'dialog', 'aria-label': 'View All Funds', 'aria-controls': 'modal-container-id',
            }, 'View All'),
          ),
        ),
      ),
    ),
    div(
      { class: 'cards-container' },
      cardsWrapper,
      div(
        { class: 'show-more-wrap' },
        button(
          {
            class: 'show-more-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'fund-card-extra', 'aria-label': 'Show more funds',
          },
          span({ class: 'button-txt' }, 'Show More'),
          img({
            class: 'button-icon', src: '../../icons/grey-add-circle.svg', alt: '', 'aria-hidden': 'true',
          }),
        ),
      ),
      div(
        {
          class: 'nav-performance-wrap', id: 'nav-performance-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Fund Performance Detail', tabindex: '-1',
        },
        // modal will come here
        button(
          {
            class: 'close-btn', 'aria-label': 'Close Performance Modal', type: 'button', 'aria-controls': 'nav-performance-modal',
          },
          img({
            class: 'close-icon', src: '../../icons/modal-close.svg', alt: '', 'aria-hidden': 'true',
          }),
        ),
      ),
    ),
  );

  block.replaceChildren(navPerformanceContainer);

  // Custom logic on modal open (modal opens asynchronously):
  document.addEventListener('modal:opened', (e) => {
    const { dialog } = e.detail;
    if (!dialog?.matches('.view-all-modal') && !dialog?.querySelector('.view-all-modal')) return;
    const defaultContent = dialog.querySelector('.default-content-wrapper');
    if (!defaultContent) return;
    const fundTitle = defaultContent.querySelector('h2, h3, h4, h5, h6')?.textContent?.trim();

    // Extract fund names from the authored list
    const allFunds = [...defaultContent.querySelectorAll('ul li a')]
      .map((anch) => ({ name: anch.textContent.trim(), url: anch.href }))
      .filter(Boolean);

    // Split items across 4 columns
    // const columnCount = 4;
    // const itemsPerColumn = Math.ceil(allFunds.length / columnCount);
    // const columns = Array.from(
    //   { length: columnCount },
    //   (_, i) => allFunds.slice(
    //     i * itemsPerColumn,
    //     (i + 1) * itemsPerColumn,
    //   ),
    // );

    // Build the 4-column grid markup
    // const fundsGrid = div(
    //   { class: 'funds-grid' },
    //   h2({ class: 'fund-title' }, fundTitle),
    //   div(
    //     { class: 'fund-list-wrapper' },
    //     div(
    //       { class: 'fund-list' },
    //       ...columns.map((colFunds) => ul(
    //         { class: 'funds-column', role: 'list', 'aria-label': 'All Funds List' },
    //         // ...colFunds.map((fund) => a({ role: 'listitem', href: fund.url || '#'},
    //              fund.name))
    //         ...colFunds.map((fund) => li(
    //           { class: 'fund-item', role: 'listitem' },
    //           a(
    //             {
    //               class: 'fund-link',
    //               href: fund.url || '',
    //             },
    //             fund.name,
    //           ),
    //         )),
    //       )),
    //     ),
    //   ),
    // );

    const fundsGrid = div(
      { class: 'funds-grid' },
      h2({ class: 'fund-title' }, fundTitle),
      div(
        { class: 'fund-list-wrapper' },
        div(
          { class: 'fund-list' },
          ul(
            { class: 'funds-column', role: 'list', 'aria-label': 'All Funds List' },
            ...allFunds.map((fund) => li(
              { class: 'fund-item', role: 'listitem' },
              a(
                {
                  class: 'fund-link',
                  href: fund.url || '',
                },
                fund.name,
              ),
            )),
          ),
        ),
      ),
    );

    // Replace default content with the grid
    defaultContent.innerHTML = '';
    defaultContent.append(fundsGrid);

    // custom-scrollbar start
    // const scrollWrapper = fundsGrid.querySelector('.fund-list-wrapper');
    // const scrollArea = div({ class: 'fund-scroll-area' });
    // const scrollThumb = div({ class: 'fund-scroll-thumb' });
    // scrollWrapper.id = `fund-list-${crypto.randomUUID()}`;
    // scrollWrapper.setAttribute('tabindex', '0');
    // const scrollBar = div({
    //   class: 'fund-scrollbar',
    //   role: 'scrollbar',
    //   tabindex: '0',
    //   'aria-label': 'Scroll funds',
    //   'aria-controls': scrollWrapper.id,
    //   'aria-orientation': 'vertical',
    //   'aria-valuemin': '0',
    //   'aria-valuemax': '0',
    //   'aria-valuenow': '0',
    //   hidden: '',
    // }, scrollThumb);
    // scrollWrapper.replaceWith(scrollArea);
    // scrollArea.append(scrollWrapper, scrollBar);
    // scrollWrapper.classList.add('inset-scrollbar');
    // const mobileScrollQuery = window.matchMedia('(width < 769px)');
    // let thumbTravel = 0;
    // let dragOffset = 0;
    // const updateScrollbar = () => {
    //   const { clientHeight, scrollHeight, scrollTop } = scrollWrapper;
    //   const maxScroll = Math.max(0, scrollHeight - clientHeight);
    //   scrollBar.hidden = !mobileScrollQuery.matches || maxScroll === 0;
    //   const trackHeight = scrollBar.clientHeight;
    //   const thumbHeight = Math.min(
    //     trackHeight,
    //     Math.max(24, scrollHeight ? (trackHeight * clientHeight) / scrollHeight : 0),
    //   );
    //   const scrollPosition = Math.min(maxScroll, Math.max(0, scrollTop));
    //   thumbTravel = Math.max(0, trackHeight - thumbHeight);
    //   scrollThumb.style.height = `${thumbHeight || 0}px`;
    //   scrollThumb.style.transform = (
    //     `translateY(${maxScroll ? (scrollPosition / maxScroll) * thumbTravel : 0}px)`
    //   );
    //   scrollBar.setAttribute('aria-valuemax', String(maxScroll));
    //   scrollBar.setAttribute('aria-valuenow', String(Math.round(scrollPosition)));
    // };
    // const dragScrollbar = (event) => {
    //   if (!thumbTravel) return;
    //   const offset = event.clientY - scrollBar.getBoundingClientRect().top - dragOffset;
    //   const progress = Math.min(1, Math.max(0, offset / thumbTravel));
    //   scrollWrapper.scrollTop = (
    //     progress * (scrollWrapper.scrollHeight - scrollWrapper.clientHeight)
    //   );
    // };
    // scrollBar.addEventListener('pointerdown', (event) => {
    //   if (event.button !== 0) return;
    //   event.preventDefault();
    //   scrollBar.focus({ preventScroll: true });
    //   dragOffset = event.target === scrollThumb
    //     ? event.clientY - scrollThumb.getBoundingClientRect().top : scrollThumb.offsetHeight / 2;
    //   scrollBar.setPointerCapture(event.pointerId);
    //   dragScrollbar(event);
    // });
    // scrollBar.addEventListener('pointermove', (event) => {
    //   if (scrollBar.hasPointerCapture(event.pointerId)) dragScrollbar(event);
    // });
    // scrollBar.addEventListener('pointerup', (event) => {
    //   if (scrollBar.hasPointerCapture(event.pointerId)) {
    //     scrollBar.releasePointerCapture(event.pointerId);
    //   }
    // });
    // scrollBar.addEventListener('keydown', (event) => {
    //   const steps = {
    //     ArrowDown: 40, ArrowUp: -40,
    //     PageDown: scrollWrapper.clientHeight, PageUp: -scrollWrapper.clientHeight,
    //     Home: -scrollWrapper.scrollHeight, End: scrollWrapper.scrollHeight,
    //   };
    //   if (!(event.key in steps)) return;
    //   event.preventDefault();
    //   scrollWrapper.scrollTop += steps[event.key];
    // });
    // scrollWrapper.addEventListener('scroll', updateScrollbar, { passive: true });
    // mobileScrollQuery.addEventListener('change', updateScrollbar);
    // const scrollObserver = new ResizeObserver(updateScrollbar);
    // scrollObserver.observe(scrollWrapper);
    // scrollObserver.observe(scrollWrapper.querySelector('.fund-list'));
    // dialog.addEventListener('close', () => {
    //   scrollObserver.disconnect();
    //   mobileScrollQuery.removeEventListener('change', updateScrollbar);
    // }, { once: true });
    // updateScrollbar();
    // custom-scrollbar end
  });

  const detailContainer = navPerformanceContainer.querySelector('.nav-performance-wrap');
  detailContainer.querySelector('.close-btn').addEventListener('click', async () => {
    const { closeFundNavDetail } = await import('../fund-nav-detail/fund-nav-detail.js');
    closeFundNavDetail(detailContainer);
  });
  detailContainer.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      const { closeFundNavDetail } = await import('../fund-nav-detail/fund-nav-detail.js');
      closeFundNavDetail(detailContainer);
    }
  });

  let currentCategory = 'All';
  let currentSort = 'newest';
  let showAllCards = isAuthor;
  let searchQuery = '';

  function applyFilterAndSort() {
    const filtered = allCards.filter((card) => {
      if (currentCategory !== 'All') {
        const cat = normalizeCategory(card.dataset.category);
        if (cat !== normalizeCategory(currentCategory)) return false;
      }
      if (searchQuery.length >= 3) {
        const fundName = card.querySelector('.fund-name-title')?.textContent.toLowerCase() || '';
        const schemeId = card.querySelector('.scheme-id')?.textContent.toLowerCase() || '';
        if (!fundName.includes(searchQuery) && !schemeId.includes(searchQuery)) return false;
      }
      return true;
    });

    filtered.sort((cardA, cardB) => {
      // const timeA = Number(cardA.dataset.timestamp) || 0;
      // const timeB = Number(cardB.dataset.timestamp) || 0;
      const timeA = Date.parse(cardA.dataset.fundInceptionDate) || 0;
      const timeB = Date.parse(cardB.dataset.fundInceptionDate) || 0;
      if (timeA !== timeB) {
        return currentSort === 'newest' ? timeB - timeA : timeA - timeB;
      }
      return Number(cardA.dataset.index) - Number(cardB.dataset.index);
    });

    const visibleCards = showAllCards ? filtered : filtered.slice(0, 6);
    if (searchQuery.length >= 3 && filtered.length === 0) {
      cardsWrapper.replaceChildren(
        p(
          { class: 'no-result-txt', role: 'status' },
          'No funds match your search. Try a different fund name or scheme ID.',
        ),
      );
    } else {
      cardsWrapper.replaceChildren(...visibleCards);
    }

    // Toggle show-more button visibility
    const showMoreWrap = navPerformanceContainer.querySelector('.show-more-wrap');
    if (showMoreWrap) {
      if (filtered.length <= 6 || showAllCards) {
        showMoreWrap.classList.add('dsp-none');
      } else {
        showMoreWrap.classList.remove('dsp-none');
      }
    }
  }

  // Filter tabs logic
  const filterTabs = navPerformanceContainer.querySelectorAll('.btn-list-wrap .btn-txt');
  filterTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      filterTabs.forEach((t) => t.setAttribute('aria-selected', 'false'));
      e.currentTarget.setAttribute('aria-selected', 'true');
      currentCategory = e.currentTarget.textContent.trim();
      applyFilterAndSort();
    });
  });

  // Dropdown toggle logic
  const sortSelectContainer = navPerformanceContainer.querySelector('.sort-select-container');
  selectedSortText.addEventListener('click', (e) => {
    e.stopPropagation();
    sortSelectContainer.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!sortSelectContainer.contains(e.target)) {
      sortSelectContainer.classList.remove('active');
    }
  });

  // Dropdown options sorting logic
  const sortOptions = dropdownList.querySelectorAll('.sort-option');
  sortOptions.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sortOptions.forEach((b) => b.setAttribute('aria-selected', 'false'));
      btn.setAttribute('aria-selected', 'true');

      selectedSortText.replaceChildren(
        span({ class: 'sort-txt' }, 'Sort by: '),
        btn.textContent.trim(),
      );

      currentSort = btn.dataset.sort || 'newest';
      applyFilterAndSort();
      dropdownList.classList.remove('show');
      sortSelectContainer.classList.remove('active');
    });
  });

  // Search input: filter cards by fund name and scheme id after 3 characters
  const searchInput = navPerformanceContainer.querySelector('.search-inp');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim().toLowerCase();
      applyFilterAndSort();
    });
  }

  // Show more button: reveal all cards and hide the button
  const showMoreBtn = navPerformanceContainer.querySelector('.show-more-btn');
  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      showAllCards = true;
      const showMoreWrap = showMoreBtn.closest('.show-more-wrap');
      if (showMoreWrap) showMoreWrap.classList.add('dsp-none');
      applyFilterAndSort();
    });
  }

  // Initial render
  applyFilterAndSort();
  if (document.readyState !== 'complete') {
    window.addEventListener('load', applyFilterAndSort, { once: true });
  }
}
