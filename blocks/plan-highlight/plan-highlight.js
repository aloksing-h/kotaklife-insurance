import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Returns the non-empty child elements of a cell.
 * @param {Element} cell
 * @returns {Element[]}
 */
function cellElements(cell) {
  return [...(cell?.children || [])].filter((el) => el.textContent.trim());
}

/**
 * Builds the badge list from paragraphs or list items.
 * @param {Element} cell
 * @returns {HTMLUListElement|null}
 */
function buildBadges(cell) {
  const sources = cellElements(cell)
    .flatMap((el) => (el.matches('ul, ol') ? [...el.children] : [el]))
    .filter((el) => el.textContent.trim());
  if (!sources.length) return null;
  const list = document.createElement('ul');
  list.className = 'plan-highlight-badges';
  sources.forEach((source) => {
    const badge = document.createElement('li');
    badge.className = 'plan-highlight-badge';
    badge.append(...source.childNodes);
    list.append(badge);
  });
  return list;
}

/**
 * Splits the summary into intro, values (paragraphs starting with bold text) and note.
 * @param {Element} cell
 * @returns {Element[]}
 */
function buildSummary(cell) {
  const elements = cellElements(cell);
  const isValue = (el) => {
    const lead = [...el.childNodes].find((node) => node.textContent.trim());
    return lead?.nodeType === Node.ELEMENT_NODE && lead.matches('strong, b');
  };
  const first = elements.findIndex(isValue);
  if (first < 0) {
    elements.forEach((el) => el.classList.add('plan-highlight-intro'));
    return elements;
  }
  let last = first;
  while (last + 1 < elements.length && isValue(elements[last + 1])) last += 1;

  const intro = elements.slice(0, first);
  intro.forEach((el) => el.classList.add('plan-highlight-intro'));

  const values = document.createElement('div');
  values.className = 'plan-highlight-values';
  elements.slice(first, last + 1).forEach((el) => {
    el.classList.add('plan-highlight-value');
    values.append(el);
  });

  const note = elements.slice(last + 1);
  note.forEach((el) => el.classList.add('plan-highlight-note'));
  return [...intro, values, ...note];
}

/**
 * Builds the feature checklist; rows are filled column by column on desktop.
 * @param {Element} cell
 * @returns {HTMLUListElement|null}
 */
function buildFeatures(cell) {
  const list = cell?.querySelector('ul, ol');
  if (!list) return null;
  const features = document.createElement('ul');
  features.className = 'plan-highlight-features';
  features.append(...list.children);
  features.style.setProperty('--ph-rows', Math.ceil(features.children.length / 2));
  return features;
}

/**
 * loads and decorates the plan-highlight block
 * rows: [heading & description] [badges] [benefit summary] [features]
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const [textRow, badgesRow, summaryRow, featuresRow] = [...block.children];

  const header = document.createElement('div');
  header.className = 'plan-highlight-header';
  const textCell = textRow?.firstElementChild;
  if (textCell) {
    moveInstrumentation(textCell, header);
    header.append(...cellElements(textCell));
  }

  const card = document.createElement('div');
  card.className = 'plan-highlight-card';
  const badges = buildBadges(badgesRow?.firstElementChild);
  if (badges) card.append(badges);
  const summary = buildSummary(summaryRow?.firstElementChild);
  if (summary.length) {
    const wrapper = document.createElement('div');
    wrapper.className = 'plan-highlight-summary';
    wrapper.append(...summary);
    card.append(wrapper);
  }
  const features = buildFeatures(featuresRow?.firstElementChild);
  if (features) card.append(features);

  block.replaceChildren(...[header, card].filter((el) => el.children.length));
}
