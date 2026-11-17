import { moveInstrumentation } from '../../scripts/scripts.js';

const VISIBLE_TABS = 6;
const LABELS = {
  open: 'Show eligibility details',
  close: 'Hide eligibility details',
  more: 'Show More',
  less: 'Show Less',
  select: 'Choose an eligibility parameter',
  previous: 'Previous',
  next: 'Next',
};
const CHEVRON = '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true" focusable="false"><path d="M7.5 5C7.5 5 12.5 8.68 12.5 10C12.5 11.32 7.5 15 7.5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let blockIdx = 0;

const textOf = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const isEmptyCell = (cell) => !textOf(cell) && !cell.querySelector('img, picture');

function decodeLabel(text) {
  const parser = new DOMParser();
  return text.replace(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi, (entity) => (
    parser.parseFromString(entity, 'text/html').body.textContent
  ));
}

function toTh(cell, scope) {
  if (cell.tagName === 'TH') {
    cell.scope = scope;
    return cell;
  }
  const th = document.createElement('th');
  th.scope = scope;
  th.colSpan = cell.colSpan;
  th.rowSpan = cell.rowSpan;
  th.append(...cell.childNodes);
  cell.replaceWith(th);
  return th;
}

/**
 * Merges cells so authors can build the table in the rich-text editor:
 * - an empty cell merges into the cell on its left
 * - identical neighbours merge in header rows, and down the first column
 * Header rows: the <thead>, or the first row plus following rows that repeat
 * its first cell (e.g. "Parameter" twice for a two-row header).
 * @param {HTMLTableElement} table
 */
export function mergeTableCells(table) {
  const rows = [...table.rows];
  if (!rows.length) return;

  let headCount = table.tHead?.rows.length || 0;
  if (!headCount) {
    const first = textOf(rows[0].cells[0]);
    headCount = 1;
    while (headCount < rows.length && first && textOf(rows[headCount].cells[0]) === first) {
      headCount += 1;
    }
  }

  // horizontal merges
  rows.forEach((row, r) => {
    let prev = null;
    [...row.cells].forEach((cell) => {
      const same = r < headCount && prev && textOf(cell) === textOf(prev);
      if (prev && (isEmptyCell(cell) || same)) {
        prev.colSpan += cell.colSpan;
        cell.remove();
      } else {
        prev = cell;
      }
    });
  });

  // vertical merges, tracked by logical column start + span
  const anchors = {};
  const rowHeaders = [];
  rows.forEach((row, r) => {
    const header = r < headCount;
    let col = 0;
    [...row.cells].forEach((cell) => {
      const key = `${col}-${cell.colSpan}`;
      const anchor = anchors[key];
      const text = textOf(cell);
      const mergeable = anchor && anchor.lastRow === r - 1 && anchor.header === header
        && text && text === anchor.text && (header || col === 0);
      if (mergeable) {
        anchor.cell.rowSpan += 1;
        anchor.lastRow = r;
        cell.remove();
      } else {
        anchors[key] = {
          cell, text, header, lastRow: r,
        };
        if (!header && col === 0) rowHeaders.push(cell);
      }
      col += cell.colSpan;
    });
  });

  // semantics: column headers, and the first column as row headers
  rows.slice(0, headCount).forEach((row) => [...row.cells].forEach((cell) => toTh(cell, 'col')));
  rowHeaders.forEach((cell) => toTh(cell, 'row'));

  // mark cells on the outer edges (accounting for spans) so CSS can drop
  // those borders and let the rounded wrapper draw the frame
  const taken = [];
  let totalCols = 0;
  const placed = [];
  rows.forEach((row, r) => {
    taken[r] = taken[r] || [];
    let col = 0;
    [...row.cells].forEach((cell) => {
      while (taken[r][col]) col += 1;
      for (let dr = 0; dr < cell.rowSpan; dr += 1) {
        taken[r + dr] = taken[r + dr] || [];
        for (let dc = 0; dc < cell.colSpan; dc += 1) taken[r + dr][col + dc] = true;
      }
      placed.push({
        cell, r, col,
      });
      col += cell.colSpan;
      totalCols = Math.max(totalCols, col);
    });
  });
  placed.forEach(({ cell, r, col }) => {
    const edges = [];
    if (r === 0) edges.push('top');
    if (col === 0) edges.push('left');
    if (col + cell.colSpan >= totalCols) edges.push('right');
    if (r + cell.rowSpan >= rows.length) edges.push('bottom');
    if (edges.length) cell.dataset.edge = edges.join(' ');
  });

  if (!table.tHead && headCount) {
    const thead = table.createTHead();
    rows.slice(0, headCount).forEach((row) => thead.append(row));
  }
}

/**
 * Values of an Eligibility Row, one per column: list items, paragraphs or the cell itself.
 * @param {Element} cell
 * @returns {Element[]}
 */
function rowValues(cell) {
  if (!cell) return [];
  const list = cell.querySelector('ul, ol');
  if (list) return [...list.children];
  const paragraphs = [...cell.children].filter((el) => el.matches('p, div'));
  return paragraphs.length ? paragraphs : [cell];
}

/**
 * Variation 2: comparison table built from the column headings and Eligibility Rows
 * ([icon] [label] [one value per column]).
 * @param {string[]} columns
 * @param {Element[]} rows
 * @param {string} label accessible name of the scrollable region
 * @returns {HTMLDivElement}
 */
function buildCompareTable(columns, rows, label) {
  const table = document.createElement('table');
  const cols = Math.max(columns.length, ...rows.map((row) => rowValues(row.children[2]).length));
  const head = table.createTHead().insertRow();
  const corner = document.createElement('td');
  corner.className = 'eligibility-tabs-compare-corner';
  head.append(corner);
  for (let i = 0; i < cols; i += 1) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = columns[i] || '';
    head.append(th);
  }
  const body = table.createTBody();
  rows.forEach((row) => {
    const [iconCell, labelCell, valuesCell] = [...row.children];
    const tr = body.insertRow();
    moveInstrumentation(row, tr);
    const th = document.createElement('th');
    th.scope = 'row';
    th.className = 'eligibility-tabs-compare-label';
    const name = document.createElement('div');
    name.className = 'eligibility-tabs-row-label';
    const picture = iconCell?.querySelector('picture');
    if (picture) {
      const img = picture.querySelector('img');
      if (img) {
        img.loading = 'lazy';
        if (!img.alt) img.setAttribute('aria-hidden', 'true');
      }
      name.append(picture);
    }
    const text = document.createElement('span');
    text.textContent = textOf(labelCell);
    name.append(text);
    th.append(name);
    tr.append(th);
    const values = rowValues(valuesCell);
    for (let i = 0; i < cols; i += 1) {
      const td = tr.insertCell();
      td.className = 'eligibility-tabs-compare-value';
      if (values[i]) td.append(...values[i].childNodes);
    }
  });
  const wrap = document.createElement('div');
  wrap.className = 'eligibility-tabs-compare';
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  if (label) wrap.setAttribute('aria-label', label);
  wrap.append(table);
  return wrap;
}

/**
 * loads and decorates the eligibility-tabs block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  blockIdx += 1;
  const prefix = `eligibility-tabs-${blockIdx}`;

  const header = document.createElement('div');
  header.className = 'eligibility-tabs-header';
  const media = document.createElement('div');
  media.className = 'eligibility-tabs-media';
  let expanded = false;
  const items = [];
  const compareRows = [];
  let columns = [];
  let variation = 1;
  if (block.classList.contains('variation-2')) variation = 2;
  if (block.classList.contains('variation-3')) variation = 3;

  [...block.children].forEach((row) => {
    // Eligibility Row items have three cells, tab items two
    if (row.children.length === 3) {
      compareRows.push(row);
      return;
    }
    if (row.children.length > 1) {
      items.push(row);
      return;
    }
    const cell = row.firstElementChild;
    if (!cell) return;
    const picture = cell.querySelector('picture');
    const text = textOf(cell).toLowerCase();
    // settings cell: "open by default" flag, optionally grouped with the column headings
    const isFlag = (value) => value === 'true' || value === 'false';
    const flagEl = [...cell.children].find((el) => isFlag(textOf(el).toLowerCase()));
    const flag = isFlag(text) ? text : textOf(flagEl).toLowerCase();
    const readColumns = (exclude) => {
      const lis = [...cell.querySelectorAll('li')];
      const entries = lis.length ? lis : [...cell.querySelectorAll('p')].filter((el) => el !== exclude);
      return entries.map(textOf).filter(Boolean);
    };
    if (picture && !media.children.length) {
      const img = picture.querySelector('img');
      if (img && !img.alt) img.setAttribute('aria-hidden', 'true');
      media.append(picture);
    } else if (flag) {
      expanded = flag === 'true';
      columns = readColumns(flagEl);
    } else if (text && !header.children.length) {
      moveInstrumentation(cell, header);
      header.append(...cell.childNodes);
    } else if (text) {
      // comparison column headings (variation 2)
      columns = readColumns(null);
      if (!columns.length) columns = [textOf(cell)];
    }
  });

  const heading = header.querySelector('h1, h2, h3, h4, h5, h6');
  const headingText = textOf(heading);

  // variation 2: header + illustration above an always-visible comparison table
  if (variation === 2) {
    const content = [header];
    if (media.children.length) content.push(media);
    if (compareRows.length) content.push(buildCompareTable(columns, compareRows, headingText));
    block.replaceChildren(...content);
    return;
  }

  // body: desktop vertical tabs, mobile select, and the panels
  const body = document.createElement('div');
  body.className = 'eligibility-tabs-body';
  body.id = `${prefix}-body`;

  const nav = document.createElement('div');
  nav.className = 'eligibility-tabs-nav';
  const tablist = document.createElement('div');
  tablist.className = 'eligibility-tabs-list';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-orientation', 'vertical');
  if (headingText) tablist.setAttribute('aria-label', headingText);
  nav.append(tablist);

  const selectWrap = document.createElement('div');
  selectWrap.className = 'eligibility-tabs-select';
  const select = document.createElement('select');
  select.id = `${prefix}-select`;
  const selectLabel = document.createElement('label');
  selectLabel.className = 'eligibility-tabs-visually-hidden';
  selectLabel.htmlFor = select.id;
  selectLabel.textContent = LABELS.select;
  selectWrap.append(selectLabel, select);
  // variation 3 shows the full (wrapping) label in a box the native select sits on top of
  const selectValue = document.createElement('span');
  selectValue.className = 'eligibility-tabs-select-value';
  selectValue.setAttribute('aria-hidden', 'true');
  if (variation === 3) selectWrap.append(selectValue);
  selectWrap.insertAdjacentHTML('beforeend', `<span class="eligibility-tabs-select-icon">${CHEVRON}</span>`);

  const panels = document.createElement('div');
  panels.className = 'eligibility-tabs-panels';

  const tabs = [];
  items.forEach((row, i) => {
    const [labelCell, contentCell] = [...row.children];
    const label = decodeLabel(textOf(labelCell)) || `Tab ${i + 1}`;
    const tabId = `${prefix}-tab-${i + 1}`;
    const panelId = `${prefix}-panel-${i + 1}`;

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = tabId;
    tab.className = 'eligibility-tabs-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panelId);
    tab.innerHTML = `<span></span>${CHEVRON}`;
    tab.querySelector('span').textContent = label;
    if (i >= VISIBLE_TABS) tab.hidden = true;
    tablist.append(tab);
    tabs.push(tab);

    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = label;
    select.append(option);

    const panel = document.createElement('div');
    panel.className = 'eligibility-tabs-panel';
    panel.id = panelId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabId);
    moveInstrumentation(row, panel);
    if (contentCell) panel.append(...contentCell.childNodes);
    panel.querySelectorAll('table').forEach((table) => {
      mergeTableCells(table);
      const wrap = document.createElement('div');
      wrap.className = 'eligibility-tabs-table';
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', label);
      table.replaceWith(wrap);
      wrap.append(table);
    });
    panels.append(panel);
  });

  // variation 3 (mobile): Previous / Next under the content
  let pager = null;
  if (variation === 3 && tabs.length > 1) {
    const wrap = document.createElement('div');
    wrap.className = 'eligibility-tabs-pager';
    const make = (dir, text, icon) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `eligibility-tabs-pager-${dir}`;
      btn.setAttribute('aria-controls', panels.id || `${prefix}-panels`);
      const img = `<img src="${window.hlx.codeBasePath}/icons/${icon}" alt="" width="20" height="20">`;
      btn.innerHTML = dir === 'prev' ? `${img}<span>${text}</span>` : `<span>${text}</span>${img}`;
      wrap.append(btn);
      return btn;
    };
    panels.id = `${prefix}-panels`;
    pager = { wrap, prev: make('prev', LABELS.previous, 'arrow-left.svg'), next: make('next', LABELS.next, 'arrow-right-2.svg') };
  }

  let active = 0;
  const selectTab = (index, focus = false) => {
    active = index;
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels.children[i].hidden = !selected;
    });
    select.value = String(index);
    selectValue.textContent = textOf(tabs[index]);
    if (pager) {
      pager.prev.disabled = index === 0;
      pager.next.disabled = index === tabs.length - 1;
    }
    if (focus) tabs[index].focus();
  };

  tabs.forEach((tab, i) => tab.addEventListener('click', () => selectTab(i)));
  select.addEventListener('change', () => selectTab(Number(select.value)));
  tablist.addEventListener('keydown', (e) => {
    const visible = tabs.filter((tab) => !tab.hidden);
    const pos = visible.indexOf(tabs[active]);
    const moves = {
      ArrowDown: pos + 1,
      ArrowRight: pos + 1,
      ArrowUp: pos - 1,
      ArrowLeft: pos - 1,
      Home: 0,
      End: visible.length - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = visible[(moves[e.key] + visible.length) % visible.length];
    selectTab(tabs.indexOf(next), true);
  });

  if (tabs.length > VISIBLE_TABS) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'eligibility-tabs-more';
    more.setAttribute('aria-expanded', 'false');
    tablist.id = `${prefix}-tablist`;
    more.setAttribute('aria-controls', tablist.id);
    more.innerHTML = `<span>${LABELS.more}</span><img src="/icons/add-circle.svg" alt="add-circle" width="20" height="20">`;
    more.addEventListener('click', () => {
      const show = more.getAttribute('aria-expanded') !== 'true';
      more.setAttribute('aria-expanded', String(show));
      more.querySelector('span').textContent = show ? LABELS.less : LABELS.more;
      const img = more.querySelector('img');
      if (img) {
        const basePath = window.hlx?.codeBasePath || '';
        img.src = `${basePath}/icons/${show ? 'minus-circle.svg' : 'add-circle.svg'}`;
        img.alt = show ? 'minus-circle' : 'add-circle';
      }
      tabs.slice(VISIBLE_TABS).forEach((tab) => { tab.hidden = !show && tab !== tabs[active]; });
    });
    nav.append(more);
  }

  body.append(nav, selectWrap, panels);
  if (pager) {
    const turn = (step) => {
      selectTab(Math.min(tabs.length - 1, Math.max(0, active + step)));
      // keep the newly shown content in view after paging
      if (selectWrap.getBoundingClientRect().top < 0) selectWrap.scrollIntoView({ block: 'start' });
    };
    pager.prev.addEventListener('click', () => turn(-1));
    pager.next.addEventListener('click', () => turn(1));
    body.append(pager.wrap);
  }

  // variation 3: always open, no toggle or illustration
  if (variation === 3) {
    block.replaceChildren(...[header, tabs.length ? body : null].filter(Boolean));
    if (tabs.length) selectTab(0);
    return;
  }

  // collapse / expand the whole section
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'eligibility-tabs-toggle';
  toggle.setAttribute('aria-controls', body.id);
  toggle.innerHTML = '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true" focusable="false"><path d="M15 7.5C15 7.5 11.32 12.5 10 12.5C8.68 12.5 5 7.5 5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const setExpanded = (open) => {
    block.classList.toggle('is-expanded', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? LABELS.close : LABELS.open);
    body.hidden = !open;
  };
  toggle.addEventListener('click', () => setExpanded(!block.classList.contains('is-expanded')));

  // the toggle only makes sense when there are tabs to open
  const content = [header, ...(tabs.length ? [toggle] : [])];
  if (media.children.length) content.push(media);
  if (tabs.length) content.push(body);
  block.replaceChildren(...content);

  if (tabs.length) selectTab(0);
  setExpanded(expanded);
}
