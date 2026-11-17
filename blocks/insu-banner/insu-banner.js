import { moveInstrumentation } from '../../scripts/scripts.js';

/*
 * Insu Banner: the article (insurance guide) banner, Figma "Inner page banners"
 * 9142:10018 (desktop) / 9142:10325 (mobile).
 * Rows (model order): illustration (desktop + optional mobile), text (heading,
 * description, CTA link), read time, views; the share button is always shown.
 */

const ICONS = {
  arrow: '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true" focusable="false"><path d="M3.75 10h12.5m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  share: '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true" focusable="false"><circle cx="14.6" cy="4.6" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="5.4" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="14.6" cy="15.4" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="m7.6 8.7 4.8-2.8m-4.8 5.4 4.8 2.8" stroke="currentColor" stroke-width="1.5"/></svg>',
  email: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false"><path d="M1.33325 4L5.94193 6.61131C7.64099 7.574 8.35885 7.574 10.0579 6.61131L14.6666 4" stroke="currentColor" stroke-width="1.33333" stroke-linejoin="round"/><path d="M1.34377 8.9839C1.38735 11.0276 1.40914 12.0494 2.16323 12.8064C2.91731 13.5634 3.96681 13.5897 6.06581 13.6424C7.35945 13.675 8.64039 13.675 9.93405 13.6424C12.0331 13.5897 13.0825 13.5634 13.8367 12.8064C14.5907 12.0494 14.6125 11.0276 14.6561 8.9839C14.6701 8.32676 14.6701 7.67356 14.6561 7.01643C14.6125 4.97274 14.5907 3.95089 13.8367 3.19394C13.0825 2.43698 12.0331 2.41062 9.93405 2.35788C8.64039 2.32537 7.35945 2.32537 6.0658 2.35787C3.96681 2.4106 2.91731 2.43697 2.16322 3.19393C1.40913 3.95088 1.38735 4.97273 1.34376 7.01643C1.32975 7.67356 1.32975 8.32676 1.34377 8.9839Z" stroke="currentColor" stroke-width="1.33333" stroke-linejoin="round"/></svg>',
  whatsapp: '<svg viewBox="0 0 14 14" width="16" height="16" fill="none" aria-hidden="true" focusable="false"><path d="M6.66664 12.2224C9.73486 12.2224 12.2222 9.73511 12.2222 6.66688C12.2222 3.59863 9.73486 1.11133 6.66664 1.11133C3.59839 1.11133 1.11108 3.59863 1.11108 6.66688C1.11108 7.43294 1.26612 8.16277 1.54654 8.82672C1.70152 9.19361 1.77901 9.37711 1.7886 9.51577C1.7982 9.65444 1.75738 9.80694 1.67576 10.112L1.11108 12.2224L3.22151 11.6578C3.52657 11.5762 3.67911 11.5353 3.81776 11.5449C3.95642 11.5545 4.13989 11.632 4.50683 11.787C5.17078 12.0674 5.90058 12.2224 6.66664 12.2224Z" stroke="currentColor" stroke-width="1.16667" stroke-linecap="round"/><path d="M4.77122 6.87606L5.25508 6.27512C5.459 6.02184 5.71108 5.78606 5.73086 5.44882C5.7358 5.36364 5.67592 4.98121 5.55603 4.21637C5.50892 3.91579 5.22828 3.88867 4.9852 3.88867C4.66844 3.88867 4.51005 3.88867 4.35278 3.96051C4.15399 4.05131 3.94991 4.30662 3.90512 4.52052C3.86969 4.68976 3.89602 4.80638 3.94869 5.03961C4.17238 6.03023 4.69714 7.00856 5.51085 7.82228C6.32458 8.63601 7.30292 9.16078 8.29353 9.38445C8.52675 9.43712 8.64336 9.46345 8.81264 9.42801C9.02653 9.38323 9.28181 9.17917 9.37264 8.98034C9.44447 8.82306 9.44447 8.66473 9.44447 8.34796C9.44447 8.10484 9.41736 7.82423 9.11675 7.77712C8.35192 7.65723 7.96953 7.59734 7.8843 7.60228C7.54708 7.62206 7.3113 7.87412 7.05803 8.07806L6.45708 8.56189" stroke="currentColor" stroke-width="1.16667" stroke-linecap="round"/></svg>',
  copy: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false"><path d="M5.33337 5.3335V4.00016C5.33337 2.5274 6.52728 1.3335 8.00004 1.3335L12 1.3335C13.4728 1.3335 14.6667 2.5274 14.6667 4.00016V8.00016C14.6667 9.47292 13.4728 10.6668 12 10.6668H10.6667M5.33337 5.3335H4.00004C2.52728 5.3335 1.33337 6.5274 1.33337 8.00016V12.0002C1.33337 13.4729 2.52728 14.6668 4.00004 14.6668H8.00004C9.4728 14.6668 10.6667 13.4729 10.6667 12.0002V10.6668M5.33337 5.3335H8.00004C9.4728 5.3335 10.6667 6.5274 10.6667 8.00016V10.6668" stroke="currentColor" stroke-width="1.33333" stroke-linejoin="round"/></svg>',
};
const COPIED_MS = 2000;

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

function isImageAssetLink(link) {
  if (!link) return false;
  const href = link.getAttribute('href') || link.href || '';
  return Boolean(
    link.matches('[data-aue-prop^="image"]')
    || link.closest('[data-aue-prop^="image"]')
    || /\.(png|jpe?g|webp|svg|gif)(\?|$)/i.test(href),
  );
}

/**
 * The authored CTA: the first paragraph holding only a link.
 * @param {Element} cell
 * @returns {HTMLAnchorElement|null}
 */
function buildCta(cell) {
  const p = [...cell.querySelectorAll('p')].find((para) => {
    const link = para.querySelector('a[href]');
    return link && !isImageAssetLink(link) && para.textContent.trim() === link.textContent.trim();
  });
  if (!p) return null;
  const link = p.querySelector('a[href]');
  const cta = el('a', 'insu-banner-cta');
  cta.href = link.href;
  if (link.title) cta.title = link.title;
  if (link.target) cta.target = link.target;
  moveInstrumentation(link, cta);
  const label = el('span', 'insu-banner-cta-label');
  label.textContent = link.textContent.trim();
  cta.append(label, el('span', 'insu-banner-cta-icon', ICONS.arrow));
  p.remove();
  return cta;
}

/**
 * @param {string} name icon name
 * @param {Element} cell authored read time / views cell
 * @returns {HTMLLIElement|null}
 */
function metaItem(name, cell) {
  const text = cell?.textContent.trim();
  if (!text) return null;
  const item = el('li', `insu-banner-meta-item insu-banner-${name}`);
  const label = el('span');
  label.textContent = text;
  moveInstrumentation(cell, label);
  item.append(label);
  return item;
}

/**
 * @param {string} name share icon name
 * @returns {string} outlined share icon
 */
function shareIcon(name) {
  return `<svg class="insu-banner-share-ring" viewBox="0 0 24 24"
    width="24" height="24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="11" stroke="currentColor" stroke-width="1"/>
  </svg>${ICONS[name]}`;
}

/**
 * Share button with an email / WhatsApp / copy link popover.
 * @param {Element} block
 * @param {string} title shared title
 */
function buildShare(block, title) {
  const wrap = el('div', 'insu-banner-share');
  const id = `insu-banner-share-${[...document.querySelectorAll('.insu-banner')].indexOf(block)}`;
  const toggle = el('button', 'insu-banner-share-toggle', ICONS.share);
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Share');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', id);

  const panel = el('div', 'insu-banner-share-panel');
  panel.id = id;
  panel.hidden = true;
  const url = window.location.href.split('#')[0];
  const email = el('a', 'insu-banner-share-option', shareIcon('email'));
  email.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
  email.setAttribute('aria-label', 'Share by email');
  const whatsapp = el('a', 'insu-banner-share-option', shareIcon('whatsapp'));
  whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
  whatsapp.target = '_blank';
  whatsapp.rel = 'noopener noreferrer';
  whatsapp.setAttribute('aria-label', 'Share on WhatsApp');
  const copy = el('button', 'insu-banner-share-option', shareIcon('copy'));
  copy.type = 'button';
  copy.setAttribute('aria-label', 'Copy link');
  const status = el('span', 'insu-banner-share-status');
  status.setAttribute('role', 'status');
  panel.append(email, whatsapp, copy, status);

  let copiedTimer;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'Link copied';
    } catch {
      status.textContent = 'Could not copy the link';
    }
    panel.classList.add('is-copied');
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      panel.classList.remove('is-copied');
      status.textContent = '';
    }, COPIED_MS);
  });

  const updatePosition = () => {
    panel.style.setProperty('--panel-shift', '0px');
    const rect = panel.getBoundingClientRect();
    const margin = 16;
    if (rect.left < margin) {
      const shift = margin - rect.left;
      panel.style.setProperty('--panel-shift', `${shift}px`);
    } else if (rect.right > window.innerWidth - margin) {
      const shift = (window.innerWidth - margin) - rect.right;
      panel.style.setProperty('--panel-shift', `${shift}px`);
    }
  };

  const onPointer = (event) => {
    // eslint-disable-next-line no-use-before-define
    if (!wrap.contains(event.target)) setOpen(false);
  };
  const onKey = (event) => {
    if (event.key !== 'Escape') return;
    // eslint-disable-next-line no-use-before-define
    setOpen(false);
    toggle.focus();
  };
  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    wrap.classList.toggle('is-open', open);
    if (open) {
      updatePosition();
      document.addEventListener('pointerdown', onPointer);
      document.addEventListener('keydown', onKey);
      window.addEventListener('resize', updatePosition);
    } else {
      panel.style.removeProperty('--panel-shift');
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updatePosition);
    }
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));

  wrap.append(toggle, panel);
  return wrap;
}

/**
 * The page breadcrumb (scripts.js puts it in a section of its own at the top)
 * shows at the bottom of this banner, as in the Figma page.
 * @param {Element} inner
 */
function adoptBreadcrumb(inner) {
  const section = document.querySelector('main > .section.breadcrumb-container');
  const wrapper = section?.querySelector(':scope > .breadcrumb-wrapper');
  if (!wrapper) return;
  inner.append(wrapper);
  if (!section.querySelector('.block')) section.remove();
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];

  // Identify rows by content for authoring flexibility
  const imageRow = rows.find((r) => r.querySelector('picture, img'));
  let textRow = rows.find((r) => r.querySelector('h1, h2, h3, h4, h5, h6'));
  if (!textRow && rows.length > 0) {
    textRow = rows.find((r) => r !== imageRow && r.textContent.trim());
  }

  const ctaRow = rows.find((r) => {
    if (r === textRow || r === imageRow) return false;
    if (r.matches('[data-aue-prop^="image"]') || r.querySelector('[data-aue-prop^="image"]')) {
      return false;
    }
    const link = r.querySelector('a[href]');
    if (!link || isImageAssetLink(link)) return false;
    return !r.querySelector('h1, h2, h3, h4, h5, h6') && !/read|view/i.test(r.textContent);
  });

  let readCell = null;
  let viewsCell = null;

  const metaRows = rows.filter((r) => r !== textRow && r !== imageRow && r !== ctaRow);
  metaRows.forEach((r) => {
    const paras = [...r.querySelectorAll('p')];
    if (paras.length > 1) {
      paras.forEach((p) => {
        const text = p.textContent.trim();
        if (/read|update|date/i.test(text)) readCell = p;
        else if (/view/i.test(text)) viewsCell = p;
      });
    } else if (paras.length === 1) {
      const [singlePara] = paras;
      const text = singlePara.textContent.trim();
      if (/read|update|date/i.test(text)) readCell = singlePara;
      else if (/view/i.test(text)) viewsCell = singlePara;
    } else if (r.textContent.trim()) {
      const text = r.textContent.trim();
      if (/read|update|date/i.test(text)) readCell = r.firstElementChild || r;
      else if (/view/i.test(text)) viewsCell = r.firstElementChild || r;
    }
  });

  // Fallbacks for model order [text, readTime, views, image, imageAlt, image_mobile]
  if (!textRow && rows.length >= 1) [textRow] = rows;
  if (!readCell && rows.length >= 2) readCell = rows[1]?.firstElementChild || rows[1];
  if (!viewsCell && rows.length >= 3) viewsCell = rows[2]?.firstElementChild || rows[2];

  const textCell = textRow?.firstElementChild || textRow;

  const inner = el('div', 'insu-banner-inner');
  const hero = el('div', 'insu-banner-hero');
  const content = el('div', 'insu-banner-content');
  if (textRow) moveInstrumentation(textRow, content);

  const heading = textCell?.querySelector('h1, h2, h3, h4, h5, h6');
  let cta = textCell ? buildCta(textCell) : null;
  if (!cta && ctaRow) {
    cta = buildCta(ctaRow) || buildCta(ctaRow.firstElementChild || ctaRow);
  }

  if (heading) {
    heading.classList.add('insu-banner-title');
    content.append(heading);
  }
  [...(textCell?.querySelectorAll('p') || [])]
    .filter((p) => p.textContent.trim())
    .forEach((p) => {
      p.classList.add('insu-banner-description');
      content.append(p);
    });
  if (cta) content.append(cta);

  const meta = el('ul', 'insu-banner-meta');
  [metaItem('read-time', readCell), metaItem('views', viewsCell)]
    .filter(Boolean)
    .forEach((item) => meta.append(item));
  const share = el('li', 'insu-banner-meta-share');
  share.append(buildShare(block, (heading?.textContent || document.title).trim()));
  meta.append(share);
  content.append(meta);

  const pictures = [];
  rows.forEach((r) => {
    if (r !== textRow && r !== ctaRow) {
      const pics = [...r.querySelectorAll('picture')];
      if (pics.length) {
        pictures.push(...pics);
      } else {
        const imgs = [...r.querySelectorAll(':scope > img, p > img, div > img')];
        if (imgs.length) pictures.push(...imgs);
      }
    }
  });
  if (pictures.length) {
    const visual = el('div', 'insu-banner-visual');
    if (imageRow) moveInstrumentation(imageRow, visual);
    pictures.forEach((picture, i) => {
      picture.classList.add(i === 0 ? 'insu-banner-visual-desktop' : 'insu-banner-visual-mobile');
      visual.append(picture);
    });
    if (pictures.length > 1) visual.classList.add('has-mobile');
    hero.append(visual);
  }

  hero.prepend(content);
  inner.append(hero);
  block.replaceChildren(inner);
  adoptBreadcrumb(inner);
}
