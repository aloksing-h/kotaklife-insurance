import { loadCSS } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { pageList } from '../blog-listing/blog-listing.js';
import decorateVideoCards from '../video-cards/video-cards.js';

/*
 * Media Center: the About us "Our media center" section.
 * Figma 11517:13789 (desktop, press releases, year list open) / 11517:13894 (campaigns),
 * 11517:13847 / 11517:13961 (mobile), 11517:14047 (mobile filter list).
 *
 * Authored rows (Universal Editor), told apart by their number of cells:
 *   1 cell:  the heading, then the labels and settings, in model order
 *   2 cells: Media Tab (tab name, optional anchor); the items after it belong to it
 *   3 cells: Press Release (title, date, document)
 *   5 cells: Campaign (thumbnail, title, description, video, date)
 * Search, the financial year and month filters and pagination work on the authored items.
 * Campaign cards and their video dialog are the Video Cards block, reused as it is.
 */

const LABELS = [
  'text', 'searchPlaceholder', 'searchLabel', 'yearLabel', 'allYearsLabel', 'monthLabel',
  'allMonthsLabel', 'chooseLabel', 'closeLabel', 'downloadLabel', 'resultsLabel', 'emptyMessage',
  'clearLabel', 'pressPageSize', 'campaignPageSize', 'previousLabel', 'nextLabel', 'pageLabel',
  'groupLabel',
];
// used only when an author clears a label, so every control keeps an accessible name
const FALLBACK = {
  searchLabel: 'Search',
  yearLabel: 'Year',
  allYearsLabel: 'All years',
  monthLabel: 'Month',
  allMonthsLabel: 'All months',
  closeLabel: 'Close',
  downloadLabel: 'Download',
  groupLabel: 'Media',
  previousLabel: 'Previous page',
  nextLabel: 'Next page',
  pageLabel: 'Page',
};
const MOBILE = window.matchMedia('(width < 900px)');
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const TIME_ZONE = 'Asia/Kolkata';

let blockCount = 0;

const text = (cell) => cell?.textContent.replace(/\s+/g, ' ').trim() || '';
const fold = (value) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const toTerms = (value) => [...new Set(fold(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean))];
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function element(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content) el.textContent = content;
  return el;
}

function icon(name) {
  const span = element('span', `media-center-icon media-center-icon-${name}`);
  span.setAttribute('aria-hidden', 'true');
  return span;
}

/** The calendar day of a date in India (dates are Indian release dates). */
const dayParts = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: 'numeric', day: 'numeric', timeZone: TIME_ZONE,
});
function indianDate(time) {
  const parts = Object.fromEntries(dayParts.formatToParts(new Date(time))
    .map((part) => [part.type, Number(part.value)]));
  return { year: parts.year, month: parts.month - 1, day: parts.day };
}

/** Financial year (April to March): 12 Jul 2025 -> 2025, shown as "2025 - 26". */
const financialYear = ({ year, month }) => (month >= 3 ? year : year - 1);
const yearLabel = (start) => `${start} - ${String((start + 1) % 100).padStart(2, '0')}`;

function parseDate(value) {
  if (!value) return 0;
  // a bare date (2026-07-12) is a day in India, not midnight UTC
  const time = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T12:00:00+05:30`) : Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

/** Reads the authored rows into labels, tabs and items. */
function readRows(block) {
  const labels = {};
  const tabs = [];
  let labelIndex = 0;
  const currentTab = () => {
    if (!tabs.length) {
      tabs.push({
        row: null, title: '', anchor: '', items: [],
      });
    }
    return tabs[tabs.length - 1];
  };
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length === 1 && labelIndex < LABELS.length) {
      labels[LABELS[labelIndex]] = LABELS[labelIndex] === 'text' ? cells[0] : text(cells[0]);
      labelIndex += 1;
    } else if (cells.length === 2) {
      tabs.push({
        row, title: text(cells[0]), anchor: slug(text(cells[1])), items: [],
      });
    } else if (cells.length === 3) {
      const [title, date, documentCell] = cells;
      const link = documentCell.querySelector('a[href]');
      currentTab().items.push({
        type: 'release',
        row,
        title: text(title),
        time: parseDate(text(date)),
        href: link?.getAttribute('href') || text(documentCell),
      });
    } else if (cells.length >= 5) {
      const [image, title, description, video, date] = cells;
      currentTab().items.push({
        type: 'campaign',
        row,
        cells: {
          image, title, description, video,
        },
        title: text(title),
        description: text(description),
        time: parseDate(text(date)),
      });
    }
  });
  Object.entries(FALLBACK).forEach(([key, value]) => { labels[key] = labels[key] || value; });
  return { labels, tabs: tabs.filter((tab) => tab.items.length || tab.title) };
}

/**
 * A filter button with its list of options: a dropdown under the button on desktop,
 * a full screen list on mobile (Figma 11517:14047). Accessible as a listbox.
 */
function buildDropdown({
  id, label, closeLabel, heading, iconName, onSelect,
}) {
  const wrap = element('div', 'media-center-filter');
  const button = element('button', 'media-center-filter-button');
  button.type = 'button';
  button.id = `${id}-button`;
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  const value = element('span', 'media-center-filter-value');
  button.append(icon(iconName), value, icon('chevron'));

  const panel = element('dialog', 'media-center-filter-panel');
  panel.setAttribute('aria-labelledby', button.id);
  const top = element('div', 'media-center-filter-top');
  const close = element('button', 'media-center-filter-close');
  close.type = 'button';
  close.setAttribute('aria-label', closeLabel);
  close.append(icon('close'));
  top.append(close);
  const title = element('p', 'media-center-filter-heading', heading);
  title.id = `${id}-heading`;
  const list = element('ul', 'media-center-filter-list');
  list.id = `${id}-list`;
  list.tabIndex = -1;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', label);
  panel.id = `${id}-panel`;
  button.setAttribute('aria-controls', panel.id);
  panel.append(top, title, list);
  wrap.append(button, panel);

  let options = [];
  let selected = '';
  let active = 0;

  const setActive = (index) => {
    active = Math.max(0, Math.min(options.length - 1, index));
    options.forEach((option, i) => option.el.classList.toggle('is-active', i === active));
    const option = options[active];
    if (option) {
      list.setAttribute('aria-activedescendant', option.el.id);
      option.el.scrollIntoView({ block: 'nearest' });
    }
  };
  const isOpen = () => panel.open;
  const closePanel = ({ focus = true } = {}) => {
    if (!panel.open) return;
    panel.close();
    button.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
    if (focus) button.focus();
  };
  const openPanel = () => {
    if (MOBILE.matches) panel.showModal();
    else panel.show();
    button.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    setActive(Math.max(0, options.findIndex((option) => option.value === selected)));
    list.focus({ preventScroll: true });
  };
  const choose = (index) => {
    const option = options[index];
    if (!option) return;
    closePanel();
    if (option.value !== selected) onSelect(option.value);
  };

  button.addEventListener('click', () => (isOpen() ? closePanel() : openPanel()));
  close.addEventListener('click', () => closePanel());
  panel.addEventListener('close', () => {
    button.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
  });
  list.addEventListener('click', (event) => {
    const item = event.target.closest('[role="option"]');
    if (item) choose(options.findIndex((option) => option.el === item));
  });
  list.addEventListener('keydown', (event) => {
    const keys = {
      ArrowDown: active + 1,
      ArrowUp: active - 1,
      Home: 0,
      End: options.length - 1,
      PageDown: active + 5,
      PageUp: active - 5,
    };
    if (event.key in keys) {
      event.preventDefault();
      setActive(keys[event.key]);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
    } else if (event.key === 'Tab') {
      closePanel({ focus: false });
    }
  });
  // a click outside the desktop dropdown closes it
  document.addEventListener('click', (event) => {
    if (isOpen() && !MOBILE.matches && !wrap.contains(event.target)) closePanel({ focus: false });
  });
  MOBILE.addEventListener('change', () => closePanel({ focus: false }));

  return {
    wrap,
    /** @param {{value: string, label: string}[]} items the options, the first one clears */
    setOptions(items) {
      list.replaceChildren();
      options = items.map((item, i) => {
        const el = element('li', 'media-center-filter-option', item.label);
        el.id = `${id}-option-${i}`;
        el.setAttribute('role', 'option');
        list.append(el);
        return { ...item, el };
      });
    },
    setValue(nextValue, shown) {
      selected = nextValue;
      value.textContent = shown;
      button.classList.toggle('has-value', nextValue !== '');
      options.forEach((option) => {
        option.el.setAttribute('aria-selected', String(option.value === nextValue));
      });
      button.setAttribute('aria-label', `${label}: ${shown}`);
    },
  };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const { labels, tabs } = readRows(block);
  blockCount += 1;
  const uid = `media-center-${blockCount}`;
  const locale = document.documentElement.lang || 'en-IN';
  const dateParts = new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE,
  });
  const formatDate = (time) => {
    const parts = Object.fromEntries(dateParts.formatToParts(new Date(time))
      .map((part) => [part.type, part.value]));
    return `${parts.day} ${parts.month} ${parts.year}`;
  };
  const monthNames = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat(locale, {
    month: 'long', timeZone: 'UTC',
  }).format(Date.UTC(2026, month, 15)));
  const pageSizes = {
    release: Math.max(1, Number.parseInt(labels.pressPageSize, 10) || 12),
    campaign: Math.max(1, Number.parseInt(labels.campaignPageSize, 10) || 9),
  };
  // campaign cards are the Video Cards block: its styles load with this block
  const videoCardsCss = tabs.some((tab) => tab.items.some((item) => item.type === 'campaign'))
    ? loadCSS(`${window.hlx.codeBasePath}/blocks/video-cards/video-cards.css`) : null;

  tabs.forEach((tab) => {
    tab.items.forEach((item) => {
      if (item.time) Object.assign(item, indianDate(item.time));
      item.terms = fold(`${item.title} ${item.description || ''}`);
    });
    tab.items.sort((a, b) => b.time - a.time);
  });

  /* ---- heading and toolbar (search, financial year, month) ---- */
  const header = element('div', 'media-center-header');
  const heading = labels.text;
  if (heading && text(heading)) {
    const title = heading.querySelector('h1, h2, h3, h4, h5, h6') || element('h2', '', text(heading));
    title.classList.add('media-center-heading');
    header.append(title);
  }
  const tools = element('div', 'media-center-tools');
  const search = element('div', 'media-center-search');
  const searchInput = element('input', 'media-center-search-input');
  searchInput.type = 'search';
  searchInput.id = `${uid}-search`;
  searchInput.placeholder = labels.searchPlaceholder || '';
  searchInput.autocomplete = 'off';
  searchInput.enterKeyHint = 'search';
  searchInput.setAttribute('aria-label', labels.searchLabel);
  search.append(icon('search'), searchInput);
  const filters = element('div', 'media-center-filters');
  tools.append(search, filters);

  const state = {
    tab: 0, year: '', month: '', query: '', page: 1,
  };
  const yearFilter = buildDropdown({
    id: `${uid}-year`,
    label: labels.yearLabel,
    closeLabel: labels.closeLabel,
    heading: labels.chooseLabel,
    iconName: 'calendar',
    // eslint-disable-next-line no-use-before-define
    onSelect: (year) => update({ year, page: 1 }),
  });
  const monthFilter = buildDropdown({
    id: `${uid}-month`,
    label: labels.monthLabel,
    closeLabel: labels.closeLabel,
    heading: labels.chooseLabel,
    iconName: 'calendar',
    // eslint-disable-next-line no-use-before-define
    onSelect: (month) => update({ month, page: 1 }),
  });
  filters.append(yearFilter.wrap, monthFilter.wrap);
  monthFilter.setOptions([
    { value: '', label: labels.allMonthsLabel },
    ...monthNames.map((name, month) => ({ value: String(month), label: name })),
  ]);
  header.append(tools);

  /* ---- tabs: side tabs on desktop, a dropdown (the same tabs under a toggle) on mobile ---- */
  const layout = element('div', 'media-center-layout');
  const body = element('div', 'media-center-body');
  const panels = tabs.map((tab, index) => {
    const panel = element('div', 'media-center-panel');
    panel.id = tab.anchor || `${uid}-panel-${index + 1}`;
    if (tab.row) moveInstrumentation(tab.row, panel);
    body.append(panel);
    return panel;
  });
  const tabButtons = [];
  let nav = null;
  let toggle = null;
  const tabbed = tabs.length > 1 || !!tabs[0]?.title;
  if (tabbed) {
    nav = element('div', 'media-center-nav');
    toggle = element('button', 'media-center-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', labels.groupLabel);
    toggle.append(element('span', 'media-center-toggle-label'), icon('chevron'));
    const tablist = element('div', 'media-center-tabs');
    tablist.id = `${uid}-tabs`;
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-orientation', 'vertical');
    tablist.setAttribute('aria-label', labels.groupLabel);
    toggle.setAttribute('aria-controls', tablist.id);
    tabs.forEach((tab, index) => {
      const button = element('button', 'media-center-tab');
      button.type = 'button';
      button.id = `${panels[index].id}-tab`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panels[index].id);
      button.append(element('span', 'media-center-tab-label', tab.title), icon('tab'));
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', button.id);
      tablist.append(button);
      tabButtons.push(button);
    });
    nav.append(toggle, tablist);
    layout.append(nav);
  } else {
    layout.classList.add('is-single');
  }
  layout.append(body);

  const status = element('p', 'media-center-visually-hidden');
  status.setAttribute('role', 'status');
  const empty = element('div', 'media-center-empty');
  empty.hidden = true;
  const emptyText = element('p', 'media-center-empty-text', labels.emptyMessage);
  const clear = element('button', 'media-center-clear', labels.clearLabel);
  clear.type = 'button';
  empty.append(emptyText, clear);
  const pagination = element('nav', 'media-center-pagination');
  pagination.setAttribute('aria-label', labels.pageLabel);
  pagination.hidden = true;
  body.append(empty, pagination);
  block.replaceChildren(header, layout, status);

  /* ---- filters and results ---- */
  // financial years with items, newest first; the latest is shown first, as in Figma
  const allYears = [...new Set(tabs.flatMap((tab) => tab.items)
    .filter((item) => item.time).map(financialYear))].sort((a, b) => b - a);
  yearFilter.setOptions([
    { value: '', label: labels.allYearsLabel },
    ...allYears.map((year) => ({ value: String(year), label: yearLabel(year) })),
  ]);
  state.year = allYears.length ? String(allYears[0]) : '';

  const matches = (item, terms) => {
    if (state.year && (!item.time || String(financialYear(item)) !== state.year)) return false;
    if (state.month !== '' && (!item.time || String(item.month) !== state.month)) return false;
    return terms.every((term) => item.terms.includes(term));
  };

  const releaseCard = (item) => {
    const card = element('li', 'media-center-release');
    moveInstrumentation(item.row.cloneNode(false), card);
    const link = element('a', 'media-center-release-link');
    if (item.href) {
      link.href = item.href;
      link.target = '_blank';
      link.rel = 'noopener';
    }
    const top = element('div', 'media-center-release-top');
    top.append(icon('document'), icon('download'));
    const title = element('h3', 'media-center-release-title', item.title);
    link.append(top, title);
    if (item.time) {
      const date = element('time', 'media-center-release-date', formatDate(item.time));
      date.dateTime = `${item.year}-${String(item.month + 1).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`;
      link.append(date);
    }
    if (item.href) {
      const hint = element('span', 'media-center-visually-hidden', ` (${labels.downloadLabel})`);
      title.append(hint);
    }
    card.append(link);
    return card;
  };

  // the Video Cards block, built from the campaign items: [thumbnail] [video] [title] [description]
  const campaignCards = (items) => {
    const cards = element('div', 'video-cards block media-center-campaigns');
    items.forEach((item) => {
      const row = element('div');
      moveInstrumentation(item.row.cloneNode(false), row);
      const { cells } = item;
      [cells.image, cells.video, cells.title, cells.description].forEach((cell) => {
        row.append(cell ? cell.cloneNode(true) : element('div'));
      });
      cards.append(row);
    });
    decorateVideoCards(cards);
    cards.dataset.blockStatus = 'loaded';
    return cards;
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
    const prev = pageButton('media-center-page-prev', labels.previousLabel, state.page - 1, state.page === 1);
    prev.append(icon('prev'));
    const next = pageButton('media-center-page-next', labels.nextLabel, state.page + 1, state.page === pages);
    next.append(icon('next'));
    const numbers = element('ol', 'media-center-pages');
    pageList(state.page, pages).forEach((page) => {
      const item = element('li');
      if (page === null) {
        const gap = element('span', 'media-center-page-gap', '…');
        gap.setAttribute('aria-hidden', 'true');
        item.append(gap);
      } else {
        const button = pageButton('media-center-page', `${labels.pageLabel} ${page}`.trim(), page, false);
        button.textContent = String(page);
        if (page === state.page) button.setAttribute('aria-current', 'page');
        item.append(button);
      }
      numbers.append(item);
    });
    pagination.append(prev, numbers, next);
  };

  let firstRender = true;
  async function render() {
    const yearShown = state.year ? yearLabel(Number(state.year)) : labels.allYearsLabel;
    yearFilter.setValue(state.year, yearShown);
    const monthShown = state.month !== '' ? monthNames[Number(state.month)] : labels.monthLabel;
    monthFilter.setValue(state.month, monthShown);
    tabButtons.forEach((button, i) => {
      const selected = i === state.tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.classList.toggle('is-active', selected);
    });
    if (toggle) toggle.querySelector('.media-center-toggle-label').textContent = tabs[state.tab].title;
    panels.forEach((panel, i) => { panel.hidden = i !== state.tab; });

    const tab = tabs[state.tab];
    const terms = toTerms(state.query);
    const found = tab.items.filter((item) => matches(item, terms));
    const type = found[0]?.type || tab.items[0]?.type || 'release';
    const size = pageSizes[type];
    const pages = Math.max(1, Math.ceil(found.length / size));
    state.page = Math.min(state.page, pages);
    const shown = found.slice((state.page - 1) * size, state.page * size);

    const panel = panels[state.tab];
    if (type === 'campaign' && shown.length) {
      await videoCardsCss;
      panel.replaceChildren(campaignCards(shown));
    } else {
      const list = element('ul', 'media-center-releases');
      list.append(...shown.map(releaseCard));
      panel.replaceChildren(...(shown.length ? [list] : []));
    }
    empty.hidden = found.length > 0;
    const filtered = !!(state.query || state.month !== '' || state.year);
    clear.hidden = !filtered;
    renderPagination(found.length ? pages : 0);
    if (!firstRender) status.textContent = (labels.resultsLabel || '').replace('{count}', found.length);
    firstRender = false;
  }

  async function update(changes, { scroll = false } = {}) {
    Object.assign(state, changes);
    await render();
    if (scroll) {
      const { top } = layout.getBoundingClientRect();
      if (top < 0) layout.scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
    }
  }

  /* ---- events ---- */
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = searchInput.value.trim();
      if (query !== state.query) update({ query, page: 1 });
    }, 250);
  });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    clearTimeout(searchTimer);
    update({ query: searchInput.value.trim(), page: 1 });
  });
  clear.addEventListener('click', () => {
    searchInput.value = '';
    update({
      query: '', year: '', month: '', page: 1,
    });
    searchInput.focus();
  });
  pagination.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    await update({ page: Number(button.dataset.page) }, { scroll: true });
    pagination.querySelector('[aria-current="page"]')?.focus();
  });

  if (tabbed) {
    const setToggleOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-expanded', open);
    };
    const selectTab = (index, { focus = false } = {}) => {
      if (index !== state.tab) update({ tab: index, page: 1 });
      if (focus) tabButtons[index].focus();
    };
    tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        selectTab(index);
        if (MOBILE.matches) {
          setToggleOpen(false);
          toggle.focus();
        }
      });
    });
    nav.querySelector('[role="tablist"]').addEventListener('keydown', (event) => {
      const keys = {
        ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1,
      };
      let index = tabButtons.indexOf(document.activeElement);
      if (index < 0) return;
      if (event.key in keys) index = (index + keys[event.key] + tabs.length) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else if (event.key === 'Escape' && MOBILE.matches) {
        event.preventDefault();
        setToggleOpen(false);
        toggle.focus();
        return;
      } else return;
      event.preventDefault();
      selectTab(index, { focus: true });
    });
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      setToggleOpen(open);
      if (open) tabButtons[state.tab].focus();
    });
    document.addEventListener('click', (event) => {
      if (nav.classList.contains('is-expanded') && !nav.contains(event.target)) setToggleOpen(false);
    });
    MOBILE.addEventListener('change', () => setToggleOpen(false));
    // a link to #anchor (on load or later) opens that tab
    const hashIndex = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      return panels.findIndex((panel) => panel.id === hash);
    };
    const fromHash = () => {
      const index = hashIndex();
      if (index >= 0) selectTab(index);
    };
    window.addEventListener('hashchange', fromHash);
    const start = hashIndex();
    if (start > 0) state.tab = start;
  }

  await render();
}
