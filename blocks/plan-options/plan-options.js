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

  // further paragraphs after the plan name (Register options style: the option description)
  const texts = elements.filter((el) => el !== titleEl && el !== list
    && el.matches('p') && el.textContent.trim());
  if (texts.length) {
    const text = document.createElement('div');
    text.className = 'plan-options-text';
    text.append(...texts);
    card.append(text);
  }

  return card;
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

  [...block.children].forEach((row) => {
    if (row.children.length > 1) {
      cards.append(buildCard(row));
      return;
    }
    const cell = row.firstElementChild;
    if (!cell?.textContent.trim()) return;
    const anchor = cell.querySelector('a[href]');
    if (anchor && !link && !cell.querySelector('h1, h2, h3, h4, h5, h6')) {
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
}
