import { moveInstrumentation } from '../../scripts/scripts.js';

/*
 * Report Cards: CSR "Kotak Life CSR impact assessment reports".
 * Figma CSR 12130:9352 (desktop) / 12130:9443 (mobile).
 *
 * Authored rows (Universal Editor), told apart by their number of cells:
 *   1 cell:  the heading and description, then the labels in model order (LABELS)
 *   2 cells: Report Category (name, optional anchor); the reports after it belong to it
 *   4 cells: Report (document link with the report name, category, report code, location)
 * Category tabs (a pill bar that scrolls on mobile), report cards that link to their
 * document, four a row on desktop; on mobile the first four show, with Show More.
 */

const LABELS = ['tabsLabel', 'moreLabel', 'lessLabel'];
// used only when an author clears a label, so every control keeps an accessible name
const FALLBACK = { tabsLabel: 'Report categories', moreLabel: 'Show More', lessLabel: 'Show Less' };
const MOBILE_VISIBLE = 4;

let blockCount = 0;

const text = (cell) => cell?.textContent.trim() || '';
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function element(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content) el.textContent = content;
  return el;
}

/** Reads the authored rows into the header, labels and categories. */
function readRows(block) {
  const labels = {};
  const categories = [];
  let header = null;
  let labelIndex = -1;
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length === 1) {
      if (labelIndex === -1) [header] = cells;
      else if (labelIndex < LABELS.length) labels[LABELS[labelIndex]] = text(cells[0]);
      labelIndex += 1;
    } else if (cells.length === 2) {
      categories.push({
        row, title: text(cells[0]), anchor: slug(text(cells[1])), reports: [],
      });
    } else if (cells.length >= 4) {
      if (!categories.length) {
        categories.push({
          row: null, title: '', anchor: '', reports: [],
        });
      }
      const [documentCell, category, code, location] = cells;
      const link = documentCell.querySelector('a[href]');
      categories[categories.length - 1].reports.push({
        row,
        href: link?.getAttribute('href') || '',
        title: text(link) || text(documentCell),
        category: text(category),
        code: text(code),
        location: text(location),
      });
    }
  });
  LABELS.forEach((key) => { labels[key] = labels[key] || FALLBACK[key]; });
  return { header, labels, categories: categories.filter((c) => c.reports.length) };
}

/** One report card; the title is the link and covers the whole card. */
function buildCard(report) {
  const card = element('li', 'report-cards-card');
  if (report.row) moveInstrumentation(report.row, card);

  const top = element('div', 'report-cards-top');
  const icon = element('span', 'report-cards-icon');
  icon.setAttribute('aria-hidden', 'true');
  const download = element('span', 'report-cards-download');
  download.setAttribute('aria-hidden', 'true');
  top.append(icon, download);

  const title = element('h3', 'report-cards-title');
  if (report.href) {
    const link = element('a', 'report-cards-link', report.title);
    link.href = report.href;
    title.append(link);
  } else {
    title.textContent = report.title;
  }

  const body = element('div', 'report-cards-body');
  body.append(title);
  if (report.category) body.append(element('p', 'report-cards-category', report.category));

  const facts = element('ul', 'report-cards-facts');
  if (report.code) facts.append(element('li', 'report-cards-code', report.code));
  if (report.location) facts.append(element('li', 'report-cards-location', report.location));

  card.append(top, body);
  if (facts.children.length) card.append(facts);
  return card;
}

/** Arrow keys, Home and End move between the tabs (automatic activation). */
function bindTabKeys(tabs, select) {
  tabs.forEach((tab, index) => {
    tab.addEventListener('keydown', (event) => {
      const last = tabs.length - 1;
      const next = {
        ArrowRight: index === last ? 0 : index + 1,
        ArrowLeft: index === 0 ? last : index - 1,
        Home: 0,
        End: last,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select(next, true);
    });
  });
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const { header, labels, categories } = readRows(block);
  blockCount += 1;
  const uid = `report-cards-${blockCount}`;
  const content = [];

  if (header && header.textContent.trim()) {
    const head = element('div', 'report-cards-header');
    head.append(...header.childNodes);
    content.push(head);
  }
  if (!categories.length) {
    block.replaceChildren(...content);
    return;
  }

  // one panel per category: its cards and, on mobile, the Show More button
  const panels = categories.map((category, index) => {
    const panel = element('div', 'report-cards-panel');
    panel.id = category.anchor || `${uid}-panel-${index + 1}`;
    if (category.row) moveInstrumentation(category.row, panel);
    const list = element('ul', 'report-cards-list');
    list.id = `${panel.id}-list`;
    category.reports.forEach((report) => list.append(buildCard(report)));
    panel.append(list);
    if (category.reports.length > MOBILE_VISIBLE) {
      list.classList.add('is-collapsed');
      const more = element('button', 'report-cards-more');
      more.type = 'button';
      more.setAttribute('aria-expanded', 'false');
      more.setAttribute('aria-controls', list.id);
      const label = element('span', 'report-cards-more-label', labels.moreLabel);
      const moreIcon = element('span', 'report-cards-more-icon');
      moreIcon.setAttribute('aria-hidden', 'true');
      more.append(label, moreIcon);
      more.addEventListener('click', () => {
        const open = list.classList.toggle('is-collapsed') === false;
        more.setAttribute('aria-expanded', String(open));
        label.textContent = open ? labels.lessLabel : labels.moreLabel;
      });
      panel.append(more);
    }
    return panel;
  });

  // category tabs (only with more than one category or a named category)
  const tabbed = categories.length > 1 || !!categories[0].title;
  if (tabbed) {
    const bar = element('div', 'report-cards-tabbar');
    const tablist = element('div', 'report-cards-tabs');
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', labels.tabsLabel);
    const tabs = categories.map((category, index) => {
      const tab = element('button', 'report-cards-tab', category.title);
      tab.type = 'button';
      tab.id = `${panels[index].id}-tab`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panels[index].id);
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', tab.id);
      tablist.append(tab);
      return tab;
    });

    // the chevron scrolls the tabs on mobile; the tabs stay reachable with the keyboard
    const scroll = element('button', 'report-cards-scroll');
    scroll.type = 'button';
    scroll.tabIndex = -1;
    scroll.setAttribute('aria-hidden', 'true');
    scroll.addEventListener('click', () => {
      tablist.scrollBy({ left: tablist.clientWidth * 0.6, behavior: 'smooth' });
    });
    const updateScroll = () => {
      const max = tablist.scrollWidth - tablist.clientWidth - 1;
      bar.classList.toggle('can-scroll', max > 0 && tablist.scrollLeft < max);
    };
    tablist.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll, { passive: true });

    const select = (index, focus = false) => {
      tabs.forEach((tab, i) => {
        const active = i === index;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
      });
      // focus also scrolls a keyboard-selected tab into view in the scrolling bar
      if (focus) tabs[index].focus();
    };
    tabs.forEach((tab, index) => tab.addEventListener('click', () => select(index)));
    bindTabKeys(tabs, select);

    const fromHash = panels.findIndex((panel) => `#${panel.id}` === window.location.hash);
    select(Math.max(0, fromHash));
    bar.append(tablist, scroll);
    content.push(bar);
    requestAnimationFrame(updateScroll);
  }

  content.push(...panels);
  block.replaceChildren(...content);
}
