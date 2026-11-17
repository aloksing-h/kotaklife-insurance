import { moveInstrumentation } from '../../scripts/scripts.js';
import { decorateIcons, loadCSS } from '../../scripts/aem.js';

const POSITIONS = ['left', 'center', 'right'];
const FALLBACK_CTA = 'Know more';

/**
 * Turns the authored link into the pill CTA with the red arrow icon.
 * @param {HTMLAnchorElement} link
 * @returns {HTMLParagraphElement}
 */
function buildCta(link) {
  const wrapper = document.createElement('p');
  wrapper.className = 'promo-banner-cta-wrapper';

  // an empty CTA text renders the URL as link text, never show that
  const text = link.textContent.trim();
  const isUrl = !text || text === link.getAttribute('href') || /^(https?:|\/)/.test(text);

  const label = document.createElement('span');
  label.className = 'promo-banner-cta-label';
  label.textContent = isUrl ? (link.title || FALLBACK_CTA) : text;

  const arrow = document.createElement('span');
  arrow.className = 'btn-arrow';

  link.className = 'promo-banner-cta';
  link.replaceChildren(label, arrow);
  wrapper.append(link);
  return wrapper;
}

/**
 * The CTA is the last link that sits on its own line (aem-content field),
 * links inside the description stay inline.
 * @param {Element} cell
 * @returns {HTMLAnchorElement|undefined}
 */
function findCta(cell) {
  return [...cell.querySelectorAll('a[href]')].reverse().find((a) => {
    const line = a.closest('p, li, div');
    return line && line.textContent.trim() === a.textContent.trim();
  });
}

/**
 * Takes the optional stats out of the content cell (Stats field, after the
 * button): one per line or bullet, the bold part is the value, e.g.
 * "<strong>27.6%</strong> Growth".
 * @param {Element} cell
 * @returns {{value: string, label: string}[]}
 */
function takeStats(cell) {
  if (!cell) return [];
  let lines = [];
  const field = cell.querySelector('[data-aue-prop="content_stats"]');
  if (field) {
    lines = [...field.children];
    field.remove();
  } else {
    const ctaLine = findCta(cell)?.closest('p, li, div');
    let next = ctaLine?.parentElement === cell ? ctaLine.nextElementSibling : null;
    while (next) {
      lines.push(next);
      next = next.nextElementSibling;
    }
    lines.forEach((line) => line.remove());
  }
  return lines
    .flatMap((el) => (el.matches('ul, ol') ? [...el.children] : [el]))
    .map((el) => {
      const value = el.querySelector('strong, b')?.textContent.trim() || '';
      const label = el.textContent.replace(value, '').trim();
      return { value, label };
    })
    .filter(({ value, label }) => value || label);
}

/**
 * @param {{value: string, label: string}[]} stats
 * @returns {HTMLUListElement}
 */
function buildStats(stats) {
  const list = document.createElement('ul');
  list.className = 'promo-banner-stats';
  stats.forEach(({ value, label }, i) => {
    const item = document.createElement('li');
    item.className = `promo-banner-stat promo-banner-stat-${i + 1}`;
    [[value, 'value'], [label, 'label']].filter(([text]) => text).forEach(([text, kind]) => {
      const span = document.createElement('span');
      span.className = `promo-banner-stat-${kind}`;
      span.textContent = text;
      item.append(span);
    });
    list.append(item);
  });
  return list;
}

/**
 * Builds the heading / description / CTA column. Works with the published
 * markup and with the Universal Editor markup, where the rich text is
 * wrapped in an instrumented div (kept so inline editing still works).
 * @param {Element} cell
 * @returns {Node[]}
 */
function buildText(cell) {
  if (!cell) return [];
  const cta = findCta(cell);
  const ctaLine = cta?.closest('p, li, div');
  const out = [];
  let hasTitle = false;

  const classify = (el) => {
    if (/^H[1-6]$/.test(el.tagName)) {
      el.classList.add('promo-banner-title');
      hasTitle = true;
    } else {
      el.classList.add('promo-banner-description');
    }
  };

  [...cell.children].forEach((el) => {
    if (el === ctaLine || el.contains(cta)) {
      if (el !== ctaLine && el.tagName === 'DIV') {
        // CTA inside a wrapper: keep the wrapper's other content
        ctaLine?.remove();
      } else return;
    }
    if (!el.textContent.trim()) return;
    if (el.tagName === 'DIV') {
      el.classList.add('promo-banner-text');
      [...el.children].filter((child) => child.textContent.trim()).forEach(classify);
    } else {
      classify(el);
    }
    out.push(el);
  });

  // no heading authored: the first paragraph is the title
  if (!hasTitle) {
    const first = out.flatMap((el) => (el.classList.contains('promo-banner-text') ? [...el.children] : [el]))
      .find((el) => el.textContent.trim());
    first?.classList.replace('promo-banner-description', 'promo-banner-title');
  }

  if (cta) out.push(buildCta(cta));
  return out;
}

/**
 * Reads the visual cell: [photo] [placement] [show curve].
 * @param {Element} cell
 * @returns {{picture: HTMLPictureElement, position: string, curve: boolean}}
 */
function readVisual(cell) {
  const values = [...(cell?.querySelectorAll('p') || [])]
    .map((p) => p.textContent.trim().toLowerCase())
    .concat(cell && !cell.querySelector('p') ? cell.textContent.trim().toLowerCase().split(/\s+/) : []);
  return {
    picture: cell?.querySelector('picture'),
    position: values.find((value) => POSITIONS.includes(value)) || 'left',
    curve: !values.includes('false'),
  };
}

/**
 * Builds a slide from an authored row:
 * [visual image + placement + curve] [background image] [badge] [text + CTA link]
 * @param {Element} row
 * @param {number} index
 * @returns {HTMLLIElement}
 */
function buildSlide(row, index) {
  const [visualCell, bgCell, badgeCell, contentCell] = [...row.children];

  const slide = document.createElement('li');
  slide.className = 'promo-banner-slide';
  slide.dataset.slideIndex = index;
  moveInstrumentation(row, slide);

  const [bgPicture, bgMobilePicture] = [...(bgCell?.querySelectorAll('picture') || [])];
  if (bgPicture) {
    const bg = document.createElement('div');
    bg.className = 'promo-banner-bg';
    const img = bgPicture.querySelector('img');
    if (img) img.alt = '';
    bg.append(bgPicture);
    // optional background of its own for mobile and tablet
    if (bgMobilePicture) {
      bgPicture.classList.add('promo-banner-bg-desktop');
      bgMobilePicture.classList.add('promo-banner-bg-mobile');
      const mobileImg = bgMobilePicture.querySelector('img');
      if (mobileImg) mobileImg.alt = '';
      bg.append(bgMobilePicture);
      slide.classList.add('has-mobile-bg');
    }
    slide.append(bg);
  }

  // Figma shades: three multiply greys and one colour layer blended over the
  // background, so any authored background gets the same red-to-navy look
  for (let i = 1; i <= 4; i += 1) {
    const shade = document.createElement('span');
    shade.className = `promo-banner-shade promo-banner-shade-${i}`;
    shade.setAttribute('aria-hidden', 'true');
    slide.append(shade);
  }

  const content = document.createElement('div');
  content.className = 'promo-banner-content';

  const badgeText = badgeCell?.textContent.trim();
  if (badgeText) {
    const badge = document.createElement('p');
    badge.className = 'promo-banner-badge';
    moveInstrumentation(badgeCell, badge);
    const inner = badgeCell.querySelector('p');
    if (inner) moveInstrumentation(inner, badge);
    badge.textContent = badgeText;
    content.append(badge);
    slide.classList.add('has-badge');
  }

  // optional stats: the slide takes the stats layout (photo centre right,
  // the description as the small print beside the button)
  const stats = takeStats(contentCell);
  content.append(...buildText(contentCell));
  slide.append(content);
  if (stats.length) slide.classList.add('has-stats');

  const { picture, position, curve } = readVisual(visualCell);
  if (picture || curve) {
    const visual = document.createElement('div');
    visual.className = `promo-banner-visual promo-banner-visual-${position}`;
    if (picture) {
      picture.classList.add('promo-banner-photo');
      visual.append(picture);
    }
    if (curve) {
      const line = document.createElement('img');
      line.className = 'promo-banner-curve';
      line.src = `${window.hlx.codeBasePath}/icons/promo-banner-curve.png`;
      line.alt = '';
      line.width = 265;
      line.height = 81;
      line.loading = 'lazy';
      visual.append(line);
    }
    slide.append(visual);
  }
  if (stats.length) slide.append(buildStats(stats));

  if (index > 0) {
    slide.querySelectorAll('img').forEach((img) => { img.loading = 'lazy'; });
  }

  return slide;
}

/**
 * Builds pagination dots and keeps them in sync with the scroll position.
 * @param {Element} block
 * @param {HTMLUListElement} track
 */
function buildPagination(block, track) {
  const slides = [...track.children];
  const dots = document.createElement('div');
  dots.className = 'promo-banner-dots';

  const scrollToSlide = (slide) => {
    track.scrollTo({ left: slide.offsetLeft - track.firstElementChild.offsetLeft });
  };

  const interactiveSelector = 'a, button, input, select, textarea, [contenteditable]';
  let dragged = false;
  const slideOffset = (slide) => slide.offsetLeft - track.firstElementChild.offsetLeft;
  const nearestSlide = () => slides.reduce((closest, slide) => (
    Math.abs(slideOffset(slide) - track.scrollLeft)
      < Math.abs(slideOffset(closest) - track.scrollLeft) ? slide : closest
  ));

  track.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || !event.isPrimary || event.button !== 0
      || event.target.closest(interactiveSelector)) return;

    dragged = false;

    // Keep the page-level pointer observer from claiming this carousel gesture.
    event.stopPropagation();
    const startX = event.clientX;
    const startScroll = track.scrollLeft;
    const startIndex = slides.indexOf(nearestSlide());
    let distance = 0;

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      distance = moveEvent.clientX - startX;
      if (!dragged && Math.abs(distance) < 5) return;
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      dragged = true;
      track.classList.add('is-dragging');
      track.scrollLeft = startScroll - distance;
    };

    const preventDrag = (dragEvent) => dragEvent.preventDefault();
    const onEnd = (endEvent) => {
      if (endEvent.pointerId !== undefined && endEvent.pointerId !== event.pointerId) return;
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onEnd, true);
      window.removeEventListener('pointercancel', onEnd, true);
      window.removeEventListener('blur', onEnd);
      track.removeEventListener('dragstart', preventDrag);
      track.removeEventListener('selectstart', preventDrag);
      let targetIndex = slides.indexOf(nearestSlide());
      if (dragged && Math.abs(distance) >= 40 && targetIndex === startIndex) {
        targetIndex = Math.max(0, Math.min(slides.length - 1, startIndex - Math.sign(distance)));
      }
      track.classList.remove('is-dragging');
      if (dragged) scrollToSlide(slides[targetIndex]);
    };

    window.addEventListener('pointermove', onMove, { capture: true, passive: false });
    window.addEventListener('pointerup', onEnd, true);
    window.addEventListener('pointercancel', onEnd, true);
    window.addEventListener('blur', onEnd);
    track.addEventListener('dragstart', preventDrag);
    track.addEventListener('selectstart', preventDrag);
  });

  const buttons = slides.map((slide, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'promo-banner-dot';
    button.setAttribute('aria-label', `Show slide ${i + 1} of ${slides.length}`);
    button.setAttribute('aria-current', i === 0 ? 'true' : 'false');
    button.addEventListener('click', () => {
      scrollToSlide(slide);
    });
    slide.addEventListener('dblclick', (event) => {
      if (dragged || event.target.closest(interactiveSelector)) return;
      scrollToSlide(slides[(i + 1) % slides.length]);
    });
    dots.append(button);
    return button;
  });

  const setActive = (index) => {
    buttons.forEach((button, i) => button.setAttribute('aria-current', i === index ? 'true' : 'false'));
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActive(Number(entry.target.dataset.slideIndex));
    });
  }, { root: track, threshold: 0.6 });
  slides.forEach((slide) => observer.observe(slide));

  block.append(dots);
}

/**
 * loads and decorates the promo-banner block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const track = document.createElement('ul');
  track.className = 'promo-banner-slides';
  [...block.children].forEach((row, i) => track.append(buildSlide(row, i)));

  // the stats layout has styles of its own, loaded only when a slide uses it
  if (track.querySelector('.has-stats')) {
    await loadCSS(`${window.hlx.codeBasePath}/blocks/promo-banner/promo-banner-stats.css`);
  }
  block.replaceChildren(track);
  decorateIcons(track);

  if (track.children.length > 1) {
    block.setAttribute('role', 'region');
    block.setAttribute('aria-roledescription', 'carousel');
    buildPagination(block, track);
  }
}
