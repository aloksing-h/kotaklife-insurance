import { decorateIcons } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const DEFAULT_LABELS = ['NAV', 'Risk profile'];

let gaugeIdx = 0;

// risk levels: display name and needle angle (degrees, 180 = far left, 0 = far right)
const RISK_LEVELS = {
  low: ['Low', 172],
  'low-to-moderate': ['Low to Moderate', 148],
  moderate: ['Moderate', 118],
  'moderately-high': ['Moderately High', 72],
  high: ['High', 28],
  'very-high': ['Very High', -4],
};

// gauge geometry (viewBox units)
const GAUGE = {
  width: 138, height: 80, cx: 69, cy: 56, r: 50,
};
const SEGMENTS = [
  ['low', 197, 162],
  ['moderate', 150, 100],
  ['high', 88, -17],
];

/**
 * Point on the gauge circle for an angle in degrees.
 * @param {number} deg
 * @param {number} radius
 * @returns {number[]}
 */
function point(deg, radius) {
  const rad = (deg * Math.PI) / 180;
  return [GAUGE.cx + radius * Math.cos(rad), GAUGE.cy - radius * Math.sin(rad)];
}

/**
 * SVG arc path running clockwise from one angle to another.
 * @param {number} from
 * @param {number} to
 * @returns {string}
 */
function arc(from, to) {
  const [x1, y1] = point(from, GAUGE.r);
  const [x2, y2] = point(to, GAUGE.r);
  const large = from - to > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${GAUGE.r} ${GAUGE.r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * Risk gauge: coloured arc, needle pointing at the level, level name and caption.
 * @param {string} level
 * @param {string} caption
 * @returns {HTMLDivElement}
 */
function buildGauge(level, caption) {
  const [name, angle] = RISK_LEVELS[level] || RISK_LEVELS.high;
  const [nx1, ny1] = point(angle, GAUGE.r - 24);
  const [nx2, ny2] = point(angle, GAUGE.r - 8);
  gaugeIdx += 1;
  const gradientId = `fund-cards-needle-${gaugeIdx}`;
  const gauge = document.createElement('div');
  gauge.className = 'fund-cards-gauge';
  gauge.innerHTML = `<svg viewBox="0 0 ${GAUGE.width} ${GAUGE.height}" aria-hidden="true" focusable="false">
    <defs><linearGradient id="${gradientId}" x1="${nx1}" y1="${ny1}" x2="${nx2}" y2="${ny2}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#a4a7ae"/>
    </linearGradient></defs>
    ${SEGMENTS.map(([cls, from, to]) => `<path class="fund-cards-gauge-${cls}" d="${arc(from, to)}"/>`).join('')}
    <line class="fund-cards-gauge-needle" x1="${nx1.toFixed(2)}" y1="${ny1.toFixed(2)}" x2="${nx2.toFixed(2)}" y2="${ny2.toFixed(2)}" stroke="url(#${gradientId})"/>
  </svg>
  <p class="fund-cards-gauge-level"></p>
  <p class="fund-cards-gauge-caption"></p>`;
  gauge.querySelector('.fund-cards-gauge-level').textContent = name;
  gauge.querySelector('.fund-cards-gauge-caption').textContent = caption;
  return gauge;
}

/**
 * Trimmed texts of a grouped cell, one per child element (or the cell text).
 * @param {Element} cell
 * @returns {string[]}
 */
function cellTexts(cell) {
  if (!cell) return [];
  const texts = cell.children.length
    ? [...cell.children].map((el) => el.textContent.trim())
    : [cell.textContent.trim()];
  return texts.filter(Boolean);
}

/**
 * Value + label stat.
 * @param {string} className
 * @param {string} value
 * @param {string} label
 * @returns {HTMLDivElement}
 */
function buildStat(className, value, label) {
  const stat = document.createElement('div');
  stat.className = `fund-cards-stat ${className}`;
  stat.innerHTML = '<p class="fund-cards-stat-value"></p><p class="fund-cards-stat-label"></p>';
  stat.querySelector('.fund-cards-stat-value').textContent = value;
  stat.querySelector('.fund-cards-stat-label').textContent = label;
  if (!label) stat.querySelector('.fund-cards-stat-label').remove();
  return stat;
}

/**
 * Builds a fund card from an item row:
 * [badge + name + code] [NAV + date + risk] [returns + benchmark] [link]
 * @param {Element} row
 * @param {string[]} labels
 * @returns {HTMLLIElement}
 */
function buildCard(row, labels) {
  const [navLabel, riskLabel] = labels;
  const [contentCell, navCell, returnsCell, linkCell] = [...row.children];
  const card = document.createElement('li');
  card.className = 'fund-cards-card';
  moveInstrumentation(row, card);

  const contentTexts = contentCell?.children.length
    ? [...contentCell.children].map((el) => el.textContent.trim())
    : cellTexts(contentCell);
  const [badge, title, code, fundCode] = contentTexts;
  if (fundCode) card.dataset.fundCode = fundCode;

  // the risk select value is one of the known level keys, the rest are NAV and date
  const navTexts = cellTexts(navCell);
  const risk = navTexts.find((value) => value in RISK_LEVELS) || 'high';
  const [navValue, navDate] = navTexts.filter((value) => !(value in RISK_LEVELS));

  // returns come as value / label pairs: a value has a digit or %, a label does not
  const pairs = [];
  cellTexts(returnsCell).forEach((value) => {
    if (/\d|%/.test(value) && !/[a-z]{3,}/i.test(value)) pairs.push({ value, label: '' });
    else if (pairs.length && !pairs[pairs.length - 1].label) pairs[pairs.length - 1].label = value;
    else pairs.push({ value: '', label: value });
  });
  const [fundReturn, benchmark] = pairs;

  const anchor = linkCell?.querySelector('a[href]');
  const href = anchor?.getAttribute('href') || '';
  const anchorText = anchor?.textContent.trim() || '';
  const linkText = anchorText && !/^(\/|https?:)/.test(anchorText) ? anchorText : 'Explore';

  // top: badge (+ mobile expand link), name, code
  const top = document.createElement('div');
  top.className = 'fund-cards-top';
  const meta = document.createElement('div');
  meta.className = 'fund-cards-meta';
  if (badge) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'fund-cards-badge';
    badgeEl.textContent = badge;
    meta.append(badgeEl);
  }
  if (href) {
    const expand = document.createElement('a');
    expand.className = 'fund-cards-expand';
    expand.href = href;
    expand.setAttribute('aria-label', title ? `Open ${title}` : 'Open fund details');
    meta.append(expand);
  }
  top.append(meta);

  const heading = document.createElement('div');
  heading.className = 'fund-cards-heading';
  if (title) {
    const h3 = document.createElement('h3');
    h3.className = 'fund-cards-title';
    h3.textContent = title;
    heading.append(h3);
  }
  if (code) {
    const codeEl = document.createElement('p');
    codeEl.className = 'fund-cards-code';
    codeEl.textContent = code;
    heading.append(codeEl);
  }
  top.append(heading);

  // NAV row: NAV | risk gauge (desktop) | fund return (mobile)
  const navRow = document.createElement('div');
  navRow.className = 'fund-cards-nav';
  const nav = document.createElement('div');
  nav.className = 'fund-cards-nav-value';
  nav.innerHTML = '<p class="fund-cards-nav-label"></p><p class="fund-cards-nav-amount"></p><p class="fund-cards-nav-date"></p>';
  nav.querySelector('.fund-cards-nav-label').textContent = navLabel;
  nav.querySelector('.fund-cards-nav-amount').textContent = navValue || '';
  nav.querySelector('.fund-cards-nav-date').textContent = navDate || '';
  navRow.append(nav, buildGauge(risk, riskLabel));
  if (fundReturn) navRow.append(buildStat('fund-cards-stat-mobile', fundReturn.value, fundReturn.label));

  card.append(top, navRow);

  // returns row (desktop): fund return | benchmark
  if (fundReturn || benchmark) {
    const returns = document.createElement('div');
    returns.className = 'fund-cards-returns';
    [fundReturn, benchmark].filter(Boolean)
      .forEach((pair) => returns.append(buildStat('', pair.value, pair.label)));
    card.append(returns);
  }

  // Explore (mobile)
  if (href) {
    const cta = document.createElement('a');
    cta.className = 'fund-cards-cta';
    cta.href = href;
    cta.innerHTML = '<span></span><span class="icon icon-right-red-filled"></span>';
    cta.firstElementChild.textContent = linkText;
    if (title) cta.setAttribute('aria-label', `${linkText}: ${title}`);
    decorateIcons(cta);
    card.append(cta);
  }
  return card;
}

/**
 * loads and decorates the fund-cards block
 * rows: [heading & subtitle] [labels] [fund cards...]
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const [textRow, labelsRow] = rows.filter((row) => row.children.length === 1);
  const authored = cellTexts(labelsRow?.firstElementChild);
  const labels = DEFAULT_LABELS.map((fallback, i) => authored[i] || fallback);

  const header = document.createElement('div');
  header.className = 'fund-cards-header';
  const textCell = textRow?.firstElementChild;
  if (textCell?.textContent.trim()) {
    moveInstrumentation(textCell, header);
    const elements = [...textCell.children].filter((el) => el.textContent.trim());
    const title = elements.find((el) => el.matches('h1, h2, h3, h4, h5, h6'));
    if (title) {
      title.classList.add('fund-cards-heading-title');
      header.append(title);
    }
    const rest = elements.filter((el) => el !== title);
    if (rest.length) {
      const aside = document.createElement('div');
      aside.className = 'fund-cards-subtitle';
      aside.append(...rest);
      header.append(aside);
    }
  }

  const list = document.createElement('ul');
  list.className = 'fund-cards-list';
  rows.filter((row) => row.children.length > 1)
    .forEach((row) => list.append(buildCard(row, labels)));
  const heading = header.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    heading.id = heading.id || `fund-cards-${[...document.querySelectorAll('.fund-cards')].indexOf(block) + 1}-heading`;
    list.setAttribute('aria-labelledby', heading.id);
  }

  block.replaceChildren(...[header, list].filter((el) => el.children.length));
}
