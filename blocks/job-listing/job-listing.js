/*
 * Job Listing Block
 * Careers page "Your next move" (Figma 11104:9545 desktop, 11104:9774 mobile; filter open
 * 11104:9739 / 11104:9964; filtered results 11104:9642 / 11104:9829).
 * Block rows, in model order: heading and description, then the labels and settings
 * (search, filter, sort, pagination, messages). Each Job item: [category] [career type]
 * [title] [department] [posting date] [location] [apply link].
 * Search, filters (from the categories and career types of the jobs), sorting and
 * pagination work on the authored jobs. Links to #q=keyword or ?q=keyword (for example the
 * Popular searches tags) search the jobs.
 */

import { moveInstrumentation } from '../../scripts/scripts.js';
import { pageList } from '../blog-listing/blog-listing.js';

const LABELS = [
  'text', 'searchPlaceholder', 'searchLabel', 'filterLabel', 'categoryHeading', 'careerHeading',
  'applyFilterLabel', 'clearLabel', 'filteredByLabel', 'closeLabel', 'sortLabel', 'sortOptions',
  'pageSize', 'applyLabel', 'resultsLabel', 'emptyMessage', 'previousLabel', 'nextLabel',
  'pageLabel', 'removeLabel',
];
const SORTS = {
  newest: (a, b) => (b.time - a.time),
  oldest: (a, b) => (a.time - b.time),
  title: (a, b) => a.title.localeCompare(b.title),
};
const MOBILE = window.matchMedia('(width < 900px)');
const SEARCH_DELAY = 200;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const scrollBehavior = () => (REDUCED_MOTION.matches ? 'auto' : 'smooth');
let blockCount = 0;

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function icon(name) {
  const span = element('span', `job-listing-icon job-listing-icon-${name}`);
  span.setAttribute('aria-hidden', 'true');
  return span;
}

function textOf(cell) {
  return cell?.textContent.trim() || '';
}

/**
 * Reads the authored config rows (one cell each) and the Job items.
 * @param {Element} block
 */
function readContent(block) {
  const rows = [...block.children];
  const configRows = rows.filter((row) => row.children.length === 1);
  const config = Object.fromEntries(LABELS.map((key, i) => [
    key, configRows[i]?.firstElementChild,
  ]));
  const labels = Object.fromEntries(LABELS.map((key) => [key, textOf(config[key])]));
  const locale = document.documentElement.lang || 'en-IN';
  // posting dates are Indian dates; the same day is shown in every visitor's time zone
  const dateParts = new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
  // always day, month, year (Figma "12 Jul 2026"), whatever order the locale uses
  const dateFormat = {
    format: (value) => {
      const parts = Object.fromEntries(dateParts.formatToParts(value)
        .map((p) => [p.type, p.value]));
      return `${parts.day} ${parts.month} ${parts.year}`;
    },
  };

  const jobs = rows.filter((row) => row.children.length > 1).map((row, index) => {
    const cells = [...row.children];
    const [category, career, title, department, date, location] = cells.slice(0, 6).map(textOf);
    const href = cells[6]?.querySelector('a[href]')?.getAttribute('href') || textOf(cells[6]);
    const parsed = date ? new Date(date) : null;
    const time = parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
    return {
      row,
      index,
      category,
      career,
      title,
      department,
      location,
      href,
      time,
      dateLabel: time ? dateFormat.format(new Date(time)) : date,
      dateValue: time ? new Date(time).toISOString().slice(0, 10) : '',
      text: [title, department, category, career, location].join(' ').toLowerCase(),
    };
  }).filter((job) => job.title);

  const sorts = (labels.sortOptions || '').split(',').map((entry) => {
    const [label, value] = entry.split('=').map((part) => part.trim());
    return { label, value: (value || '').toLowerCase() };
  }).filter((sort) => sort.label && SORTS[sort.value]);
  if (!sorts.length) sorts.push({ label: '', value: 'newest' });

  const pageSize = Math.max(1, parseInt(labels.pageSize, 10) || 8);
  return {
    config, labels, jobs, sorts, pageSize,
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function checkbox(name, value, id) {
  const option = element('label', 'job-listing-option');
  const input = element('input');
  input.type = 'checkbox';
  input.name = name;
  input.value = value;
  input.id = id;
  const box = element('span', 'job-listing-checkbox');
  box.setAttribute('aria-hidden', 'true');
  option.append(input, box, element('span', 'job-listing-option-label', value));
  return option;
}

function filterGroup(className, heading, name, values, id) {
  const group = element('fieldset', `job-listing-group ${className}`);
  group.append(element('legend', 'job-listing-group-title', heading));
  const options = element('div', 'job-listing-options');
  values.forEach((value, i) => options.append(checkbox(name, value, `${id}-${name}-${i}`)));
  group.append(options);
  return group;
}

/**
 * One job card.
 * @param {object} job
 * @param {string} applyLabel
 */
function buildCard(job, applyLabel) {
  const card = element('li', 'job-listing-card');
  moveInstrumentation(job.row, card);
  if (job.category) card.append(element('p', 'job-listing-badge', job.category));
  const heading = element('h3', 'job-listing-title', job.title);
  card.append(heading);
  if (job.department) card.append(element('p', 'job-listing-department', job.department));

  const meta = element('ul', 'job-listing-meta');
  if (job.dateLabel) {
    const item = element('li', 'job-listing-meta-item');
    const time = element('time', '', job.dateLabel);
    if (job.dateValue) time.dateTime = job.dateValue;
    item.append(icon('calendar'), time);
    meta.append(item);
  }
  if (job.location) {
    const item = element('li', 'job-listing-meta-item');
    item.append(icon('location'), element('span', '', job.location));
    meta.append(item);
  }
  if (meta.children.length) card.append(meta);

  if (job.href && applyLabel) {
    const actions = element('p', 'job-listing-actions');
    const link = element('a', 'job-listing-apply');
    link.href = job.href;
    link.append(element('span', 'job-listing-apply-label', applyLabel), icon('arrow'));
    // the link names the job, the visible label stays short
    const hidden = element('span', 'job-listing-visually-hidden', `: ${job.title}`);
    link.firstChild.append(hidden);
    actions.append(link);
    card.append(actions);
  }
  return card;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  blockCount += 1;
  const id = `job-listing-${blockCount}`;
  const {
    config, labels, jobs, sorts, pageSize,
  } = readContent(block);

  /* ---- header ---- */
  const header = element('div', 'job-listing-header');
  [...(config.text?.children || [])].filter((el) => el.textContent.trim()).forEach((el) => {
    el.classList.add(el.matches('h1, h2, h3, h4, h5, h6') ? 'job-listing-heading' : 'job-listing-lead');
    header.append(el);
  });

  /* ---- search, filter and sort ---- */
  const tools = element('div', 'job-listing-tools');
  const search = element('div', 'job-listing-search');
  const searchInput = element('input', 'job-listing-search-input');
  searchInput.type = 'search';
  searchInput.id = `${id}-search`;
  searchInput.placeholder = labels.searchPlaceholder;
  searchInput.autocomplete = 'off';
  searchInput.setAttribute('aria-label', labels.searchLabel || labels.searchPlaceholder);
  search.append(icon('search'), searchInput);

  const filterButton = element('button', 'job-listing-filter-button');
  filterButton.type = 'button';
  filterButton.setAttribute('aria-expanded', 'false');
  filterButton.setAttribute('aria-controls', `${id}-filters`);
  filterButton.append(icon('filter'), element('span', 'job-listing-button-label', labels.filterLabel), icon('chevron'));

  const sortBox = element('div', 'job-listing-sort');
  const sortSelect = element('select', 'job-listing-sort-select');
  sortSelect.setAttribute('aria-label', labels.sortLabel || sorts[0].label);
  sorts.forEach((sort) => sortSelect.append(new Option(sort.label || sort.value, sort.value)));
  sortBox.append(icon('sort'), sortSelect, icon('chevron'));

  const buttons = element('div', 'job-listing-tool-buttons');
  buttons.append(filterButton, sortBox);
  tools.append(search, buttons);

  /* ---- filter panel: a dropdown on desktop, full screen on mobile ---- */
  const categories = unique(jobs.map((job) => job.category));
  const careers = unique(jobs.map((job) => job.career));
  const panel = element('dialog', 'job-listing-panel');
  panel.id = `${id}-filters`;
  panel.setAttribute('aria-label', labels.filterLabel);
  const panelClose = element('button', 'job-listing-panel-close');
  panelClose.type = 'button';
  panelClose.setAttribute('aria-label', labels.closeLabel || labels.filterLabel);
  panelClose.append(icon('close'));
  const panelBody = element('div', 'job-listing-panel-body');
  if (categories.length) panelBody.append(filterGroup('job-listing-categories', labels.categoryHeading, 'category', categories, id));
  if (careers.length) panelBody.append(filterGroup('job-listing-careers', labels.careerHeading, 'career', careers, id));
  const panelActions = element('div', 'job-listing-panel-actions');
  const panelClear = element('button', 'job-listing-panel-clear', labels.clearLabel);
  panelClear.type = 'button';
  const panelApply = element('button', 'job-listing-panel-apply', labels.applyFilterLabel);
  panelApply.type = 'button';
  panelActions.append(panelClear, panelApply);
  panel.append(panelClose, panelBody, panelActions);
  tools.append(panel);

  /* ---- applied filters, list, pagination ---- */
  const applied = element('div', 'job-listing-applied');
  applied.hidden = true;
  const appliedLabel = element('p', 'job-listing-applied-label', labels.filteredByLabel);
  const chips = element('ul', 'job-listing-chips');
  const clearAll = element('button', 'job-listing-clear', labels.clearLabel);
  clearAll.type = 'button';
  applied.append(appliedLabel, chips, clearAll);

  const status = element('p', 'job-listing-visually-hidden');
  status.setAttribute('role', 'status');
  const list = element('ul', 'job-listing-list');
  list.id = `${id}-list`;
  const empty = element('p', 'job-listing-empty', labels.emptyMessage);
  empty.hidden = true;
  const pagination = element('nav', 'job-listing-pagination');
  pagination.setAttribute('aria-label', labels.pageLabel || 'Pagination');

  const children = [];
  if (header.children.length) children.push(header);
  children.push(tools, applied, status, list, empty, pagination);
  block.replaceChildren(...children);

  /* ---- state ---- */
  const state = {
    query: '', categories: new Set(), careers: new Set(), sort: sorts[0].value, page: 1,
  };
  const checkboxes = () => [...panel.querySelectorAll('input[type="checkbox"]')];

  const matches = (job) => {
    const terms = state.query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.some((term) => !job.text.includes(term))) return false;
    if (state.categories.size && !state.categories.has(job.category)) return false;
    if (state.careers.size && !state.careers.has(job.career)) return false;
    return true;
  };

  const renderChips = () => {
    const active = [...state.categories].map((value) => ['category', value])
      .concat([...state.careers].map((value) => ['career', value]));
    chips.replaceChildren(...active.map(([name, value]) => {
      const chip = element('li', 'job-listing-chip');
      const remove = element('button', 'job-listing-chip-remove');
      remove.type = 'button';
      remove.dataset.name = name;
      remove.dataset.value = value;
      remove.setAttribute('aria-label', `${labels.removeLabel || ''} ${value}`.trim());
      remove.append(icon('remove'));
      chip.append(element('span', 'job-listing-chip-label', value), remove);
      return chip;
    }));
    applied.hidden = !active.length;
  };

  const renderPagination = (pages) => {
    pagination.replaceChildren();
    pagination.hidden = pages < 2;
    if (pages < 2) return;
    const pageButton = (className, label, page, disabled) => {
      const button = element('button', className);
      button.type = 'button';
      button.dataset.page = String(page);
      button.setAttribute('aria-label', label);
      button.disabled = disabled;
      return button;
    };
    const prev = pageButton('job-listing-page-prev', labels.previousLabel, state.page - 1, state.page === 1);
    prev.append(icon('prev'));
    const next = pageButton('job-listing-page-next', labels.nextLabel, state.page + 1, state.page === pages);
    next.append(icon('next'));
    const numbers = element('ol', 'job-listing-pages');
    pageList(state.page, pages).forEach((page) => {
      const item = element('li');
      if (page === null) {
        item.append(element('span', 'job-listing-page-gap', '…'));
        item.firstChild.setAttribute('aria-hidden', 'true');
      } else {
        const button = pageButton('job-listing-page', `${labels.pageLabel} ${page}`.trim(), page, false);
        button.textContent = String(page);
        if (page === state.page) button.setAttribute('aria-current', 'page');
        item.append(button);
      }
      numbers.append(item);
    });
    pagination.append(prev, numbers, next);
  };

  const render = ({ announce = true } = {}) => {
    const results = jobs.filter(matches).sort(SORTS[state.sort] || SORTS.newest);
    const pages = Math.max(1, Math.ceil(results.length / pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * pageSize;
    list.replaceChildren(...results.slice(start, start + pageSize)
      .map((job) => buildCard(job, labels.applyLabel)));
    empty.hidden = results.length > 0;
    renderChips();
    renderPagination(pages);
    if (announce && labels.resultsLabel) {
      status.textContent = labels.resultsLabel.replace('{count}', String(results.length));
    }
  };

  /* ---- search ---- */
  let searchTimer = 0;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = searchInput.value.trim();
      state.page = 1;
      render();
    }, SEARCH_DELAY);
  });
  const searchFor = (query, scroll) => {
    searchInput.value = query;
    state.query = query;
    state.page = 1;
    render();
    if (scroll) block.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  };
  // Popular searches and other links to #q=keyword search the jobs on this page
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#q="]');
    if (!link) return;
    event.preventDefault();
    searchFor(decodeURIComponent(link.getAttribute('href').slice(3)).replace(/\+/g, ' '), true);
  });
  const initial = new URLSearchParams(window.location.search).get('q')
    || (window.location.hash.startsWith('#q=') ? decodeURIComponent(window.location.hash.slice(3)) : '');
  if (initial) searchInput.value = initial;
  state.query = initial;

  /* ---- sort ---- */
  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    state.page = 1;
    render();
  });

  /* ---- filter panel ---- */
  const syncChecks = () => checkboxes().forEach((input) => {
    input.checked = (input.name === 'category' ? state.categories : state.careers).has(input.value);
    input.closest('.job-listing-option').classList.toggle('is-checked', input.checked);
  });
  const placeNotch = () => {
    const toolsBox = tools.getBoundingClientRect();
    const buttonBox = filterButton.getBoundingClientRect();
    tools.style.setProperty('--job-listing-notch', `${buttonBox.left + buttonBox.width / 2 - toolsBox.left}px`);
  };
  const closePanel = (focus = true) => {
    if (!panel.open) return;
    panel.close();
    filterButton.setAttribute('aria-expanded', 'false');
    block.classList.remove('is-filtering');
    if (focus) filterButton.focus();
  };
  const openPanel = () => {
    syncChecks();
    placeNotch();
    if (MOBILE.matches) panel.showModal();
    else panel.show();
    filterButton.setAttribute('aria-expanded', 'true');
    block.classList.add('is-filtering');
    (panel.querySelector('input') || panelApply).focus();
  };
  filterButton.addEventListener('click', () => (panel.open ? closePanel() : openPanel()));
  panelClose.addEventListener('click', () => closePanel());
  panel.addEventListener('change', (event) => {
    event.target.closest('.job-listing-option')?.classList.toggle('is-checked', event.target.checked);
  });
  panel.addEventListener('keydown', (event) => {
    // a modal dialog closes itself; the desktop dropdown closes here
    if (event.key === 'Escape' && !MOBILE.matches) {
      event.preventDefault();
      closePanel();
    }
  });
  panel.addEventListener('close', () => {
    filterButton.setAttribute('aria-expanded', 'false');
    block.classList.remove('is-filtering');
  });
  document.addEventListener('click', (event) => {
    if (panel.open && !MOBILE.matches && !panel.contains(event.target)
      && !filterButton.contains(event.target)) closePanel(false);
  });
  panelApply.addEventListener('click', () => {
    state.categories = new Set(checkboxes().filter((i) => i.checked && i.name === 'category').map((i) => i.value));
    state.careers = new Set(checkboxes().filter((i) => i.checked && i.name === 'career').map((i) => i.value));
    state.page = 1;
    closePanel();
    render();
  });
  panelClear.addEventListener('click', () => {
    checkboxes().forEach((input) => {
      input.checked = false;
      input.closest('.job-listing-option').classList.remove('is-checked');
    });
  });
  MOBILE.addEventListener('change', () => closePanel(false));

  /* ---- chips ---- */
  chips.addEventListener('click', (event) => {
    const remove = event.target.closest('.job-listing-chip-remove');
    if (!remove) return;
    (remove.dataset.name === 'category' ? state.categories : state.careers).delete(remove.dataset.value);
    state.page = 1;
    render();
    (chips.querySelector('button') || filterButton).focus();
  });
  clearAll.addEventListener('click', () => {
    state.categories.clear();
    state.careers.clear();
    state.page = 1;
    render();
    filterButton.focus();
  });

  /* ---- pagination ---- */
  pagination.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page);
    render();
    list.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    pagination.querySelector('[aria-current="page"]')?.focus();
  });
  MOBILE.addEventListener('change', () => render({ announce: false }));

  render({ announce: false });
}
