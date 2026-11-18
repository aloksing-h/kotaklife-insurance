/*
 * Earning Chart Block
 * Life Advisor page "Earning potential" (Figma 11291:43979 desktop, 11291:44088 mobile).
 * Block rows, in model order: [heading and description] [advisor photos]
 * [figure, figure label] [highlight value, heading, note]; then one Chart Column item
 * per bar: [amount, amount note] [year, stage] [bar height, highlighted].
 * The chart is an ordered list, so its figures are read as text; bars and arrow are
 * decorative. Hovering a column highlights it.
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * The values of a cell that groups several fields, in model order (paragraphs from AEM,
 * text nodes from plain HTML), without empty ones.
 * @param {Element} [cell]
 * @returns {string[]}
 */
function cellValues(cell) {
  return [...(cell?.childNodes || [])]
    .filter((node) => node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent.trim())
    .filter(Boolean);
}

function element(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text) el.textContent = text;
  return el;
}

/**
 * The social proof line: advisor photos, figure and label.
 * @param {Element} [photosCell]
 * @param {Element} [proofCell]
 * @returns {HTMLParagraphElement|null}
 */
function buildProof(photosCell, proofCell) {
  const [value, label] = cellValues(proofCell);
  const picture = photosCell?.querySelector('picture');
  if (!value && !label && !picture) return null;
  const proof = element('p', 'earning-chart-proof');
  if (picture) {
    const img = picture.querySelector('img');
    if (img) {
      img.loading = 'lazy';
      if (!img.getAttribute('alt')) img.alt = '';
    }
    const photos = element('span', 'earning-chart-photos');
    photos.append(picture);
    proof.append(photos);
  }
  const text = element('span', 'earning-chart-proof-text');
  if (value) text.append(element('strong', 'earning-chart-proof-value', value));
  if (label) text.append(` ${label}`);
  proof.append(text);
  return proof;
}

/**
 * The highlight card: an up arrow, the value, a heading and a note.
 * @param {Element} [cell]
 * @returns {HTMLDivElement|null}
 */
function buildHighlight(cell) {
  const [value, heading, note] = cellValues(cell);
  if (!value && !heading && !note) return null;
  const card = element('div', 'earning-chart-highlight');
  if (value) {
    const row = element('p', 'earning-chart-highlight-value', value);
    row.prepend(element('span', 'earning-chart-highlight-icon'));
    row.firstChild.setAttribute('aria-hidden', 'true');
    card.append(row);
  }
  const body = element('div', 'earning-chart-highlight-body');
  if (heading) body.append(element('p', 'earning-chart-highlight-heading', heading));
  if (note) body.append(element('p', 'earning-chart-highlight-note', note));
  if (body.children.length) card.append(body);
  return card;
}

/**
 * One chart column from an item row.
 * @param {Element} row
 * @param {number} index
 * @param {number} count
 * @returns {HTMLLIElement}
 */
function buildColumn(row, index, count) {
  const [tooltipCell, axisCell, barCell] = row.children;
  const [amount, note] = cellValues(tooltipCell);
  const [year, stage] = cellValues(axisCell);
  const barValues = cellValues(barCell);
  const height = Number(barValues.find((value) => /^\d+(\.\d+)?$/.test(value)));
  const highlighted = barValues.some((value) => value.toLowerCase() === 'true');

  const column = element('li', 'earning-chart-column');
  moveInstrumentation(row, column);
  if (highlighted) column.classList.add('is-highlighted');
  // without an authored height the bars rise evenly: 1/n, 2/n ... n/n
  const percent = height >= 10 && height <= 100 ? height : Math.round(((index + 1) / count) * 100);
  column.style.setProperty('--earning-chart-bar', String(percent / 100));

  const tooltip = element('div', 'earning-chart-tooltip');
  if (amount) tooltip.append(element('p', 'earning-chart-amount', amount));
  if (note) tooltip.append(element('p', 'earning-chart-note', note));

  const marker = element('span', 'earning-chart-marker');
  const bar = element('span', 'earning-chart-bar');
  [marker, bar].forEach((el) => el.setAttribute('aria-hidden', 'true'));

  const axis = element('p', 'earning-chart-axis');
  if (year) axis.append(element('strong', 'earning-chart-year', year));
  if (stage) axis.append(element('span', 'earning-chart-stage', stage));

  column.append(tooltip, marker, bar, axis);
  return column;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const configRows = rows.filter((row) => row.children.length === 1);
  const [textRow, photosRow, proofRow, highlightRow] = configRows;
  const itemRows = rows.filter((row) => row.children.length > 1);

  const content = element('div', 'earning-chart-content');
  const header = element('div', 'earning-chart-header');
  [...(textRow?.firstElementChild?.children || [])]
    .filter((el) => el.textContent.trim())
    .forEach((el) => {
      el.classList.add(el.matches('h1, h2, h3, h4, h5, h6') ? 'earning-chart-title' : 'earning-chart-description');
      header.append(el);
    });
  if (header.children.length) content.append(header);

  const facts = element('div', 'earning-chart-facts');
  const proof = buildProof(photosRow?.firstElementChild, proofRow?.firstElementChild);
  const highlight = buildHighlight(highlightRow?.firstElementChild);
  [proof, highlight].filter(Boolean).forEach((el) => facts.append(el));
  if (facts.children.length) content.append(facts);

  const children = [content];
  if (itemRows.length) {
    const graph = element('div', 'earning-chart-graph');
    const columns = element('ol', 'earning-chart-columns');
    const heading = header.querySelector('.earning-chart-title');
    if (heading) {
      heading.id ||= `earning-chart-${Math.random().toString(36).slice(2, 8)}`;
      columns.setAttribute('aria-labelledby', heading.id);
    }
    itemRows.forEach((row, i) => columns.append(buildColumn(row, i, itemRows.length)));
    const arrow = element('span', 'earning-chart-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    graph.append(columns, arrow);
    children.push(graph);
  }
  block.replaceChildren(...children);
}
