/*
 * Check Points Block
 * Pay premium "Why choose ECS?" (Figma 1:3268 desktop, 1:3484 mobile): a centred section
 * heading and description, then Check Point items (a red check and a short benefit) in a
 * row of cards joined by curved lines (stacked on mobile).
 */
import { moveInstrumentation } from '../../scripts/scripts.js';

const textOf = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

/**
 * loads and decorates the check-points block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const header = document.createElement('div');
  header.className = 'check-points-header';
  const list = document.createElement('ul');
  list.className = 'check-points-list';

  rows.forEach((row, i) => {
    const cell = row.firstElementChild;
    if (!cell || !textOf(cell)) return;
    // the first row is the block's heading and description, the others Check Point items
    if (i === 0) {
      moveInstrumentation(cell, header);
      header.append(...cell.childNodes);
      return;
    }
    const li = document.createElement('li');
    li.className = 'check-points-item';
    moveInstrumentation(row, li);
    const icon = document.createElement('img');
    icon.className = 'check-points-icon';
    icon.src = `${window.hlx.codeBasePath}/icons/check-circle-red.svg`;
    icon.alt = '';
    icon.width = 32;
    icon.height = 32;
    icon.loading = 'lazy';
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'check-points-text';
    text.textContent = textOf(cell);
    li.append(icon, text);
    list.append(li);
  });

  const heading = header.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) heading.classList.add('check-points-title');
  header.querySelectorAll('p').forEach((p) => p.classList.add('check-points-description'));

  block.replaceChildren(...[header, list].filter((el) => el.children.length));
}
