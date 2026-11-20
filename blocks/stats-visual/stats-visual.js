/*
 * Stats Visual Block
 * Life Advisor page "Be a Life Advisor and earn from home" (Figma 11291:43980 desktop,
 * 11291:44107 mobile): a section heading and description, a row of Stat items (value and
 * label) and a visual beside the text (desktop) or below it (mobile).
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Builds one stat from an authored item row: [value] [label]
 * @param {Element} row
 * @returns {HTMLLIElement|null}
 */
function buildStat(row) {
  const [valueCell, labelCell] = row.children;
  const value = valueCell?.textContent.trim();
  const label = labelCell?.textContent.trim();
  if (!value && !label) return null;
  const stat = document.createElement('li');
  stat.className = 'stats-visual-stat';
  moveInstrumentation(row, stat);
  if (value) {
    const el = document.createElement('p');
    el.className = 'stats-visual-value';
    el.textContent = value;
    stat.append(el);
  }
  if (label) {
    const el = document.createElement('p');
    el.className = 'stats-visual-label';
    el.textContent = label;
    stat.append(el);
  }
  return stat;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const configRows = rows.filter((row) => row.children.length === 1);
  const itemRows = rows.filter((row) => row.children.length > 1);
  const textCell = configRows.find((row) => !row.querySelector('picture'))?.firstElementChild;
  const picture = configRows.map((row) => row.querySelector('picture')).find(Boolean);

  const content = document.createElement('div');
  content.className = 'stats-visual-content';

  const header = document.createElement('div');
  header.className = 'stats-visual-header';
  [...(textCell?.children || [])]
    .filter((el) => el.textContent.trim())
    .forEach((el) => {
      el.classList.add(el.matches('h1, h2, h3, h4, h5, h6') ? 'stats-visual-title' : 'stats-visual-description');
      header.append(el);
    });
  if (header.children.length) content.append(header);

  const stats = document.createElement('ul');
  stats.className = 'stats-visual-stats';
  itemRows.map(buildStat).filter(Boolean).forEach((stat) => stats.append(stat));
  if (stats.children.length) content.append(stats);

  const children = [content];
  if (picture) {
    const visual = document.createElement('div');
    visual.className = 'stats-visual-visual';
    const img = picture.querySelector('img');
    if (img) {
      img.loading = 'lazy';
      if (!img.getAttribute('alt')) img.alt = '';
    }
    visual.append(picture);
    children.push(visual);
  }
  block.replaceChildren(...children);
}
