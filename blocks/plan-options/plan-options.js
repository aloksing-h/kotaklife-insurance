import { decorateIcons } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Builds a plan card from an item row: [icon] [plan name + benefits] [badge]
 * Cards alternate blue / pink backgrounds in CSS.
 * @param {Element} row
 * @returns {HTMLLIElement}
 */
function buildCard(row) {
  const [iconCell, contentCell, badgeCell] = [...row.children];
  const card = document.createElement('li');
  card.className = 'plan-options-card';
  moveInstrumentation(row, card);

  const badgeText = badgeCell?.textContent.trim();
  if (badgeText) {
    const badge = document.createElement('span');
    badge.className = 'plan-options-badge';
    badge.textContent = badgeText;
    card.append(badge);
  }

  const head = document.createElement('div');
  head.className = 'plan-options-card-head';
  const picture = iconCell?.querySelector('picture');
  if (picture) {
    const icon = document.createElement('span');
    icon.className = 'plan-options-icon';
    const img = picture.querySelector('img');
    if (img) {
      img.loading = 'lazy';
      if (!img.alt) img.setAttribute('aria-hidden', 'true');
    }
    icon.append(picture);
    head.append(icon);
  }

  const elements = [...(contentCell?.children || [])];
  const titleEl = elements.find((el) => !el.matches('ul, ol') && el.textContent.trim());
  if (titleEl) {
    const title = document.createElement('h3');
    title.className = 'plan-options-title';
    title.append(...titleEl.childNodes);
    head.append(title);
  }
  card.append(head);

  const list = elements.find((el) => el.matches('ul, ol'));
  if (list) {
    list.className = 'plan-options-list';
    card.append(list);
  }

  return card;
}

/**
 * Reads the glossary lines (term: definition) of a cell, one per paragraph or line break.
 * @param {Element} cell
 * @returns {{term: string, definition: string}[]}
 */
function readGlossary(cell) {
  const clone = cell.cloneNode(true);
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  clone.querySelectorAll('p, li, div').forEach((el) => el.append('\n'));
  return clone.textContent.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf(':');
      return { term: line.slice(0, at).trim(), definition: line.slice(at + 1).trim() };
    })
    .filter(({ term, definition }) => term && definition);
}

/**
 * A glossary cell has no heading or link and every line is "term: definition".
 * @param {Element} cell
 * @returns {boolean}
 */
function isGlossaryCell(cell) {
  if (cell.querySelector('h1, h2, h3, h4, h5, h6, a[href], picture')) return false;
  const count = readGlossary(cell).length;
  return count > 0 && count >= cell.querySelectorAll('p, li').length;
}

let tooltipCount = 0;

/**
 * Builds a glossary term: an underlined button with its definition as a tooltip.
 * @param {string} text the matched text
 * @param {{term: string, definition: string}} entry
 * @returns {HTMLSpanElement}
 */
function buildTerm(text, entry) {
  tooltipCount += 1;
  const id = `plan-options-tooltip-${tooltipCount}`;
  const wrapper = document.createElement('span');
  wrapper.className = 'plan-options-term';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'plan-options-term-trigger';
  trigger.textContent = text;
  trigger.setAttribute('aria-describedby', id);

  const tooltip = document.createElement('span');
  tooltip.className = 'plan-options-tooltip';
  tooltip.id = id;
  tooltip.setAttribute('role', 'tooltip');
  const name = document.createElement('strong');
  name.className = 'plan-options-tooltip-term';
  name.textContent = entry.term;
  tooltip.append(name, ` : ${entry.definition}`);

  wrapper.append(trigger, tooltip);
  return wrapper;
}

/**
 * Underlines the glossary terms in the benefit lists and adds their tooltips.
 * @param {Element} block
 * @param {{term: string, definition: string}[]} glossary
 */
function decorateGlossary(block, glossary) {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b(${glossary.map((g) => escape(g.term)).join('|')})\\b`, 'i');
  const entryOf = (text) => glossary.find((g) => g.term.toLowerCase() === text.toLowerCase());

  block.querySelectorAll('.plan-options-list li').forEach((li) => {
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let rest = node;
      let match = rest.textContent.match(pattern);
      while (match) {
        const after = rest.splitText(match.index);
        rest = after.splitText(match[0].length);
        after.replaceWith(buildTerm(match[0], entryOf(match[0])));
        match = rest.textContent.match(pattern);
      }
    });
  });

  const terms = [...block.querySelectorAll('.plan-options-term')];
  if (!terms.length) return;
  block.classList.add('plan-options-has-glossary');

  const close = (term) => term.classList.remove('is-open');
  terms.forEach((term) => {
    const trigger = term.querySelector('.plan-options-term-trigger');
    // touch screens have no hover: a tap toggles the definition
    trigger.addEventListener('click', () => {
      const open = !term.classList.contains('is-open');
      terms.forEach(close);
      term.classList.toggle('is-open', open);
      term.classList.remove('is-dismissed');
    });
    // Escape hides the definition until the pointer or focus leaves (WCAG 1.4.13)
    term.addEventListener('mouseenter', () => term.classList.add('is-hovered'));
    term.addEventListener('mouseleave', () => term.classList.remove('is-hovered', 'is-dismissed'));
    trigger.addEventListener('blur', () => {
      term.classList.remove('is-dismissed');
      close(term);
    });
  });
  // on the document: a hovered term has no focus, so the key goes to the page
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    terms.forEach((term) => {
      if (term.matches('.is-hovered, :focus-within, .is-open')) term.classList.add('is-dismissed');
      close(term);
    });
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.plan-options-term')) terms.forEach(close);
  });
}

/**
 * loads and decorates the plan-options block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const header = document.createElement('div');
  header.className = 'plan-options-header';
  const cards = document.createElement('ul');
  cards.className = 'plan-options-cards';
  let link = null;
  let glossary = [];

  [...block.children].forEach((row) => {
    if (row.children.length > 1) {
      cards.append(buildCard(row));
      return;
    }
    const cell = row.firstElementChild;
    if (!cell?.textContent.trim()) return;
    const anchor = cell.querySelector('a[href]');
    if (header.children.length && !glossary.length && isGlossaryCell(cell)) {
      glossary = readGlossary(cell);
    } else if (anchor && !link && !cell.querySelector('h1, h2, h3, h4, h5, h6')) {
      link = anchor;
    } else if (!header.children.length) {
      moveInstrumentation(cell, header);
      header.append(...cell.childNodes);
    }
  });

  if (link) {
    const cta = document.createElement('a');
    cta.className = 'plan-options-cta';
    cta.href = link.getAttribute('href');
    if (link.title) cta.title = link.title;
    moveInstrumentation(link, cta);
    cta.innerHTML = `<span>${link.textContent.trim()}</span><span class="icon icon-right-white-filled"></span>`;
    decorateIcons(cta);
    const wrapper = document.createElement('p');
    wrapper.className = 'plan-options-cta-wrapper';
    wrapper.append(cta);
    header.append(wrapper);
  }

  block.replaceChildren(...[header, cards].filter((el) => el.children.length));
  if (glossary.length) decorateGlossary(block, glossary);
}
