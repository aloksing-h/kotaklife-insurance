/*
 * CSR Initiatives Block
 * Section heading, a ruler of financial years (tabs) and the initiative cards of the
 * selected year: two staggered rows of 3 + 2 cards on desktop (1200px and up), 2 columns
 * of 2 on small desktop and a stack of 3 below 900px. The arrows under the cards page
 * through the cards of the year.
 *
 * Authoring (flat): the heading row, then an "Initiatives Year" item followed by the
 * "Initiative" items of that year, then the next year, and so on.
 */

import { createOptimizedPicture, decorateIcons } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const STATUS = {
  ongoing: 'Ongoing',
  other: 'Other than ongoing',
  completed: 'Completed',
};

const YEAR_PATTERN = /^\d{4}\s*-\s*\d{2,4}$/;

// cards per view: 5 (3 + 2 staggered) on desktop, 4 (2 x 2) on small desktop, 3 stacked below
const DESKTOP = window.matchMedia('(width >= 1200px)');
const TABLET = window.matchMedia('(width >= 900px)');
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

let blockCount = 0;

const pageSize = () => {
  if (DESKTOP.matches) return 5;
  if (TABLET.matches) return 4;
  return 3;
};

const textOf = (cell) => cell?.textContent.trim() || '';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function icon(name) {
  const span = el('span', `icon icon-${name}`);
  span.setAttribute('aria-hidden', 'true');
  return span;
}

/**
 * Fills an element with the text of an authored cell, keeping its editor instrumentation.
 * @param {Element} target
 * @param {Element} [cell]
 * @returns {Element} the target
 */
function fill(target, cell) {
  if (!cell) return target;
  target.textContent = textOf(cell);
  moveInstrumentation(cell.querySelector('[data-aue-prop]') || cell, target);
  return target;
}

function statusOf(text) {
  const value = text.toLowerCase();
  if (STATUS[value]) return { key: value, label: STATUS[value] };
  const match = Object.entries(STATUS).find(([, label]) => label.toLowerCase() === value);
  if (match) return { key: match[0], label: match[1] };
  return text ? { key: 'other', label: text } : null;
}

/**
 * A year row has the year and the "selected on load" flag, and no image.
 * @param {Element} row
 * @returns {boolean}
 */
function isYearRow(row) {
  return row.children.length <= 2 && !row.querySelector('picture, img');
}

/**
 * Builds an initiative card from an authored row.
 * Cells: illustration, category, name, code, status, location, link (optional).
 * @param {Element} row
 * @returns {HTMLLIElement}
 */
function buildCard(row) {
  const [imageCell, categoryCell, titleCell, codeCell, statusCell, locationCell, linkCell] = [
    ...row.children,
  ];
  const card = el('li', 'csr-initiatives-card');
  moveInstrumentation(row, card);

  const img = imageCell?.querySelector('img');
  if (img) {
    const visual = el('div', 'csr-initiatives-card-visual');
    const picture = createOptimizedPicture(img.src, img.alt || '', false, [{ width: '400' }]);
    moveInstrumentation(img, picture.querySelector('img'));
    visual.append(picture);
    card.append(visual);
  } else {
    card.classList.add('csr-initiatives-card-no-image');
  }

  const body = el('div', 'csr-initiatives-card-body');
  const intro = el('div', 'csr-initiatives-card-intro');

  if (textOf(categoryCell)) intro.append(fill(el('p', 'csr-initiatives-card-category'), categoryCell));

  const title = el('h3', 'csr-initiatives-card-title');
  const link = linkCell?.querySelector('a[href]');
  const href = link?.getAttribute('href') || (textOf(linkCell).startsWith('/') ? textOf(linkCell) : '');
  if (href) {
    // one stretched link makes the whole card clickable, with the name as its accessible name
    const a = fill(el('a', 'csr-initiatives-card-link'), titleCell);
    a.href = href;
    title.append(a);
    card.classList.add('csr-initiatives-card-linked');
  } else {
    fill(title, titleCell);
  }
  intro.append(title);

  if (textOf(codeCell)) intro.append(fill(el('p', 'csr-initiatives-card-code'), codeCell));
  body.append(intro);

  const meta = el('ul', 'csr-initiatives-card-meta');
  const status = statusOf(textOf(statusCell));
  if (status) {
    const item = el('li', 'csr-initiatives-card-status');
    const label = el('span', '', status.label);
    moveInstrumentation(statusCell.querySelector('[data-aue-prop]') || statusCell, label);
    item.append(icon(`csr-status-${status.key}`), el('span', 'sr-only', 'Status: '), label);
    meta.append(item);
  }
  if (textOf(locationCell)) {
    const item = el('li', 'csr-initiatives-card-location');
    item.append(icon('csr-location'), el('span', 'sr-only', 'Location: '), fill(el('span'), locationCell));
    meta.append(item);
  }
  if (meta.children.length) body.append(meta);

  card.append(body);
  return card;
}

/**
 * Builds a round arrow button.
 * @param {string} className
 * @param {string} label
 * @param {'left'|'right'} direction
 * @returns {HTMLButtonElement}
 */
function arrowButton(className, label, direction) {
  const button = el('button', `csr-initiatives-arrow ${className}`);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(el('span', `csr-initiatives-arrow-icon csr-initiatives-arrow-${direction}`));
  return button;
}

/**
 * Disables a button; when it has focus, focus moves to its sibling so it is not lost.
 * @param {HTMLButtonElement} button
 * @param {HTMLButtonElement} sibling
 * @param {boolean} disabled
 */
function setDisabled(button, sibling, disabled) {
  if (disabled && document.activeElement === button && !sibling.disabled) sibling.focus();
  button.disabled = disabled;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  blockCount += 1;
  const uid = `csr-initiatives-${blockCount}`;
  const rows = [...block.children];

  // heading row: the first single cell row that is not a year
  const first = rows[0];
  const headingRow = first && first.children.length === 1 && !YEAR_PATTERN.test(textOf(first))
    ? rows.shift() : null;

  // group the cards under the year before them
  const years = [];
  rows.forEach((row) => {
    if (isYearRow(row)) {
      const [yearCell, activeCell] = row.children;
      years.push({
        label: textOf(yearCell) || `Year ${years.length + 1}`,
        active: textOf(activeCell).toLowerCase() === 'true',
        row,
        cards: [],
      });
    } else {
      if (!years.length) years.push({ label: 'Initiatives', active: false, cards: [] });
      years[years.length - 1].cards.push(buildCard(row));
    }
  });

  // header: heading, year ruler and year arrows
  const header = el('div', 'csr-initiatives-header');
  if (headingRow) {
    const cell = headingRow.firstElementChild;
    const source = cell.querySelector('h1, h2, h3, h4, h5, h6, p') || cell;
    const heading = el('h2', 'csr-initiatives-title');
    heading.id = `${uid}-title`;
    heading.append(...source.childNodes);
    moveInstrumentation(cell, heading);
    header.append(heading);
  }

  const tabs = [];
  const panels = [];
  const lists = [];
  const ruler = el('div', 'csr-initiatives-years');
  const tablist = el('div', 'csr-initiatives-years-list');
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Financial year');
  ruler.append(tablist);

  const panelsWrapper = el('div', 'csr-initiatives-panels');
  years.forEach((year, i) => {
    const tab = el('button', 'csr-initiatives-year');
    tab.type = 'button';
    tab.id = `${uid}-tab-${i}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `${uid}-panel-${i}`);
    tab.append(el('span', 'csr-initiatives-year-label', year.label), el('span', 'csr-initiatives-year-dot'));
    tab.lastElementChild.setAttribute('aria-hidden', 'true');
    if (year.row) moveInstrumentation(year.row, tab);
    tabs.push(tab);
    tablist.append(tab);

    const panel = el('div', 'csr-initiatives-panel');
    panel.id = `${uid}-panel-${i}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    const list = el('ul', 'csr-initiatives-cards');
    list.append(...year.cards);
    panel.append(list);
    panels.push(panel);
    lists.push(list);
    panelsWrapper.append(panel);
  });

  const yearNav = el('div', 'csr-initiatives-year-nav');
  const prevYear = arrowButton('csr-initiatives-arrow-small', 'Previous year', 'left');
  const nextYear = arrowButton('csr-initiatives-arrow-small', 'Next year', 'right');
  yearNav.append(prevYear, nextYear);
  if (years.length > 1) header.append(ruler, yearNav);
  else if (years.length) header.append(ruler);

  const cardNav = el('div', 'csr-initiatives-card-nav');
  const prevPage = arrowButton('csr-initiatives-arrow-large', 'Previous initiatives', 'left');
  const nextPage = arrowButton('csr-initiatives-arrow-large', 'Next initiatives', 'right');
  cardNav.append(prevPage, nextPage);

  const status = el('p', 'sr-only');
  status.setAttribute('aria-live', 'polite');

  block.replaceChildren(header, panelsWrapper, cardNav, status);
  decorateIcons(block);
  if (!years.length) return;

  const state = {
    year: Math.max(0, years.findIndex((year) => year.active)),
    first: 0, // index of the first card shown
  };

  const centerActiveYear = (smooth) => {
    const tab = tabs[state.year];
    if (!tab || ruler.scrollWidth <= ruler.clientWidth) return;
    ruler.scrollTo({
      left: tab.offsetLeft - (ruler.clientWidth - tab.offsetWidth) / 2,
      behavior: smooth && !REDUCED_MOTION.matches ? 'smooth' : 'auto',
    });
  };

  const render = ({ announce = false, smooth = false } = {}) => {
    const size = pageSize();
    const cards = [...lists[state.year].children];
    state.first = Math.floor(Math.min(state.first, Math.max(0, cards.length - 1)) / size) * size;
    const last = Math.min(state.first + size, cards.length);

    tabs.forEach((tab, i) => {
      const selected = i === state.year;
      tab.setAttribute('aria-selected', selected);
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
    cards.forEach((card, i) => {
      card.hidden = i < state.first || i >= last;
      // the 4th card of a desktop view starts the offset second row
      card.classList.toggle('csr-initiatives-card-offset', size === 5 && i === state.first + 3);
    });

    setDisabled(prevYear, nextYear, state.year === 0);
    setDisabled(nextYear, prevYear, state.year === years.length - 1);
    cardNav.hidden = cards.length <= size;
    setDisabled(prevPage, nextPage, state.first === 0);
    setDisabled(nextPage, prevPage, last >= cards.length);

    if (announce) {
      status.textContent = `Showing initiatives ${state.first + 1} to ${last} of ${cards.length}, ${years[state.year].label}`;
    }
    centerActiveYear(smooth);
  };

  const selectYear = (index, focus = false) => {
    if (index < 0 || index >= years.length) return;
    state.year = index;
    state.first = 0;
    render({ smooth: true });
    if (focus) tabs[index].focus();
  };

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) selectYear(tabs.indexOf(tab));
  });
  tablist.addEventListener('keydown', (event) => {
    const keys = {
      ArrowLeft: state.year - 1,
      ArrowRight: state.year + 1,
      Home: 0,
      End: years.length - 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    selectYear(Math.min(Math.max(keys[event.key], 0), years.length - 1), true);
  });
  prevYear.addEventListener('click', () => selectYear(state.year - 1));
  nextYear.addEventListener('click', () => selectYear(state.year + 1));

  const page = (step) => {
    state.first = Math.max(0, state.first + step * pageSize());
    render({ announce: true });
  };
  prevPage.addEventListener('click', () => page(-1));
  nextPage.addEventListener('click', () => page(1));

  // keep the shown cards when the number of cards per view changes
  [DESKTOP, TABLET].forEach((query) => query.addEventListener('change', () => render()));

  // centre the selected year once the ruler has a size (the section is hidden while loading)
  new ResizeObserver(() => centerActiveYear(false)).observe(ruler);

  // Universal Editor: show the year and the cards of the item selected in the editor
  block.addEventListener('aue:ui-select', (event) => {
    if (!event.detail?.selected) return;
    const tabIndex = tabs.indexOf(event.target.closest?.('[role="tab"]'));
    if (tabIndex >= 0) {
      selectYear(tabIndex);
      return;
    }
    const card = event.target.closest?.('.csr-initiatives-card');
    const yearIndex = lists.findIndex((list) => list.contains(card));
    if (yearIndex < 0) return;
    state.year = yearIndex;
    state.first = [...lists[yearIndex].children].indexOf(card);
    render();
  });

  render();
}
