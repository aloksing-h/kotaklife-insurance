import { decorateIcons } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Splits a rich text cell into a label (first paragraph) and its values.
 * @param {Element} cell
 * @returns {HTMLDivElement}
 */
function buildText(cell) {
  const text = document.createElement('div');
  text.className = 'plan-timeline-text';
  const [first, ...rest] = [...(cell?.children || [])].filter((el) => el.textContent.trim());
  if (!first) return text;
  first.classList.add('plan-timeline-label');
  text.append(first);
  if (rest.length) {
    const values = document.createElement('div');
    values.className = 'plan-timeline-values';
    values.append(...rest);
    text.append(values);
  }
  return text;
}

/**
 * Builds a highlight box or stat card from an item row: [icon] [text] [variant]
 * @param {Element} row
 * @returns {HTMLDivElement}
 */
function buildCard(row) {
  const [iconCell, textCell, variantCell] = [...row.children];
  const variant = variantCell?.textContent.trim() === 'highlight' ? 'highlight' : 'stat';
  const card = document.createElement('div');
  card.className = `plan-timeline-${variant}`;
  moveInstrumentation(row, card);

  const picture = iconCell?.querySelector('picture');
  if (picture) {
    const icon = document.createElement('span');
    icon.className = 'plan-timeline-icon';
    const img = picture.querySelector('img');
    if (img) {
      img.loading = 'lazy';
      if (!img.alt) img.setAttribute('aria-hidden', 'true');
    }
    icon.append(picture);
    card.append(icon);
  }
  card.append(buildText(textCell));
  return card;
}

/**
 * Builds the CTA pill from the authored link.
 * @param {HTMLAnchorElement} link
 * @returns {HTMLParagraphElement}
 */
function buildCta(link) {
  const cta = document.createElement('a');
  cta.className = 'plan-timeline-cta';
  cta.href = link.getAttribute('href');
  if (link.title) cta.title = link.title;
  moveInstrumentation(link, cta);
  cta.innerHTML = `<span>${link.textContent.trim()}</span><span class="icon icon-right-white-filled"></span>`;
  decorateIcons(cta);
  const wrapper = document.createElement('p');
  wrapper.className = 'plan-timeline-cta-wrapper';
  wrapper.append(cta);
  return wrapper;
}

/**
 * loads and decorates the plan-timeline block
 * rows: [heading & subtitle] [cta] [desktop infographic] [mobile infographic] [cards...]
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const singles = rows.filter((row) => row.children.length === 1);
  const items = rows.filter((row) => row.children.length > 1);
  const [textRow, linkRow, imageRow, mobileImageRow] = singles;

  const header = document.createElement('div');
  header.className = 'plan-timeline-header';
  const textCell = textRow?.firstElementChild;
  if (textCell) {
    moveInstrumentation(textCell, header);
    const heading = textCell.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      heading.classList.add('plan-timeline-title');
      header.append(heading);
    }
    const aside = document.createElement('div');
    aside.className = 'plan-timeline-aside';
    aside.append(...[...textCell.children].filter((el) => el.textContent.trim()));
    const link = linkRow?.querySelector('a[href]');
    if (link) aside.append(buildCta(link));
    if (aside.children.length) header.append(aside);
  }

  const card = document.createElement('div');
  card.className = 'plan-timeline-card';

  const desktopPicture = imageRow?.querySelector('picture');
  const mobilePicture = mobileImageRow?.querySelector('picture');
  if (desktopPicture || mobilePicture) {
    const visual = document.createElement('div');
    visual.className = 'plan-timeline-visual';
    [[desktopPicture, 'desktop', imageRow], [mobilePicture, 'mobile', mobileImageRow]]
      .forEach(([picture, view, row]) => {
        if (!picture) return;
        picture.classList.add(`plan-timeline-visual-${view}`);
        moveInstrumentation(row.firstElementChild, picture);
        visual.append(picture);
      });
    // with a single infographic it is shown on every viewport
    if (!desktopPicture || !mobilePicture) visual.classList.add('plan-timeline-visual-single');
    card.append(visual);
  }

  const cards = items.map(buildCard);
  cards.filter((el) => el.matches('.plan-timeline-highlight')).forEach((el) => card.append(el));
  const stats = cards.filter((el) => el.matches('.plan-timeline-stat'));
  if (stats.length) {
    const list = document.createElement('div');
    list.className = 'plan-timeline-stats';
    // mobile shows two cards per row, an odd first card spans the full row
    if (stats.length % 2) stats[0].classList.add('plan-timeline-stat-wide');
    stats.forEach((stat, i) => {
      if (i) {
        const divider = document.createElement('span');
        divider.className = 'plan-timeline-divider';
        divider.setAttribute('aria-hidden', 'true');
        list.append(divider);
      }
      list.append(stat);
    });
    card.append(list);
  }

  block.replaceChildren(...[header, card].filter((el) => el.children.length));
}
