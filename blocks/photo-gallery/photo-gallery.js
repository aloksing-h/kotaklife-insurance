/*
 * Photo Gallery Block
 * Careers page "Your journey starts here" (Figma 11104:9530 desktop, 11104:9784 mobile)
 * and its photo preview (11104:9944 / 11104:9965).
 * Block rows: [heading and description] [pause] [play] [view photo] [previous] [next]
 * [close] labels, then one Photo item per image.
 * The strip scrolls on its own in a loop; the photo at the centre, or under the pointer or
 * keyboard focus, is shown larger and without the red veil. Pressing a photo opens it in a
 * preview dialog with previous and next. The strip stops on hover, focus and touch, when
 * it is off screen, with its play / pause button, and starts stopped for reduced motion.
 */

import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const SPEED = 40; // px per second
const TOUCH_RESUME_MS = 2500;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const LABELS = ['pause', 'play', 'view', 'previous', 'next', 'close'];

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function iconButton(className, label) {
  const button = element('button', className);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  const glyph = element('span', 'photo-gallery-icon');
  glyph.setAttribute('aria-hidden', 'true');
  button.append(glyph);
  return button;
}

/**
 * Reads the block rows: config rows (no picture) in model order, then the photos.
 * @param {Element} block
 */
function readRows(block) {
  const rows = [...block.children];
  const photoRows = rows.filter((row) => row.querySelector('picture'));
  const [textRow, ...labelRows] = rows.filter((row) => !row.querySelector('picture'));
  const labels = Object.fromEntries(LABELS.map((key, i) => [key, labelRows[i]?.textContent.trim() || '']));
  return { textRow, labels, photoRows };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const { textRow, labels, photoRows } = readRows(block);

  const header = element('div', 'photo-gallery-header');
  [...(textRow?.firstElementChild?.children || [])]
    .filter((el) => el.textContent.trim())
    .forEach((el) => {
      el.classList.add(el.matches('h1, h2, h3, h4, h5, h6') ? 'photo-gallery-title' : 'photo-gallery-description');
      header.append(el);
    });

  const photos = photoRows.map((row) => {
    const img = row.querySelector('img');
    return { row, src: img?.getAttribute('src') || '', alt: img?.getAttribute('alt') || '' };
  }).filter((photo) => photo.src);
  const count = photos.length;

  // strip: the photos, then a second, hidden copy so the loop has no gap
  const viewport = element('div', 'photo-gallery-viewport');
  const track = element('ul', 'photo-gallery-track');
  const makeCard = (photo, index, copy) => {
    const item = element('li', 'photo-gallery-card');
    const button = element('button', 'photo-gallery-photo');
    button.type = 'button';
    button.dataset.index = String(index);
    const name = [labels.view, photo.alt].filter(Boolean).join(': ');
    button.setAttribute('aria-label', `${name} (${index + 1} / ${count})`);
    const picture = createOptimizedPicture(photo.src, '', index > 3, [{ width: '480' }]);
    button.append(picture);
    item.append(button);
    if (copy) {
      // the copy is only there for the loop: hidden from screen readers and Tab, but a
      // mouse can still open it
      item.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
    } else {
      moveInstrumentation(photo.row, item);
    }
    return item;
  };
  photos.forEach((photo, i) => track.append(makeCard(photo, i, false)));
  if (count > 1) photos.forEach((photo, i) => track.append(makeCard(photo, i, true)));
  viewport.append(track);

  const toggle = iconButton('photo-gallery-toggle', labels.pause);
  const controls = element('div', 'photo-gallery-controls');
  controls.append(toggle);

  const children = [];
  if (header.children.length) children.push(header);
  children.push(viewport);
  if (count > 1) children.push(controls);
  block.replaceChildren(...children);
  if (!count) return;

  /* ---- centre highlight ---- */
  const cards = [...track.children];
  let active = null;
  let pinned = null; // card under the pointer or keyboard focus
  const setActive = (card) => {
    if (card === active) return;
    active?.classList.remove('is-active');
    active = card;
    active?.classList.add('is-active');
  };
  const updateActive = () => {
    if (pinned) {
      setActive(pinned);
      return;
    }
    const box = viewport.getBoundingClientRect();
    const centre = box.left + box.width / 2;
    let best = null;
    let distance = Infinity;
    cards.forEach((card) => {
      const r = card.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - centre);
      if (d < distance) {
        distance = d;
        best = card;
      }
    });
    setActive(best);
  };

  /* ---- auto scroll ---- */
  let playing = !REDUCED_MOTION.matches;
  let visible = false;
  let hovering = false;
  let focused = false;
  let touching = false;
  let dialogOpen = false;
  let touchTimer = 0;
  let position = viewport.scrollLeft;
  let last = 0;
  let frame = 0;

  const loopWidth = () => (count > 1 ? cards[count].offsetLeft - cards[0].offsetLeft : 0);
  const moving = () => playing && visible && !hovering && !focused && !touching && !dialogOpen;
  const tick = (time) => {
    frame = 0;
    if (!moving()) return;
    const dt = last ? Math.min(time - last, 64) : 0;
    last = time;
    const width = loopWidth();
    position += (SPEED * dt) / 1000;
    if (width && position >= width) position -= width;
    viewport.scrollLeft = position;
    updateActive();
    frame = requestAnimationFrame(tick);
  };
  const run = () => {
    if (frame || !moving()) return;
    last = 0;
    position = viewport.scrollLeft;
    frame = requestAnimationFrame(tick);
  };

  const showToggle = () => {
    toggle.setAttribute('aria-label', playing ? labels.pause : labels.play);
    toggle.classList.toggle('is-paused', !playing);
  };
  showToggle();
  toggle.addEventListener('click', () => {
    playing = !playing;
    showToggle();
    run();
  });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    run();
  }).observe(viewport);

  viewport.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse') return;
    hovering = true;
    pinned = event.target.closest('.photo-gallery-card');
    updateActive();
  });
  viewport.addEventListener('pointerleave', () => {
    hovering = false;
    pinned = null;
    updateActive();
    run();
  });
  viewport.addEventListener('focusin', (event) => {
    focused = true;
    pinned = event.target.closest('.photo-gallery-card');
    updateActive();
  });
  viewport.addEventListener('focusout', (event) => {
    if (viewport.contains(event.relatedTarget)) return;
    focused = false;
    pinned = null;
    updateActive();
    run();
  });
  // touch: the visitor swipes the strip; it carries on a moment after the finger lifts
  viewport.addEventListener('touchstart', () => {
    touching = true;
    clearTimeout(touchTimer);
  }, { passive: true });
  viewport.addEventListener('touchend', () => {
    clearTimeout(touchTimer);
    touchTimer = setTimeout(() => {
      touching = false;
      run();
    }, TOUCH_RESUME_MS);
  }, { passive: true });
  viewport.addEventListener('scroll', () => {
    if (frame) return;
    // a manual scroll past the copy wraps back, so the strip never ends
    const width = loopWidth();
    if (width && viewport.scrollLeft >= width) viewport.scrollLeft -= width;
    position = viewport.scrollLeft;
    updateActive();
  }, { passive: true });

  /* ---- preview dialog ---- */
  let dialog = null;
  let stage = null;
  let current = 0;
  let opener = null;
  const show = (index) => {
    current = (index + count) % count;
    const photo = photos[current];
    const picture = createOptimizedPicture(photo.src, photo.alt, true, [{ width: '1600' }]);
    stage.replaceChildren(picture);
    dialog.setAttribute('aria-label', `${photo.alt || labels.view} (${current + 1} / ${count})`);
  };
  const openDialog = (index, trigger) => {
    if (!dialog) {
      dialog = element('dialog', 'photo-gallery-dialog');
      const close = iconButton('photo-gallery-close', labels.close);
      stage = element('div', 'photo-gallery-stage');
      const prev = iconButton('photo-gallery-prev', labels.previous);
      const next = iconButton('photo-gallery-next', labels.next);
      const nav = element('div', 'photo-gallery-nav');
      nav.append(prev, next);
      dialog.append(close, stage, nav);
      if (count < 2) nav.hidden = true;
      close.addEventListener('click', () => dialog.close());
      prev.addEventListener('click', () => show(current - 1));
      next.addEventListener('click', () => show(current + 1));
      dialog.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') show(current - 1);
        if (event.key === 'ArrowRight') show(current + 1);
      });
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
      });
      // on close the strip carries on from where it was
      dialog.addEventListener('close', () => {
        dialogOpen = false;
        opener?.focus({ preventScroll: true });
        run();
      });
      block.append(dialog);
    }
    opener = trigger;
    dialogOpen = true;
    show(index);
    dialog.showModal();
  };
  track.addEventListener('click', (event) => {
    const button = event.target.closest('.photo-gallery-photo');
    if (button) openDialog(Number(button.dataset.index), button);
  });

  updateActive();
  REDUCED_MOTION.addEventListener('change', () => {
    if (REDUCED_MOTION.matches) playing = false;
    showToggle();
  });
}
