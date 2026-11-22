/*
 * Notice Banner Block
 * How do I pages "Report Banner" (Figma Pay premium 1:3267 desktop, 1:3478 mobile;
 * Customer grievances 1:3684): a light blue notice with a title and description, and
 * Notice Action items (icon, label and title, link, Arrow or Download button).
 * Desktop: the text beside the actions; mobile: the actions stacked below the text.
 * buildNoticeActions is shared with the Info Panel block (its "Register a third-party
 * premium payer" box).
 */
import { moveInstrumentation } from '../../scripts/scripts.js';

const ACTION_ICONS = {
  arrow: 'arrow-right-circle-red.svg',
  download: 'button-download.svg',
};

const textOf = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

/**
 * Builds one action card from a row: [icon] [label and title] [link] [arrow | download]
 * @param {Element} row
 * @returns {HTMLLIElement|null}
 */
function buildAction(row) {
  const [iconCell, textCell, linkCell, typeCell] = [...row.children];
  const anchor = linkCell?.querySelector('a[href]') || textCell?.querySelector('a[href]');
  const lines = [...(textCell?.querySelectorAll('p') || [])].map(textOf).filter(Boolean);
  if (!lines.length && textOf(textCell)) lines.push(textOf(textCell));
  if (!anchor && !lines.length) return null;

  const type = textOf(typeCell).toLowerCase() === 'download' ? 'download' : 'arrow';
  const li = document.createElement('li');
  li.className = 'notice-banner-action';
  moveInstrumentation(row, li);

  const card = document.createElement(anchor ? 'a' : 'div');
  card.className = `notice-banner-card notice-banner-card-${type}`;
  if (anchor) {
    card.href = anchor.getAttribute('href');
    if (anchor.title) card.title = anchor.title;
    if (type === 'download' || /\.pdf($|[?#])/i.test(card.href)) {
      card.target = '_blank';
      card.rel = 'noopener';
    }
  }

  const picture = iconCell?.querySelector('picture');
  if (picture) {
    const icon = document.createElement('span');
    icon.className = 'notice-banner-icon';
    const img = picture.querySelector('img');
    if (img) {
      img.loading = 'lazy';
      if (!img.alt) img.setAttribute('aria-hidden', 'true');
    }
    icon.append(picture);
    card.append(icon);
  }

  // one line: the title only; two or more: the label, then the title
  const text = document.createElement('span');
  text.className = 'notice-banner-card-text';
  const [label, ...rest] = lines.length > 1 ? lines : [null, ...lines];
  if (label) {
    const small = document.createElement('span');
    small.className = 'notice-banner-card-label';
    small.textContent = label;
    text.append(small);
  }
  const title = document.createElement('span');
  title.className = 'notice-banner-card-title';
  title.textContent = rest.join(' ') || textOf(anchor);
  text.append(title);
  card.append(text);

  const button = document.createElement('span');
  button.className = 'notice-banner-button';
  button.innerHTML = `<img src="${window.hlx.codeBasePath}/icons/${ACTION_ICONS[type]}" alt="" width="32" height="32" aria-hidden="true">`;
  card.append(button);

  li.append(card);
  return li;
}

/**
 * Builds the list of action cards from Notice Action rows.
 * @param {Element[]} rows
 * @returns {HTMLUListElement|null}
 */
export function buildNoticeActions(rows) {
  const items = rows.map(buildAction).filter(Boolean);
  if (!items.length) return null;
  const list = document.createElement('ul');
  list.className = 'notice-banner-actions';
  list.append(...items);
  return list;
}

/**
 * Builds the title and description of the notice from a rich text cell.
 * @param {Element} cell
 * @returns {HTMLDivElement}
 */
export function buildNoticeText(cell) {
  const content = document.createElement('div');
  content.className = 'notice-banner-content';
  moveInstrumentation(cell, content);
  const elements = [...cell.children];
  if (!elements.length && textOf(cell)) {
    const p = document.createElement('p');
    p.textContent = textOf(cell);
    elements.push(p);
  }
  elements.forEach((el, i) => {
    if (i === 0 && !/^H[1-6]$/.test(el.tagName)) {
      // the first line is the title
      const title = document.createElement('p');
      title.className = 'notice-banner-title';
      title.append(...el.childNodes);
      content.append(title);
      return;
    }
    if (/^H[1-6]$/.test(el.tagName)) el.classList.add('notice-banner-title');
    else el.classList.add('notice-banner-description');
    content.append(el);
  });
  return content;
}

/**
 * loads and decorates the notice-banner block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const actionRows = rows.filter((row) => row.children.length > 1);
  const textRow = rows.find((row) => row.children.length === 1 && textOf(row));

  const content = textRow ? buildNoticeText(textRow.firstElementChild) : null;
  const actions = buildNoticeActions(actionRows);
  block.replaceChildren(...[content, actions].filter(Boolean));
}
