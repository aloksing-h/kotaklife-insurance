/*
 * Impact Cards Block
 * Section heading with a button, then a grid of an optional quote card and stat cards.
 * With a quote the first two cards are tall and the next two share a column (as in Figma).
 * Stats only grids use a 3 card (all tall), 4 card (2 tall, 2 short) or 5 card (1 tall, 4 short)
 * layout, picked by the author or by the number of cards.
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

const ITEM_IDS = ['impact-stat', 'impact-quote'];

// tall and short card pattern of each stats layout (as in Figma); it repeats for extra cards
const LAYOUTS = {
  3: ['tall', 'tall', 'tall'],
  4: ['tall', 'tall', 'short', 'short'],
  5: ['tall', 'short', 'short', 'short', 'short'],
};

/**
 * Picks the stats layout: the authored option, else the number of cards.
 * @param {Element} block
 * @param {number} count
 * @returns {number}
 */
function layoutOf(block, count) {
  const authored = Object.keys(LAYOUTS).find((size) => block.classList.contains(`layout-${size}`));
  if (authored) return Number(authored);
  return LAYOUTS[count] ? count : 4;
}

function imgOf(image) {
  return image?.tagName === 'IMG' ? image : image?.querySelector('img');
}

function pictures(cell) {
  const found = [...(cell?.querySelectorAll('picture') || [])];
  return found.length ? found : [...(cell?.querySelectorAll('img') || [])];
}

/**
 * Moves the authored inline content of a richtext cell into an element.
 * @param {Element} cell
 * @param {Element} target
 */
function moveInline(cell, target) {
  const blocks = [...cell.children];
  if (blocks.length === 1 && blocks[0].tagName === 'P') target.append(...blocks[0].childNodes);
  else target.append(...cell.childNodes);
}

/**
 * Builds a pill button with a round arrow from an authored link.
 * @param {Element} [source]
 * @returns {HTMLAnchorElement|null}
 */
function buildButton(source) {
  if (!source) return null;
  const a = document.createElement('a');
  a.href = source.href;
  a.className = 'impact-cards-button';
  if (source.closest('strong, b') || source.classList.contains('primary')) a.classList.add('impact-cards-button-filled');
  a.innerHTML = '<span class="impact-cards-button-label"></span><span class="impact-cards-button-arrow"><span class="impact-cards-icon impact-cards-icon-arrow" aria-hidden="true"></span></span>';
  a.querySelector('.impact-cards-button-label').textContent = source.textContent.trim();
  return a;
}

/**
 * Builds a stat card: figure, label, colour and illustration.
 * @param {Element} row
 * @returns {HTMLLIElement}
 */
function buildStat(row) {
  const [valueCell, labelCell, themeCell, imageCell] = row.children;
  const li = document.createElement('li');
  const theme = themeCell?.textContent.trim().toLowerCase() === 'red' ? 'red' : 'light';
  li.className = `impact-cards-card impact-cards-stat impact-cards-${theme}`;
  moveInstrumentation(row, li);

  const value = document.createElement('p');
  value.className = 'impact-cards-value';
  value.textContent = valueCell?.textContent.trim() || '';
  const label = document.createElement('p');
  label.className = 'impact-cards-label';
  if (labelCell) moveInline(labelCell, label);
  li.append(value, label);

  // the first picture is the illustration, an optional second one is the mobile crop
  const [image, mobile] = pictures(imageCell);
  if (image) {
    const illustration = document.createElement('div');
    illustration.className = 'impact-cards-illustration';
    const alt = imgOf(image)?.alt || '';
    image.classList.add('impact-cards-illustration-default');
    illustration.append(image);
    if (mobile) {
      const mobileImg = imgOf(mobile);
      if (mobileImg) mobileImg.alt = alt;
      mobile.classList.add('impact-cards-illustration-mobile');
      illustration.append(mobile);
      illustration.classList.add('impact-cards-illustration-has-mobile');
    }
    li.append(illustration);
  }
  return li;
}

/**
 * Builds the quote card: quote, name, role, portrait and quote icon.
 * @param {Element} row
 * @returns {HTMLLIElement}
 */
function buildQuote(row) {
  const [quoteCell, nameCell, roleCell, imageCell] = row.children;
  const li = document.createElement('li');
  li.className = 'impact-cards-card impact-cards-quote';
  moveInstrumentation(row, li);

  const figure = document.createElement('figure');
  figure.className = 'impact-cards-quote-body';

  const icon = document.createElement('span');
  icon.className = 'impact-cards-quote-mark impact-cards-icon impact-cards-icon-quote';
  icon.setAttribute('aria-hidden', 'true');

  const blockquote = document.createElement('blockquote');
  blockquote.className = 'impact-cards-quote-text';
  if (quoteCell) blockquote.append(...quoteCell.childNodes);

  const caption = document.createElement('figcaption');
  caption.className = 'impact-cards-quote-caption';
  const name = nameCell?.textContent.trim();
  const role = roleCell?.textContent.trim();
  if (name) {
    const nameEl = document.createElement('span');
    nameEl.className = 'impact-cards-quote-name';
    nameEl.textContent = name;
    caption.append(nameEl);
  }
  if (role) {
    const roleEl = document.createElement('span');
    roleEl.className = 'impact-cards-quote-role';
    roleEl.textContent = role;
    caption.append(roleEl);
  }
  figure.append(icon, blockquote);
  if (caption.children.length) figure.append(caption);
  li.append(figure);

  const [portrait] = pictures(imageCell);
  if (portrait) {
    const wrapper = document.createElement('div');
    wrapper.className = 'impact-cards-portrait';
    wrapper.append(portrait);
    li.append(wrapper);
  }
  return li;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const [textRow, linkRow] = rows.filter((row) => row.children.length === 1);
  const itemRows = rows.filter((row) => row.children.length > 1);

  // heading and description
  const textCell = textRow?.firstElementChild;
  const heading = textCell?.querySelector('h1, h2, h3, h4, h5, h6');
  const title = document.createElement('div');
  title.className = 'impact-cards-title';
  if (heading) title.append(heading);
  const lead = document.createElement('div');
  lead.className = 'impact-cards-lead';
  if (textCell) lead.append(...textCell.childNodes);

  const cards = itemRows.map((row) => {
    // imported content may start an item row with its component id
    const first = row.firstElementChild;
    const firstText = first && !first.querySelector('a, picture, img') ? first.textContent.trim() : '';
    const itemId = ITEM_IDS.includes(firstText) ? firstText : '';
    if (itemId) first.remove();
    const theme = row.children[2]?.textContent.trim().toLowerCase();
    const isQuote = itemId ? itemId === 'impact-quote' : !['light', 'red'].includes(theme);
    return isQuote ? buildQuote(row) : buildStat(row);
  });
  // with a quote the first two cards are tall and the next two share the last column;
  // stats only cards follow the 3, 4 or 5 card layout
  const withQuote = cards[0]?.classList.contains('impact-cards-quote');
  const size = withQuote ? 4 : layoutOf(block, cards.length);
  const pattern = LAYOUTS[size];
  cards.forEach((card, i) => card.classList.add(`impact-cards-${pattern[i % pattern.length]}`));
  block.classList.add(withQuote ? 'impact-cards-with-quote' : 'impact-cards-stats-only');
  if (!withQuote) block.classList.add(`impact-cards-layout-${size}`);

  const grid = document.createElement('ul');
  grid.className = 'impact-cards-grid';
  grid.setAttribute('role', 'list');
  grid.append(...cards);

  const content = [title];
  if (lead.textContent.trim()) content.push(lead);
  const button = buildButton(linkRow?.querySelector('a[href]'));
  if (button) {
    const cta = document.createElement('p');
    cta.className = 'impact-cards-cta';
    cta.append(button);
    content.push(cta);
  }
  content.push(grid);
  block.replaceChildren(...content);
}
