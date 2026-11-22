import { moveInstrumentation } from '../../scripts/scripts.js';
import { icon, pageList } from '../blog-listing/blog-listing.js';

/*
 * Download Center: How do I "Download center" product documents.
 * Figma How do I: Policy brochure 1:3911 (desktop) / 1:4064 (mobile), filter open
 * 1:3962 / 1:4155, filter applied 1:4013 / 1:4108.
 *
 * Authored rows (Universal Editor), told apart by their number of cells:
 *   1 cell:  the heading, then the labels and settings, in model order (LABELS)
 *   2 cells: Download Tab (tab name, optional anchor); the documents after it belong to it
 *   4 cells: Download Document (title, topic, document link, date)
 * Side tabs on desktop, a dropdown on mobile; search, a topic filter (checkboxes with Apply,
 * a dropdown on desktop and a full screen list on mobile), the applied topics as chips,
 * newest / oldest sorting and pagination work on the authored documents.
 * The filter, chips and pagination follow the Blog Listing block (its icons and pageList).
 */

const LABELS = [
  'text', 'searchPlaceholder', 'searchLabel', 'filterLabel', 'chooseLabel', 'topics',
  'applyLabel', 'applyMobileLabel', 'filteredLabel', 'clearLabel', 'sortLabel', 'newestLabel',
  'oldestLabel', 'closeLabel', 'downloadLabel', 'emptyMessage', 'pageSize', 'previousLabel',
  'nextLabel', 'pageLabel', 'groupLabel', 'resultsLabel',
];
// used when an author leaves a label empty, so every control keeps a name
const FALLBACK = {
  searchPlaceholder: 'Search...',
  searchLabel: 'Search documents',
  filterLabel: 'Filter by',
  chooseLabel: 'Choose topic',
  applyLabel: 'Apply',
  applyMobileLabel: 'Apply Filter',
  filteredLabel: 'Filtered by',
  clearLabel: 'Clear All',
  sortLabel: 'Sort by',
  newestLabel: 'Newest',
  oldestLabel: 'Oldest',
  closeLabel: 'Close',
  downloadLabel: 'Download',
  emptyMessage: 'No documents match your search.',
  previousLabel: 'Previous page',
  nextLabel: 'Next page',
  pageLabel: 'Page',
  groupLabel: 'Document type',
  resultsLabel: '{count} documents found',
};
const MOBILE = window.matchMedia('(width < 900px)');
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

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

function parseDate(value) {
  if (!value) return 0;
  const time = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T12:00:00+05:30`) : Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

/** Reads the authored rows into labels, tabs and documents. */
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
  [...block.children].forEach((row, index) => {
    const cells = [...row.children];
    if (cells.length === 1 && labelIndex < LABELS.length) {
      const key = LABELS[labelIndex];
      if (key === 'text') [labels.text] = cells;
      else if (key === 'topics') {
        const entries = [...cells[0].querySelectorAll('li')];
        const lines = entries.length ? entries : [...cells[0].querySelectorAll('p')];
        labels.topics = (lines.length ? lines.map(text) : text(cells[0]).split(','))
          .map((topic) => topic.trim()).filter(Boolean);
      } else labels[key] = text(cells[0]);
      labelIndex += 1;
    } else if (cells.length === 2) {
      tabs.push({
        row, title: text(cells[0]), anchor: slug(text(cells[1])), items: [],
      });
    } else if (cells.length >= 4) {
      const [title, topic, documentCell, date] = cells;
      const link = documentCell.querySelector('a[href]');
      currentTab().items.push({
        row,
        order: index,
        title: text(title),
        topic: text(topic),
        href: link?.getAttribute('href') || text(documentCell),
        time: parseDate(text(date)),
      });
    }
  });
  Object.entries(FALLBACK).forEach(([key, value]) => { labels[key] = labels[key] || value; });
  labels.topics = labels.topics || [];
  return { labels, tabs: tabs.filter((tab) => tab.items.length || tab.title) };
}

/**
 * The topic an item belongs to: the filter option that is its topic, or starts with it
 * (a document tagged "Protection" is in "Protection Plans").
 */
function topicMatches(option, topic) {
  const a = fold(option);
  const b = fold(topic);
  return !!b && (a === b || a.startsWith(`${b} `));
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const { labels, tabs } = readRows(block);
  blockCount += 1;
  const uid = `download-center-${blockCount}`;
  const pageSize = Math.max(1, Number.parseInt(labels.pageSize, 10) || 8);
  tabs.forEach((tab) => tab.items.forEach((item) => {
    item.terms = fold(`${item.title} ${item.topic}`);
  }));
  // the topics to choose from: the authored list, else the topics of the documents
  const topics = labels.topics.length ? labels.topics
    : [...new Set(tabs.flatMap((tab) => tab.items.map((item) => item.topic)).filter(Boolean))];
  // chip text: the documents' own tag for that topic (Protection), else the topic name
  const chipText = (option) => tabs.flatMap((tab) => tab.items)
    .find((item) => topicMatches(option, item.topic))?.topic || option;

  /* ---- heading and toolbar (search, filter, sort) ---- */
  const header = element('div', 'download-center-header');
  if (labels.text && text(labels.text)) {
    const title = labels.text.querySelector('h1, h2, h3, h4, h5, h6') || element('h2', '', text(labels.text));
    title.classList.add('download-center-heading');
    moveInstrumentation(labels.text, title);
    header.append(title);
  }
  const tools = element('div', 'download-center-tools');
  const search = element('label', 'download-center-search');
  const searchInput = element('input', 'download-center-search-input');
  searchInput.type = 'search';
  searchInput.placeholder = labels.searchPlaceholder;
  searchInput.autocomplete = 'off';
  searchInput.enterKeyHint = 'search';
  searchInput.setAttribute('aria-label', labels.searchLabel);
  search.append(icon('search'), searchInput);

  // topic filter: a toggle and its panel (dropdown on desktop, full screen on mobile)
  const filter = element('div', 'download-center-filter');
  const toggle = element('button', 'download-center-filter-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', `${uid}-panel`);
  const count = element('span', 'download-center-filter-count');
  count.hidden = true;
  count.setAttribute('aria-hidden', 'true');
  toggle.append(
    icon('filter', { class: 'download-center-filter-icon' }),
    element('span', '', labels.filterLabel),
    icon('chevron', { class: 'download-center-filter-chevron' }),
    count,
  );
  const panel = element('div', 'download-center-panel');
  panel.id = `${uid}-panel`;
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', `${uid}-choose`);
  const close = element('button', 'download-center-panel-close');
  close.type = 'button';
  close.setAttribute('aria-label', labels.closeLabel);
  close.append(icon('close'));
  const group = element('fieldset', 'download-center-topics');
  const legend = element('legend', 'download-center-topics-title', labels.chooseLabel);
  legend.id = `${uid}-choose`;
  const options = element('div', 'download-center-options');
  const checkboxes = topics.map((topic, i) => {
    const option = element('label', 'download-center-option');
    const box = element('input');
    box.type = 'checkbox';
    box.value = topic;
    box.id = `${uid}-topic-${i}`;
    option.append(box, element('span', 'download-center-checkbox'), element('span', '', topic));
    options.append(option);
    return box;
  });
  group.append(legend, options);
  const apply = element('button', 'download-center-apply');
  apply.type = 'button';
  apply.append(
    element('span', 'download-center-apply-short', labels.applyLabel),
    element('span', 'download-center-apply-long', labels.applyMobileLabel),
  );
  panel.append(close, group, apply);
  filter.append(toggle, panel);

  // sort: a native select drawn as the pill (keyboard and screen reader friendly)
  const sort = element('label', 'download-center-sort');
  const sortSelect = element('select', 'download-center-sort-select');
  sortSelect.setAttribute('aria-label', labels.sortLabel);
  [['newest', labels.newestLabel], ['oldest', labels.oldestLabel]].forEach(([value, label]) => {
    const option = element('option', '', label);
    option.value = value;
    sortSelect.append(option);
  });
  sort.append(element('span', 'download-center-sort-icon'), sortSelect, icon('chevron', { class: 'download-center-sort-chevron' }));
  if (!topics.length) filter.hidden = true;
  tools.append(search, filter, sort);
  header.append(tools);

  // applied topics
  const applied = element('div', 'download-center-applied');
  applied.hidden = true;
  const chips = element('ul', 'download-center-chips');
  const clearAll = element('button', 'download-center-clear', labels.clearLabel);
  clearAll.type = 'button';
  applied.append(element('span', 'download-center-applied-label', labels.filteredLabel), chips, clearAll);

  /* ---- tabs: side tabs on desktop, a dropdown on mobile ---- */
  const layout = element('div', 'download-center-layout');
  const body = element('div', 'download-center-body');
  const panels = tabs.map((tab, index) => {
    const tabPanel = element('div', 'download-center-tabpanel');
    tabPanel.id = tab.anchor || `${uid}-tab-panel-${index + 1}`;
    if (tab.row) moveInstrumentation(tab.row, tabPanel);
    body.append(tabPanel);
    return tabPanel;
  });
  const tabButtons = [];
  let nav = null;
  let tabToggle = null;
  const tabbed = tabs.length > 1 || !!tabs[0]?.title;
  if (tabbed) {
    nav = element('div', 'download-center-nav');
    tabToggle = element('button', 'download-center-tab-toggle');
    tabToggle.type = 'button';
    tabToggle.setAttribute('aria-expanded', 'false');
    tabToggle.setAttribute('aria-label', labels.groupLabel);
    tabToggle.append(element('span', 'download-center-tab-toggle-label'), icon('chevron', { class: 'download-center-tab-toggle-chevron' }));
    const tablist = element('div', 'download-center-tabs');
    tablist.id = `${uid}-tabs`;
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-orientation', 'vertical');
    tablist.setAttribute('aria-label', labels.groupLabel);
    tabToggle.setAttribute('aria-controls', tablist.id);
    tabs.forEach((tab, index) => {
      const button = element('button', 'download-center-tab');
      button.type = 'button';
      button.id = `${panels[index].id}-tab`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panels[index].id);
      button.append(element('span', 'download-center-tab-label', tab.title), icon('next', { class: 'download-center-tab-icon' }));
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', button.id);
      tablist.append(button);
      tabButtons.push(button);
    });
    nav.append(tabToggle, tablist);
    layout.append(nav);
  } else {
    layout.classList.add('is-single');
  }
  layout.append(body);

  const status = element('p', 'download-center-visually-hidden');
  status.setAttribute('role', 'status');
  const empty = element('div', 'download-center-empty');
  empty.hidden = true;
  const clearEmpty = element('button', 'download-center-empty-clear', labels.clearLabel);
  clearEmpty.type = 'button';
  empty.append(element('p', 'download-center-empty-text', labels.emptyMessage), clearEmpty);
  const pagination = element('nav', 'download-center-pagination');
  pagination.setAttribute('aria-label', labels.pageLabel);
  pagination.hidden = true;
  body.append(empty, pagination);
  block.replaceChildren(header, applied, layout, status);

  /* ---- state and rendering ---- */
  const state = {
    tab: 0, query: '', topics: new Set(), sort: 'newest', page: 1,
  };

  const card = (item) => {
    const li = element('li', 'download-center-card');
    moveInstrumentation(item.row.cloneNode(false), li);
    const link = element('a', 'download-center-card-link');
    if (item.href) {
      link.href = item.href;
      link.target = '_blank';
      link.rel = 'noopener';
    }
    const top = element('span', 'download-center-card-top');
    top.append(
      element('span', 'download-center-card-icon'),
      element('span', 'download-center-card-download'),
    );
    link.append(top);
    if (item.topic) link.append(element('span', 'download-center-card-tag', item.topic));
    const title = element('h3', 'download-center-card-title', item.title);
    if (item.href) title.append(element('span', 'download-center-visually-hidden', ` (${labels.downloadLabel})`));
    link.append(title);
    li.append(link);
    return li;
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
    const prev = pageButton('download-center-page-step download-center-page-prev', labels.previousLabel, state.page - 1, state.page === 1);
    prev.append(icon('prev'));
    const next = pageButton('download-center-page-step download-center-page-next', labels.nextLabel, state.page + 1, state.page === pages);
    next.append(icon('next'));
    const numbers = element('ol', 'download-center-pages');
    pageList(state.page, pages).forEach((page) => {
      const item = element('li');
      if (page === null) {
        const gap = element('span', 'download-center-page-gap', '…');
        gap.setAttribute('aria-hidden', 'true');
        item.append(gap);
      } else {
        const button = pageButton('download-center-page', `${labels.pageLabel} ${page}`, page, false);
        button.textContent = String(page);
        if (page === state.page) button.setAttribute('aria-current', 'page');
        item.append(button);
      }
      numbers.append(item);
    });
    pagination.append(prev, numbers, next);
  };

  const renderChips = () => {
    chips.replaceChildren(...[...state.topics].map((topic) => {
      const li = element('li', 'download-center-chip');
      const remove = element('button', 'download-center-chip-remove');
      remove.type = 'button';
      remove.dataset.topic = topic;
      remove.setAttribute('aria-label', `Remove filter: ${chipText(topic)}`);
      remove.append(element('span', '', chipText(topic)), icon('remove'));
      li.append(remove);
      return li;
    }));
    applied.hidden = !state.topics.size;
    count.hidden = !state.topics.size;
    count.textContent = String(state.topics.size);
    toggle.setAttribute('aria-label', state.topics.size
      ? `${labels.filterLabel}, ${state.topics.size} applied` : labels.filterLabel);
  };

  let firstRender = true;
  const render = () => {
    tabButtons.forEach((button, i) => {
      const selected = i === state.tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.classList.toggle('is-active', selected);
    });
    if (tabToggle) tabToggle.querySelector('.download-center-tab-toggle-label').textContent = tabs[state.tab].title;
    panels.forEach((tabPanel, i) => { tabPanel.hidden = i !== state.tab; });
    renderChips();

    const terms = toTerms(state.query);
    const chosen = [...state.topics];
    const found = (tabs[state.tab]?.items || []).filter((item) => (
      (!chosen.length || chosen.some((topic) => topicMatches(topic, item.topic)))
      && terms.every((term) => item.terms.includes(term))));
    // newest first (authored order when there are no dates), oldest reverses it
    found.sort((x, y) => (y.time - x.time) || (x.order - y.order));
    if (state.sort === 'oldest') found.reverse();
    const pages = Math.max(1, Math.ceil(found.length / pageSize));
    state.page = Math.min(state.page, pages);
    const shown = found.slice((state.page - 1) * pageSize, state.page * pageSize);
    const list = element('ul', 'download-center-cards');
    list.append(...shown.map(card));
    if (panels[state.tab]) panels[state.tab].replaceChildren(...(shown.length ? [list] : []));
    empty.hidden = found.length > 0;
    clearEmpty.hidden = !(state.query || state.topics.size);
    renderPagination(found.length ? pages : 0);
    if (!firstRender) status.textContent = labels.resultsLabel.replace('{count}', found.length);
    firstRender = false;
  };

  const update = (changes, { scroll = false } = {}) => {
    Object.assign(state, changes);
    render();
    if (scroll && layout.getBoundingClientRect().top < 0) {
      layout.scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
    }
  };

  /* ---- filter panel ---- */
  const isOpen = () => !panel.hidden;
  const closePanel = ({ focus = true } = {}) => {
    if (!isOpen()) return;
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    block.classList.remove('is-filter-open');
    document.body.classList.remove('download-center-locked');
    panel.removeAttribute('aria-modal');
    if (focus) toggle.focus();
  };
  const openPanel = () => {
    // the boxes show the applied topics each time the panel opens
    checkboxes.forEach((box) => { box.checked = state.topics.has(box.value); });
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    block.classList.add('is-filter-open');
    if (MOBILE.matches) {
      panel.setAttribute('aria-modal', 'true');
      document.body.classList.add('download-center-locked');
    }
    (checkboxes[0] || apply).focus();
  };
  toggle.addEventListener('click', () => (isOpen() ? closePanel() : openPanel()));
  close.addEventListener('click', () => closePanel());
  apply.addEventListener('click', () => {
    const chosen = checkboxes.filter((box) => box.checked).map((box) => box.value);
    closePanel();
    update({ topics: new Set(chosen), page: 1 });
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
      return;
    }
    // the full screen list keeps the focus inside it
    if (event.key === 'Tab' && MOBILE.matches) {
      const focusable = [close, ...checkboxes, apply];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  document.addEventListener('click', (event) => {
    if (isOpen() && !MOBILE.matches && !filter.contains(event.target)) closePanel({ focus: false });
  });
  MOBILE.addEventListener('change', () => closePanel({ focus: false }));

  /* ---- other events ---- */
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
  sortSelect.addEventListener('change', () => update({ sort: sortSelect.value, page: 1 }));
  chips.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-topic]');
    if (!remove) return;
    const next = new Set(state.topics);
    next.delete(remove.dataset.topic);
    update({ topics: next, page: 1 });
    (chips.querySelector('button') || toggle).focus();
  });
  clearAll.addEventListener('click', () => {
    update({ topics: new Set(), page: 1 });
    toggle.focus();
  });
  clearEmpty.addEventListener('click', () => {
    searchInput.value = '';
    update({ query: '', topics: new Set(), page: 1 });
    searchInput.focus();
  });
  pagination.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    update({ page: Number(button.dataset.page) }, { scroll: true });
    pagination.querySelector('[aria-current="page"]')?.focus();
  });

  if (tabbed) {
    const setToggleOpen = (open) => {
      tabToggle.setAttribute('aria-expanded', String(open));
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
          tabToggle.focus();
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
        tabToggle.focus();
        return;
      } else return;
      event.preventDefault();
      selectTab(index, { focus: true });
    });
    tabToggle.addEventListener('click', () => {
      const open = tabToggle.getAttribute('aria-expanded') !== 'true';
      setToggleOpen(open);
      if (open) tabButtons[state.tab].focus();
    });
    document.addEventListener('click', (event) => {
      if (nav.classList.contains('is-expanded') && !nav.contains(event.target)) setToggleOpen(false);
    });
    MOBILE.addEventListener('change', () => setToggleOpen(false));
    // a link to #anchor opens that tab
    const hashIndex = () => panels.findIndex((tabPanel) => tabPanel.id
      === decodeURIComponent(window.location.hash.slice(1)));
    window.addEventListener('hashchange', () => {
      const index = hashIndex();
      if (index >= 0) selectTab(index);
    });
    const start = hashIndex();
    if (start > 0) state.tab = start;
  }

  render();
}
