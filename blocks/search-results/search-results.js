import { createOptimizedPicture } from '../../scripts/aem.js';
import { pageList } from '../blog-listing/blog-listing.js';
import {
  normalise, format, toResults, toTerms, search, SORTERS, parseSortOptions,
} from './search-results-utils.js';

/*
 * Search Results: the search page "Search results" list.
 * Figma Search page 1:1936 (desktop) / 1:1860 (mobile).
 *
 * Results come from the site search index (helix-query.yaml "search", /search-index.json):
 * path, title, description, image, category, lastModified, robots. The keyword is read from
 * ?q= (the header search overlay and the popular searches link here); the page number and
 * sort are kept in the URL too (?page=, ?sort=), so results can be shared and Back works.
 *
 * Authored rows (1 cell each, in this order): search index, placeholder, field label,
 * button label, sort label, sort options, results count, one result count, no results
 * message, empty search message, results per page, previous / next / page labels.
 */

const LABELS = [
  'source', 'searchPlaceholder', 'searchLabel', 'submitLabel', 'sortLabel', 'sortOptions',
  'resultsLabel', 'resultLabel', 'emptyMessage', 'promptMessage', 'pageSize', 'previousLabel', 'nextLabel',
  'pageLabel',
];
const INDEX_CHUNK = 1000;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

let blockCount = 0;
const indexes = new Map();

function element(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content) el.textContent = content;
  return el;
}

function icon(name) {
  const span = element('span', `search-results-icon search-results-icon-${name}`);
  span.setAttribute('aria-hidden', 'true');
  return span;
}

/** Loads the whole index once per page (it is shared by every Search Results block). */
function loadIndex(source) {
  if (!indexes.has(source)) {
    const load = async () => {
      const rows = [];
      let offset = 0;
      let total = Infinity;
      while (offset < total) {
        const url = new URL(source, window.location.href);
        url.searchParams.set('offset', offset);
        url.searchParams.set('limit', INDEX_CHUNK);
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(url);
        if (!response.ok) throw new Error(`search index ${response.status}`);
        // eslint-disable-next-line no-await-in-loop
        const json = await response.json();
        const data = Array.isArray(json.data) ? json.data : [];
        rows.push(...data);
        total = Number.isFinite(json.total) ? json.total : rows.length;
        if (!data.length) break;
        offset += data.length;
      }
      return rows;
    };
    indexes.set(source, load().catch((error) => {
      indexes.delete(source);
      throw error;
    }));
  }
  return indexes.get(source);
}

/** Text with the searched words in bold (built from text nodes, so it is safe). */
function highlight(text, terms) {
  const fragment = document.createDocumentFragment();
  if (!terms.length) {
    fragment.append(text);
    return fragment;
  }
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  text.split(pattern).forEach((part, i) => {
    if (!part) return;
    if (i % 2) fragment.append(element('strong', 'search-results-match', part));
    else fragment.append(part);
  });
  return fragment;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const cells = [...block.children].map((row) => row.firstElementChild);
  const config = Object.fromEntries(LABELS.map((key, i) => [key, cells[i]]));
  const text = (key) => normalise(config[key]?.textContent);
  const source = config.source?.querySelector('a')?.getAttribute('href') || text('source') || '/search-index.json';
  const labels = Object.fromEntries(LABELS.map((key) => [key, text(key)]));
  const pageSize = Math.max(1, Number.parseInt(labels.pageSize, 10) || 5);
  const sortOptions = parseSortOptions(labels.sortOptions);
  const locale = document.documentElement.lang || 'en-IN';
  const dateParts = new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
  const formatDate = (time) => {
    const parts = Object.fromEntries(dateParts.formatToParts(new Date(time))
      .map((part) => [part.type, part.value]));
    return `${parts.day} ${parts.month} ${parts.year}`;
  };
  const numberFormat = new Intl.NumberFormat(locale);

  blockCount += 1;
  const uid = `search-results-${blockCount}`;

  /* ---- search bar: keyword and sort ---- */
  const form = element('form', 'search-results-form');
  form.setAttribute('role', 'search');
  form.noValidate = true;
  const field = element('div', 'search-results-field');
  const inputId = `${uid}-input`;
  const inputLabel = element('label', 'search-results-visually-hidden', labels.searchLabel);
  inputLabel.htmlFor = inputId;
  const input = element('input', 'search-results-input');
  input.type = 'search';
  input.id = inputId;
  input.name = 'q';
  input.placeholder = labels.searchPlaceholder;
  input.autocomplete = 'off';
  input.enterKeyHint = 'search';
  input.spellcheck = false;
  const submit = element('button', 'search-results-submit');
  submit.type = 'submit';
  submit.setAttribute('aria-label', labels.submitLabel || labels.searchLabel);
  submit.append(icon('search'));
  // the field first, then its search button (shown as the icon at the start)
  field.append(inputLabel, input, submit);

  const sort = element('div', 'search-results-sort');
  sort.hidden = sortOptions.length < 2;
  const select = element('select', 'search-results-sort-select');
  select.name = 'sort';
  select.setAttribute('aria-label', labels.sortLabel);
  sortOptions.forEach((option) => select.append(new Option(option.label, option.value)));
  sort.append(icon('sort'), select, icon('chevron'));
  form.append(field, sort);

  const status = element('p', 'search-results-status');
  status.setAttribute('role', 'status');
  status.id = `${uid}-status`;
  const list = element('ol', 'search-results-list');
  list.setAttribute('aria-labelledby', status.id);
  const pagination = element('nav', 'search-results-pagination');
  pagination.setAttribute('aria-label', labels.pageLabel || labels.searchLabel);
  pagination.hidden = true;
  block.replaceChildren(form, status, list, pagination);

  /* ---- state (kept in the URL) ---- */
  const defaultSort = sortOptions[0].value;
  const readState = () => {
    const params = new URLSearchParams(window.location.search);
    const sortValue = (params.get('sort') || '').toLowerCase();
    return {
      query: normalise(params.get('q')),
      page: Math.max(1, Number.parseInt(params.get('page'), 10) || 1),
      sort: sortOptions.some((option) => option.value === sortValue) ? sortValue : defaultSort,
    };
  };
  let state = readState();
  let rendered = '';

  const writeState = (next, { replace = false } = {}) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    url.searchParams.delete('page');
    url.searchParams.delete('sort');
    if (next.query) url.searchParams.set('q', next.query);
    if (next.sort !== defaultSort) url.searchParams.set('sort', next.sort);
    if (next.page > 1) url.searchParams.set('page', String(next.page));
    if (url.href === window.location.href) return;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
  };

  const card = (result, terms) => {
    const item = element('li', 'search-results-item');
    const head = element('div', 'search-results-head');
    if (result.category) {
      const category = element('p', 'search-results-category');
      category.append(icon('home'), element('span', '', `/ ${result.category}`));
      head.append(category);
    }
    const title = element('h2', 'search-results-title');
    const link = element('a', 'search-results-link');
    link.href = result.path;
    link.append(highlight(result.title, terms));
    title.append(link);
    head.append(title);
    item.append(head);
    if (result.description) {
      const description = element('p', 'search-results-description');
      description.append(highlight(result.description, terms));
      item.append(description);
    }
    if (result.time) {
      const date = element('p', 'search-results-date');
      const time = element('time', '', formatDate(result.time));
      time.dateTime = new Date(result.time).toISOString().slice(0, 10);
      date.append(icon('calendar'), time);
      item.append(date);
    }
    if (result.image) {
      const visual = element('div', 'search-results-visual');
      visual.append(createOptimizedPicture(result.image, '', false, [{ width: '400' }]));
      item.append(visual);
      item.classList.add('has-image');
    }
    return item;
  };

  const pageButton = (className, label, page, disabled) => {
    const button = element('button', className);
    button.type = 'button';
    button.dataset.page = String(page);
    button.setAttribute('aria-label', label);
    button.disabled = disabled;
    return button;
  };

  const renderPagination = (pages) => {
    pagination.replaceChildren();
    pagination.hidden = pages < 2;
    if (pages < 2) return;
    const prev = pageButton('search-results-page-prev', labels.previousLabel, state.page - 1, state.page === 1);
    prev.append(icon('prev'));
    const next = pageButton('search-results-page-next', labels.nextLabel, state.page + 1, state.page === pages);
    next.append(icon('next'));
    const numbers = element('ol', 'search-results-pages');
    pageList(state.page, pages).forEach((page) => {
      const item = element('li');
      if (page === null) {
        const gap = element('span', 'search-results-page-gap', '…');
        gap.setAttribute('aria-hidden', 'true');
        item.append(gap);
      } else {
        const button = pageButton('search-results-page', `${labels.pageLabel} ${page}`.trim(), page, false);
        button.textContent = String(page);
        if (page === state.page) button.setAttribute('aria-current', 'page');
        item.append(button);
      }
      numbers.append(item);
    });
    pagination.append(prev, numbers, next);
  };

  const setStatus = (message, query) => {
    status.replaceChildren();
    if (query === undefined) {
      status.textContent = message;
      return;
    }
    // the keyword in bold, as in Figma ("1,170 Results Found for “Pay Premium”")
    message.split(/(\{query\})/).forEach((part) => {
      if (part === '{query}') status.append(element('strong', '', query));
      else if (part) status.append(part);
    });
  };

  async function render({ scroll = false } = {}) {
    const key = JSON.stringify(state);
    if (key === rendered) return;
    rendered = key;
    input.value = state.query;
    select.value = state.sort;
    block.classList.remove('is-error');

    if (!state.query) {
      list.replaceChildren();
      renderPagination(0);
      setStatus(labels.promptMessage);
      block.classList.add('is-prompt');
      return;
    }
    block.classList.remove('is-prompt');
    block.setAttribute('aria-busy', 'true');
    let results;
    try {
      results = toResults(await loadIndex(source));
    } catch {
      rendered = '';
      block.removeAttribute('aria-busy');
      block.classList.add('is-error');
      setStatus(format(labels.emptyMessage, { count: 0 }), state.query);
      list.replaceChildren();
      renderPagination(0);
      return;
    }
    // a newer search has started while the index loaded
    if (key !== JSON.stringify(state)) return;
    block.removeAttribute('aria-busy');

    const found = search(results, state.query).sort(SORTERS[state.sort]);
    const pages = Math.ceil(found.length / pageSize);
    if (state.page > pages && pages) {
      state = { ...state, page: pages };
      writeState(state, { replace: true });
      rendered = '';
      render({ scroll });
      return;
    }
    const terms = toTerms(state.query).sort((a, b) => b.length - a.length);
    const shown = found.slice((state.page - 1) * pageSize, state.page * pageSize);
    list.replaceChildren(...shown.map((result) => card(result, terms)));
    if (found.length) {
      const count = numberFormat.format(found.length);
      const one = found.length === 1 && labels.resultLabel;
      const template = one ? labels.resultLabel : labels.resultsLabel;
      setStatus(format(template, { count }), state.query);
    } else {
      setStatus(format(labels.emptyMessage, { count: 0 }), state.query);
    }
    block.classList.toggle('is-empty', !found.length);
    renderPagination(pages);
    if (scroll) {
      const { top } = block.getBoundingClientRect();
      if (top < 0) block.scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
    }
  }

  const go = (next, options) => {
    state = next;
    writeState(state);
    render(options);
  };

  /* ---- events ---- */
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = normalise(input.value);
    if (!query) {
      input.value = '';
      input.focus();
      return;
    }
    // a new search starts on page 1
    go({ ...state, query, page: 1 });
  });
  select.addEventListener('change', () => go({ ...state, sort: select.value, page: 1 }));
  pagination.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    go({ ...state, page: Number(button.dataset.page) }, { scroll: true });
    pagination.querySelector('[aria-current="page"]')?.focus();
  });
  // links to this page with ?q= (popular searches) search here without reloading
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey
      || event.shiftKey || link.target === '_blank') return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname
      || !url.searchParams.has('q')) return;
    const query = normalise(url.searchParams.get('q'));
    if (!query) return;
    event.preventDefault();
    go({ ...state, query, page: 1 });
    block.scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
  });
  window.addEventListener('popstate', () => {
    state = readState();
    render();
  });

  // the URL keeps only the parameters this block uses
  writeState(state, { replace: true });
  render();
}
