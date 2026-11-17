import { moveInstrumentation } from '../../scripts/scripts.js';

const DESKTOP_QUERY = window.matchMedia('(width >= 900px)');
const MOBILE_VISIBLE = 3;
const LABELS = { more: 'Show More', less: 'Show Less' };

let blockCount = 0;

/**
 * Builds a rider card from an item row: [icon] [title] [description] [link]
 * A card is only clickable when a link is authored.
 * @param {Element} row
 * @returns {HTMLLIElement}
 */
function buildCard(row) {
  const [iconCell, titleCell, descriptionCell, linkCell] = [...row.children];
  const card = document.createElement('li');
  card.className = 'rider-cards-card';
  moveInstrumentation(row, card);

  const top = document.createElement('div');
  top.className = 'rider-cards-top';
  const picture = iconCell?.querySelector('picture');
  if (picture) {
    const icon = document.createElement('span');
    icon.className = 'rider-cards-icon';
    const img = picture.querySelector('img');
    if (img) {
      img.loading = 'lazy';
      if (!img.alt) img.setAttribute('aria-hidden', 'true');
    }
    icon.append(picture);
    top.append(icon);
  }
  card.append(top);

  const body = document.createElement('div');
  body.className = 'rider-cards-body';
  const titleText = titleCell?.textContent.trim();
  const title = document.createElement('h3');
  title.className = 'rider-cards-title';

  const href = linkCell?.querySelector('a[href]')?.getAttribute('href')
    || linkCell?.textContent.trim();
  if (href) {
    // stretched link: the anchor covers the whole card, the title stays its accessible name
    const link = document.createElement('a');
    link.className = 'rider-cards-link';
    link.href = href;
    link.textContent = titleText || href;
    title.append(link);
    card.classList.add('rider-cards-card-linked');
    const arrow = document.createElement('span');
    arrow.className = 'rider-cards-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    top.append(arrow);
  } else {
    title.textContent = titleText || '';
  }
  if (title.textContent) body.append(title);

  const description = [...(descriptionCell?.children || [])].filter((el) => el.textContent.trim());
  if (!description.length && descriptionCell?.textContent.trim()) {
    const p = document.createElement('p');
    p.textContent = descriptionCell.textContent.trim();
    description.push(p);
  }
  description.forEach((el) => el.classList.add('rider-cards-description'));
  body.append(...description);
  card.append(body);
  return card;
}

/**
 * Desktop carousel: native horizontal scroll with snap (touch / trackpad swipe),
 * mouse drag, and pagination dots for every reachable start position.
 * @param {HTMLUListElement} track
 * @param {HTMLDivElement} dots
 * @param {string} id
 */
function initCarousel(track, dots, id) {
  const cards = [...track.children];
  let positions = [];

  const cardLeft = (card) => card.offsetLeft - track.firstElementChild.offsetLeft;
  const activeIndex = () => {
    const { scrollLeft } = track;
    let index = 0;
    positions.forEach((left, i) => {
      if (Math.abs(left - scrollLeft) < Math.abs(positions[index] - scrollLeft)) index = i;
    });
    return index;
  };

  const updateDots = () => {
    const current = activeIndex();
    [...dots.children].forEach((dot, i) => {
      if (i === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };

  const build = () => {
    const max = track.scrollWidth - track.clientWidth;
    positions = [];
    cards.forEach((card) => {
      const left = Math.min(cardLeft(card), max);
      if (!positions.length || left - positions[positions.length - 1] > 1) positions.push(left);
    });
    dots.replaceChildren(...positions.map((left, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'rider-cards-dot';
      dot.setAttribute('aria-label', `Go to slide ${i + 1} of ${positions.length}`);
      dot.setAttribute('aria-controls', id);
      dot.addEventListener('click', () => track.scrollTo({ left, behavior: 'smooth' }));
      return dot;
    }));
    dots.hidden = !DESKTOP_QUERY.matches || positions.length < 2;
    updateDots();
  };

  let frame = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateDots);
  }, { passive: true });

  // mouse drag; touch and trackpads use native scrolling
  let drag = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !DESKTOP_QUERY.matches) return;
    drag = { x: e.clientX, left: track.scrollLeft, moved: false };
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) {
      drag.moved = true;
      track.classList.add('is-dragging');
      track.setPointerCapture(e.pointerId);
    }
    if (drag.moved) track.scrollLeft = drag.left - dx;
  });
  const endDrag = () => {
    if (!drag) return;
    const { moved } = drag;
    drag = null;
    if (!moved) return;
    track.classList.remove('is-dragging');
    const target = positions[activeIndex()];
    track.scrollTo({ left: target, behavior: 'smooth' });
    // swallow the click that follows a drag so linked cards don't navigate
    track.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, { capture: true, once: true });
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('dragstart', (e) => e.preventDefault());

  new ResizeObserver(build).observe(track);
  DESKTOP_QUERY.addEventListener('change', build);
}

/**
 * Desktop: the track runs on to the right edge of the viewport so the card
 * after the third peeks in (Figma); the cards keep the content-column width.
 * @param {HTMLDivElement} carousel
 */
function bleedRight(carousel) {
  const update = () => {
    const space = document.documentElement.clientWidth - carousel.getBoundingClientRect().right;
    carousel.style.setProperty('--rc-bleed', `${Math.max(0, Math.floor(space))}px`);
  };
  // the carousel keeps its width above the max content width, so watch the viewport too
  new ResizeObserver(update).observe(carousel);
  window.addEventListener('resize', update, { passive: true });
}

/**
 * Mobile Show More / Show Less for cards after the first three.
 * @param {HTMLUListElement} track
 * @param {string} id
 * @returns {HTMLButtonElement|null}
 */
function buildToggle(track, id) {
  if (track.children.length <= MOBILE_VISIBLE) return null;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'rider-cards-toggle';
  toggle.setAttribute('aria-controls', id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = `<span class="rider-cards-toggle-label">${LABELS.more}</span><span class="rider-cards-toggle-icon" aria-hidden="true"></span>`;
  const label = toggle.querySelector('.rider-cards-toggle-label');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    track.classList.toggle('is-expanded', expanded);
    label.textContent = expanded ? LABELS.less : LABELS.more;
    if (expanded) track.children[MOBILE_VISIBLE]?.querySelector('a')?.focus({ preventScroll: true });
  });
  return toggle;
}

/**
 * loads and decorates the rider-cards block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  blockCount += 1;
  const id = `rider-cards-${blockCount}`;
  const header = document.createElement('div');
  header.className = 'rider-cards-header';
  const track = document.createElement('ul');
  track.className = 'rider-cards-track';
  track.id = id;

  [...block.children].forEach((row) => {
    if (row.children.length > 1) {
      track.append(buildCard(row));
      return;
    }
    const cell = row.firstElementChild;
    if (!cell?.textContent.trim() || header.children.length) return;
    moveInstrumentation(cell, header);
    const elements = [...cell.children].filter((el) => el.textContent.trim());
    const heading = elements.find((el) => el.matches('h1, h2, h3, h4, h5, h6'));
    if (heading) {
      heading.classList.add('rider-cards-heading');
      header.append(heading);
    }
    const rest = elements.filter((el) => el !== heading);
    if (rest.length) {
      const aside = document.createElement('div');
      aside.className = 'rider-cards-aside';
      aside.append(...rest);
      header.append(aside);
    }
  });

  const heading = header.querySelector('.rider-cards-heading');
  if (heading) {
    heading.id = `${id}-heading`;
    track.setAttribute('aria-labelledby', heading.id);
  }

  const content = [];
  if (header.children.length) content.push(header);
  if (track.children.length) {
    const carousel = document.createElement('div');
    carousel.className = 'rider-cards-carousel';
    const dots = document.createElement('div');
    dots.className = 'rider-cards-dots';
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Slides');
    carousel.append(track, dots);
    const toggle = buildToggle(track, id);
    if (toggle) carousel.append(toggle);
    content.push(carousel);
    initCarousel(track, dots, id);
    bleedRight(carousel);
  }
  block.replaceChildren(...content);
}
