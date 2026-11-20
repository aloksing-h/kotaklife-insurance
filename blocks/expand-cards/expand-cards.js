/*
 * Expand Cards Block
 * Careers page "Why work with us" (Figma 11104:9540 desktop, 11104:9807 mobile): up to
 * three Expand Card items. The first is open; opening another closes the rest. An open
 * card shows its title, description and tiles (Heading 3 and paragraph pairs) on red;
 * a closed card shows its icon and title on light blue. Each card has a large number.
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

const MAX_CARDS = 3;
let blockCount = 0;

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

/**
 * Tiles from the details rich text: each heading starts a tile, the text after it is
 * the tile description.
 * @param {Element} [cell]
 * @returns {HTMLUListElement|null}
 */
function buildTiles(cell) {
  const tiles = element('ul', 'expand-cards-tiles');
  let tile = null;
  [...(cell?.children || [])].filter((el) => el.textContent.trim()).forEach((el) => {
    if (el.matches('h1, h2, h3, h4, h5, h6') || !tile) {
      tile = element('li', 'expand-cards-tile');
      tiles.append(tile);
    }
    if (el.matches('h1, h2, h3, h4, h5, h6')) {
      tile.append(element('h4', 'expand-cards-tile-title', el.textContent.trim()));
    } else {
      el.classList.add('expand-cards-tile-text');
      tile.append(el);
    }
  });
  return tiles.children.length ? tiles : null;
}

/**
 * One card from an item row: [icon] [title] [description] [tiles]
 * @param {Element} row
 * @param {number} index
 * @param {string} id
 */
function buildCard(row, index, id) {
  const [iconCell, titleCell, descriptionCell, detailsCell] = row.children;
  const title = titleCell?.textContent.trim() || '';
  const card = element('li', 'expand-cards-card');
  moveInstrumentation(row, card);

  const number = element('span', 'expand-cards-number', String(index + 1).padStart(2, '0'));
  number.setAttribute('aria-hidden', 'true');

  const heading = element('h3', 'expand-cards-heading');
  const trigger = element('button', 'expand-cards-trigger');
  trigger.type = 'button';
  trigger.id = `${id}-trigger-${index}`;
  trigger.setAttribute('aria-controls', `${id}-panel-${index}`);
  const picture = iconCell?.querySelector('picture');
  if (picture) {
    const img = picture.querySelector('img');
    if (img) {
      img.alt = '';
      img.loading = 'lazy';
    }
    const iconBox = element('span', 'expand-cards-icon');
    iconBox.setAttribute('aria-hidden', 'true');
    iconBox.append(picture);
    trigger.append(iconBox);
  }
  trigger.append(element('span', 'expand-cards-title', title));
  heading.append(trigger);

  const panel = element('div', 'expand-cards-panel');
  panel.id = `${id}-panel-${index}`;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', trigger.id);
  [...(descriptionCell?.children || [])].filter((el) => el.textContent.trim()).forEach((el) => {
    el.classList.add('expand-cards-description');
    panel.append(el);
  });
  if (!descriptionCell?.children.length && descriptionCell?.textContent.trim()) {
    panel.append(element('p', 'expand-cards-description', descriptionCell.textContent.trim()));
  }
  const tiles = buildTiles(detailsCell);
  if (tiles) panel.append(tiles);

  card.append(number, heading, panel);
  return { card, trigger, panel };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  blockCount += 1;
  const id = `expand-cards-${blockCount}`;
  const rows = [...block.children];
  const textRow = rows.find((row) => row.children.length === 1);
  const itemRows = rows.filter((row) => row.children.length > 1).slice(0, MAX_CARDS);

  const header = element('div', 'expand-cards-header');
  [...(textRow?.firstElementChild?.children || [])]
    .filter((el) => el.textContent.trim())
    .forEach((el) => {
      el.classList.add(el.matches('h1, h2, h3, h4, h5, h6') ? 'expand-cards-heading-main' : 'expand-cards-lead');
      header.append(el);
    });

  const list = element('ul', 'expand-cards-list');
  const cards = itemRows.map((row, i) => buildCard(row, i, id));
  cards.forEach(({ card }) => list.append(card));

  const open = (index) => cards.forEach(({ card, trigger, panel }, i) => {
    const isOpen = i === index;
    card.classList.toggle('is-open', isOpen);
    trigger.setAttribute('aria-expanded', String(isOpen));
    panel.hidden = !isOpen;
  });
  cards.forEach(({ trigger }, i) => trigger.addEventListener('click', () => open(i)));
  open(0);

  const children = [];
  if (header.children.length) children.push(header);
  if (list.children.length) children.push(list);
  block.replaceChildren(...children);
}
