import { moveInstrumentation } from '../../scripts/scripts.js';

const ARROW_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" focusable="false"><path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Sets every "%" of the heading smaller (Figma: Zero% GST / 100% Protection.).
 * @param {Element} heading
 */
function shrinkPercents(heading) {
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.filter((node) => node.textContent.includes('%')).forEach((node) => {
    const parts = node.textContent.split('%');
    const fragment = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (part) fragment.append(part);
      if (i < parts.length - 1) {
        const percent = document.createElement('span');
        percent.className = 'offer-banner-percent';
        percent.textContent = '%';
        fragment.append(percent);
      }
    });
    node.replaceWith(fragment);
  });
}

/**
 * loads and decorates the offer-banner block (second home banner, e.g. Zero% GST)
 * rows: [heading, text & button link] [image, image for mobile (optional)]
 *       [background desktop, mobile]
 * option (class): autoplay-3 / autoplay-8 / autoplay-off (slider autoplay; 5 s by default)
 * Placed in the section of an infinity-banner (or with other offer banners),
 * the last offer banner turns the section's banners into a slider.
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const [contentRow, imageRow, backgroundRow] = [...block.children];
  const option = [...block.classList].find((name) => name.startsWith('autoplay-'));
  let autoplay = null;
  if (option === 'autoplay-off') autoplay = 0;
  else if (option) autoplay = parseFloat(option.slice('autoplay-'.length)) || null;

  // decorative background: desktop and mobile art
  const art = document.createElement('div');
  art.className = 'offer-banner-art';
  art.setAttribute('aria-hidden', 'true');
  const [desktopArt, mobileArt] = [...(backgroundRow?.querySelectorAll('picture') || [])];
  if (backgroundRow?.firstElementChild) moveInstrumentation(backgroundRow.firstElementChild, art);
  [[desktopArt, 'desktop'], [mobileArt, 'mobile']].forEach(([pic, kind]) => {
    if (!pic) return;
    pic.classList.add(`offer-banner-art-${kind}`);
    pic.querySelector('img')?.setAttribute('alt', '');
    art.append(pic);
  });
  if (!mobileArt) art.classList.add('offer-banner-art-single');
  // wide screens: a soft, stretched copy of the desktop art fills either side
  // of the 1200 px design
  const desktopImg = desktopArt?.querySelector('img');
  if (desktopImg) {
    const fill = document.createElement('img');
    fill.className = 'offer-banner-art-fill';
    fill.src = desktopImg.getAttribute('src');
    fill.alt = '';
    fill.loading = 'lazy';
    art.prepend(fill);
  }

  // copy: heading, text, button (the button is the last paragraph that is
  // only a link)
  const copy = document.createElement('div');
  copy.className = 'offer-banner-copy';
  const contentCell = contentRow?.firstElementChild;
  let link = null;
  if (contentCell) {
    moveInstrumentation(contentCell, copy);
    const items = [...contentCell.children].filter((el) => el.textContent.trim());
    const last = items[items.length - 1];
    const lastLink = last?.querySelector('a[href]');
    if (last?.matches('p') && lastLink && last.textContent.trim() === lastLink.textContent.trim()) {
      link = lastLink;
      items.pop();
    }
    items.forEach((el) => {
      if (el.matches('h1, h2, h3, h4, h5, h6')) {
        el.classList.add('offer-banner-title');
        shrinkPercents(el);
      } else {
        el.classList.add('offer-banner-text');
      }
      copy.append(el);
    });
  }
  if (link) {
    const cta = document.createElement('a');
    cta.className = 'offer-banner-cta';
    cta.href = link.getAttribute('href');
    if (link.title) cta.title = link.title;
    const label = link.textContent.trim();
    cta.innerHTML = `<span class="offer-banner-cta-label"></span><span class="offer-banner-cta-icon">${ARROW_ICON}</span>`;
    cta.firstElementChild.textContent = /^(\/|https?:)/.test(label) ? 'Buy Now' : label;
    copy.append(cta);
  }

  // the cut-out image on the right (with an optional one for mobile)
  const visual = document.createElement('div');
  visual.className = 'offer-banner-visual';
  const [picture, mobilePicture] = [...(imageRow?.querySelectorAll('picture') || [])];
  if (picture) {
    moveInstrumentation(imageRow.firstElementChild, visual);
    picture.classList.add('offer-banner-image-desktop');
    visual.append(picture);
  }
  if (mobilePicture) {
    mobilePicture.classList.add('offer-banner-image-mobile');
    visual.append(mobilePicture);
    visual.classList.add('has-mobile-image');
  }

  const content = document.createElement('div');
  content.className = 'offer-banner-content';
  content.append(copy, visual);
  block.replaceChildren(art, content);

  // the last offer banner of the section turns its banners into a slider
  const section = block.closest('.section');
  const banners = section ? [...section.querySelectorAll('.offer-banner')] : [];
  const editing = window.self !== window.top;
  if (!editing && banners.length && banners[banners.length - 1] === block) {
    const { default: initBannerSlider } = await import('./offer-banner-slider.js');
    await initBannerSlider(section, { autoplay });
  }
}
