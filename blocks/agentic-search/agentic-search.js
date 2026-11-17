import { moveInstrumentation } from '../../scripts/scripts.js';

const MOTION_QUERY = window.matchMedia('(prefers-reduced-motion: reduce)');
const PROMPT_MS = 5000;
const PROMPT_EXIT_MS = 500;

const STAR_ICON = '<svg viewBox="0 0 22 22" width="22" height="22" fill="none" aria-hidden="true" focusable="false"><path d="M11 21c-.06 0-.1-.04-.1-.08a3 3 0 0 1-.08-.33c-.09-.8-.1-1.63-.26-2.42-.72-3.7-3.09-5.94-6.68-6.37-.51-.06-1.04-.07-1.55-.13-.16-.01-.18-.33-.02-.36h.03c1.39-.04 2.76-.25 4.04-.84 2.47-1.13 3.77-3.2 4.22-5.92.12-.73.14-1.48.22-2.22.02-.16.34-.16.35 0 .04 1.73.3 3.4 1.09 4.94 1.15 2.25 3.03 3.38 5.34 3.82.66.12 1.34.13 2.01.22h.03c.16.04.15.36-.02.36-1.71.05-3.37.36-4.87 1.3-1.98 1.24-2.97 3.18-3.36 5.5-.12.71-.13 1.45-.2 2.17a2 2 0 0 1-.07.28c-.01.05-.06.08-.11.08Z" fill="url(#agentic-search-star)"/><defs><linearGradient id="agentic-search-star" x1="11" y1="2" x2="11" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#fa1432"/><stop offset="1" stop-color="#1e4679"/></linearGradient></defs></svg>';
const MIC_ICON = '<svg viewBox="0 0 10 14" width="10" height="14" fill="none" aria-hidden="true" focusable="false"><path d="M4.96.5c.9 0 1.62.73 1.62 1.63l-.01 4.25c0 .9-.72 1.62-1.61 1.62-.9 0-1.63-.73-1.63-1.62V2.13C3.33 1.23 4.06.5 4.96.5ZM4.75 10.7l-.43-.06C2.39 10.35.77 8.79.53 6.88h.2c.26 2.16 2.19 3.6 4.23 3.6 2.04 0 3.96-1.44 4.22-3.6h.2c-.24 1.92-1.85 3.48-3.79 3.76l-.42.07v2.25h-.42V10.7Z" stroke="#121212"/></svg>';
const SEND_ICON = '<svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="16" fill="url(#agentic-search-send)"/><path d="M10.3 16.2h11.6M18.6 19.7l3.3-3.5-3.3-3.5" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="agentic-search-send" x1="25.4" y1="0" x2="-9.5" y2="15.7" gradientUnits="userSpaceOnUse"><stop stop-color="#ed3237"/><stop offset=".33" stop-color="#ed3237"/><stop offset="1" stop-color="#7f2224"/></linearGradient></defs></svg>';
const CARD_ARROW = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false"><path d="M11 5 4 12" stroke="url(#agentic-search-arrow)" stroke-width="1.27" stroke-linecap="round"/><path d="M5.33 4.12s5.37-.45 6.18.36c.82.81.36 6.18.36 6.18" stroke="url(#agentic-search-arrow)" stroke-width="1.27" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="agentic-search-arrow" x1="8" y1="4" x2="8" y2="12" gradientUnits="userSpaceOnUse"><stop stop-color="#ff0a11"/><stop offset="1" stop-color="#b8071e"/></linearGradient></defs></svg>';
const BUTTON_ARROW = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" focusable="false"><path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let blockCount = 0;

const asset = (name) => `${window.hlx.codeBasePath}/blocks/agentic-search/${name}`;
const textOf = (cell) => cell?.textContent.trim() || '';

/**
 * Plan card item: [icon] [title] [description] [link]
 * @param {Element} row
 * @returns {HTMLLIElement}
 */
function buildCard(row) {
  const [iconCell, titleCell, descriptionCell, linkCell] = [...row.children];
  const item = document.createElement('li');
  item.className = 'agentic-search-card';
  moveInstrumentation(row, item);
  const href = linkCell?.querySelector('a[href]')?.getAttribute('href');
  const card = document.createElement(href ? 'a' : 'div');
  card.className = 'agentic-search-card-inner';
  if (href) card.href = href;

  const arrow = document.createElement('span');
  arrow.className = 'agentic-search-card-arrow';
  arrow.innerHTML = CARD_ARROW;
  const icon = document.createElement('span');
  icon.className = 'agentic-search-card-icon';
  const picture = iconCell?.querySelector('picture');
  if (picture) {
    picture.querySelector('img')?.setAttribute('alt', '');
    icon.append(picture);
  }
  const text = document.createElement('span');
  text.className = 'agentic-search-card-text';
  text.innerHTML = '<span class="agentic-search-card-title"></span><span class="agentic-search-card-description"></span>';
  text.firstElementChild.textContent = textOf(titleCell);
  text.lastElementChild.textContent = textOf(descriptionCell);
  const infinity = document.createElement('img');
  infinity.className = 'agentic-search-card-infinity';
  infinity.src = asset('agentic-search-card-infinity.webp');
  infinity.alt = '';
  infinity.loading = 'lazy';
  infinity.setAttribute('aria-hidden', 'true');

  card.append(arrow, icon, text, infinity);
  item.append(card);
  return item;
}

/**
 * Banner slide item: [tag, heading & note] [button link] [stats] [desktop & mobile images]
 * @param {Element} row
 * @returns {HTMLLIElement}
 */
function buildSlide(row) {
  const [textCell, ctaCell, statsCell, imageCell] = [...row.children];
  const slide = document.createElement('li');
  slide.className = 'agentic-search-slide';
  moveInstrumentation(row, slide);

  const [desktopPicture, mobilePicture] = [...(imageCell?.querySelectorAll('picture') || [])];
  const art = document.createElement('div');
  art.className = 'agentic-search-slide-art';
  if (desktopPicture) {
    desktopPicture.classList.add('agentic-search-slide-desktop');
    art.append(desktopPicture);
  }
  if (mobilePicture) {
    mobilePicture.classList.add('agentic-search-slide-mobile');
    art.append(mobilePicture);
    art.classList.add('has-mobile');
  }

  const copy = document.createElement('div');
  copy.className = 'agentic-search-slide-copy';
  const elements = [...(textCell?.children || [])].filter((el) => el.textContent.trim());
  const headingIndex = elements.findIndex((el) => el.matches('h1, h2, h3, h4, h5, h6'));
  elements.forEach((el, i) => {
    if (i === headingIndex) el.classList.add('agentic-search-slide-title');
    else el.classList.add(i < headingIndex ? 'agentic-search-slide-tag' : 'agentic-search-slide-note');
  });
  const tags = elements.filter((el) => el.classList.contains('agentic-search-slide-tag'));
  const title = elements[headingIndex];
  const notes = elements.filter((el) => el.classList.contains('agentic-search-slide-note'));
  copy.append(...tags, ...(title ? [title] : []));

  const action = document.createElement('div');
  action.className = 'agentic-search-slide-action';
  const link = ctaCell?.querySelector('a[href]');
  if (link) {
    const cta = document.createElement('a');
    cta.className = 'agentic-search-slide-cta';
    cta.href = link.getAttribute('href');
    const label = /^(\/|https?:)/.test(link.textContent.trim()) ? 'Buy Now' : link.textContent.trim();
    cta.innerHTML = `<span></span><span class="agentic-search-slide-cta-icon">${BUTTON_ARROW}</span>`;
    cta.firstElementChild.textContent = label;
    action.append(cta);
  }
  action.append(...notes);
  copy.append(action);

  // stats: one per paragraph, the bold part is the value ("**99.5%** Claim Settlement Ratio")
  const stats = document.createElement('ul');
  stats.className = 'agentic-search-slide-stats';
  [...(statsCell?.querySelectorAll('p, li') || [])].forEach((el) => {
    const value = el.querySelector('strong, b');
    if (!el.textContent.trim()) return;
    const stat = document.createElement('li');
    stat.innerHTML = '<span class="agentic-search-stat-value"></span><span class="agentic-search-stat-label"></span>';
    stat.firstElementChild.textContent = value ? value.textContent.trim() : el.textContent.trim();
    stat.lastElementChild.textContent = value ? el.textContent.replace(value.textContent, '').trim() : '';
    stats.append(stat);
  });

  slide.append(art, copy, ...(stats.children.length ? [stats] : []));
  return slide;
}

/**
 * Banner slider: swipe / drag with snap, line pagination.
 * @param {HTMLUListElement} track
 * @param {HTMLDivElement} dots
 */
function initSlider(track, dots) {
  const slides = [...track.children];
  dots.hidden = slides.length < 2;
  if (slides.length < 2) return;
  const buttons = slides.map((slide, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'agentic-search-dot';
    dot.setAttribute('aria-label', `Show banner ${i + 1} of ${slides.length}`);
    dot.setAttribute('aria-controls', track.id);
    dot.addEventListener('click', () => {
      track.scrollTo({ left: slide.offsetLeft - slides[0].offsetLeft, behavior: MOTION_QUERY.matches ? 'auto' : 'smooth' });
    });
    return dot;
  });
  dots.append(...buttons);
  const update = () => {
    const left = track.scrollLeft;
    let current = 0;
    slides.forEach((slide, i) => {
      const offset = Math.abs(slide.offsetLeft - slides[0].offsetLeft - left);
      const best = Math.abs(slides[current].offsetLeft - slides[0].offsetLeft - left);
      if (offset < best) current = i;
    });
    buttons.forEach((dot, i) => {
      if (i === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };
  let frame = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }, { passive: true });
  update();
}

/**
 * AI search composer with a rotating, animated placeholder.
 * @param {object} options
 * @returns {HTMLFormElement}
 */
function buildComposer({
  id, prefix, prompts, action, instrumented,
}) {
  const form = document.createElement('form');
  form.className = 'agentic-search-composer';
  form.setAttribute('role', 'search');
  form.noValidate = true;
  instrumented.forEach((cell) => moveInstrumentation(cell, form));
  const inputId = `${id}-input`;
  const label = [prefix, prompts[0]].filter(Boolean).join(' ');
  form.innerHTML = `
    <div class="agentic-search-composer-inner">
      <span class="agentic-search-star">${STAR_ICON}</span>
      <div class="agentic-search-field">
        <label class="agentic-search-sr" for="${inputId}"></label>
        <input class="agentic-search-input" id="${inputId}" name="q" type="search" autocomplete="off" spellcheck="false">
        <div class="agentic-search-placeholder" aria-hidden="true">
          <span class="agentic-search-prefix"></span>
          <span class="agentic-search-prompts"></span>
        </div>
      </div>
      <div class="agentic-search-actions">
        <button class="agentic-search-mic" type="button" aria-label="Search by voice"><span>${MIC_ICON}</span></button>
        <button class="agentic-search-send" type="submit" aria-label="Search">${SEND_ICON}</button>
      </div>
    </div>`;
  const input = form.querySelector('input');
  const field = form.querySelector('.agentic-search-field');
  form.querySelector('label').textContent = label || 'Search';
  form.querySelector('.agentic-search-prefix').textContent = prefix;
  const track = form.querySelector('.agentic-search-prompts');
  const items = prompts.map((text, i) => {
    const span = document.createElement('span');
    span.className = `agentic-search-prompt${i === 0 ? ' is-active' : ''}`;
    span.textContent = text;
    return span;
  });
  track.append(...items);

  // a new prompt slides up every 5 s; paused while hovered or in use
  let current = 0;
  let paused = false;
  const inner = form.firstElementChild;
  inner.addEventListener('mouseenter', () => { paused = true; });
  inner.addEventListener('mouseleave', () => { paused = false; });
  if (items.length > 1 && !MOTION_QUERY.matches) {
    setInterval(() => {
      if (paused || document.activeElement === input || input.value) return;
      const previous = items[current];
      current = (current + 1) % items.length;
      previous.classList.remove('is-active');
      previous.classList.add('is-exit');
      setTimeout(() => previous.classList.remove('is-exit'), PROMPT_EXIT_MS);
      items[current].classList.add('is-active');
    }, PROMPT_MS);
  }
  input.addEventListener('input', () => field.classList.toggle('has-value', input.value.trim() !== ''));

  // voice input where the browser supports it
  const mic = form.querySelector('.agentic-search-mic');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  mic.addEventListener('click', () => {
    if (!Recognition) {
      input.focus();
      return;
    }
    const recognition = new Recognition();
    recognition.lang = document.documentElement.lang || 'en-IN';
    recognition.addEventListener('result', (e) => {
      input.value = e.results[0][0].transcript;
      field.classList.add('has-value');
      input.focus();
    });
    mic.classList.add('is-listening');
    recognition.addEventListener('end', () => mic.classList.remove('is-listening'));
    recognition.start();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim() || prompts[current] || '';
    if (!action || !query) {
      input.focus();
      return;
    }
    const url = new URL(action, window.location.href);
    url.searchParams.set('q', query);
    window.location.assign(url.href);
  });
  return form;
}

/**
 * loads and decorates the agentic-search block
 * rows: [heading] [search prefix] [search prompts] [search page link]
 *       then plan card items and banner slide items
 * After an infinity-intro block in the same section it is revealed by the
 * infinity transition (the infinity shrinks, fades and this screen comes up).
 * @param {Element} block The block element
 */
export default function decorate(block) {
  blockCount += 1;
  const id = `agentic-search-${blockCount}`;
  const rows = [...block.children];
  const fieldRows = rows.filter((row) => row.children.length === 1);
  const [headingRow, prefixRow, promptsRow, actionRow] = fieldRows;
  const itemRows = rows.filter((row) => row.children.length > 1);

  const art = document.createElement('div');
  art.className = 'agentic-search-art';
  art.setAttribute('aria-hidden', 'true');
  const line = document.createElement('img');
  line.className = 'agentic-search-line';
  line.src = asset('agentic-search-line.webp');
  line.alt = '';
  line.loading = 'lazy';
  art.append(line);

  const top = document.createElement('div');
  top.className = 'agentic-search-top';
  const headingCell = headingRow?.firstElementChild;
  if (headingCell?.textContent.trim()) {
    const heading = headingCell.querySelector('h1, h2, h3, h4, h5, h6') || document.createElement('h2');
    if (!heading.textContent.trim()) heading.textContent = headingCell.textContent.trim();
    heading.classList.add('agentic-search-title');
    moveInstrumentation(headingCell, heading);
    top.append(heading);
  }

  const cards = document.createElement('ul');
  cards.className = 'agentic-search-cards';
  const track = document.createElement('ul');
  track.className = 'agentic-search-slides';
  track.id = `${id}-slides`;
  itemRows.forEach((row) => {
    const isSlide = row.querySelector('h1, h2, h3, h4, h5, h6') && !row.firstElementChild?.querySelector('picture');
    if (isSlide) track.append(buildSlide(row));
    else cards.append(buildCard(row));
  });
  if (cards.children.length) top.append(cards);

  const prompts = [...(promptsRow?.firstElementChild?.querySelectorAll('li, p') || [])]
    .filter((el) => !el.querySelector('li'))
    .map((el) => el.textContent.trim())
    .filter(Boolean);
  const composer = buildComposer({
    id,
    prefix: textOf(prefixRow?.firstElementChild),
    prompts,
    action: actionRow?.querySelector('a[href]')?.getAttribute('href') || '',
    instrumented: [prefixRow, promptsRow, actionRow]
      .map((row) => row?.firstElementChild).filter(Boolean),
  });
  top.append(composer);

  const content = document.createElement('div');
  content.className = 'agentic-search-content';
  content.append(top);
  let banners = null;
  if (track.children.length) {
    banners = document.createElement('div');
    banners.className = 'agentic-search-banners';
    const dots = document.createElement('div');
    dots.className = 'agentic-search-dots';
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Banners');
    banners.append(track, dots);
    content.append(banners);
    initSlider(track, dots);
  }
  block.replaceChildren(art, content);

  // reveal for the infinity-intro transition (prototype timings, seconds)
  block.infinityStage = {
    mode: 'fade',
    tweens: () => [
      {
        el: art, at: 5.2, dur: 1.3, ease: 'sine.out', props: { opacity: [0, 1] },
      },
      {
        el: content, at: 5.2, dur: 1.3, ease: 'sine.out', props: { opacity: [0, 1], y: [35, 0] },
      },
      ...(banners ? [{
        el: banners, at: 5.2, dur: 1.3, ease: 'sine.out', props: { opacity: [0, 1], y: [35, 0] },
      }] : []),
    ],
  };
}
