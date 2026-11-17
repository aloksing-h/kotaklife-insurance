import { moveInstrumentation } from '../../scripts/scripts.js';

const ARROW_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">'
  + '<path d="M15.4168 10H4.16675" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M10.8333 15C10.8333 15 15.8333 11.3176 15.8333 10C15.8333 8.68233 10.8333 5 10.8333 5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>'
  + '</svg>';

// where the infinity ends behind the person, relative to the person image
// (Figma desktop and mobile: centre at 50% / 69% of the image, 1.16x its width)
const TARGET = { x: 0.5, y: 0.69, w: 1.16 };

/**
 * Product card item: [logo] [brand lines] [amount] [note]
 * @param {Element} row
 * @returns {HTMLDivElement}
 */
function buildCard(row) {
  const [logoCell, brandCell, amountCell, noteCell] = [...row.children];
  const card = document.createElement('div');
  card.className = 'infinity-banner-card';
  moveInstrumentation(row, card);

  const brand = document.createElement('div');
  brand.className = 'infinity-banner-brand';
  const logo = logoCell?.querySelector('picture');
  if (logo) {
    logo.classList.add('infinity-banner-logo');
    brand.append(logo);
  }
  const lines = document.createElement('div');
  lines.className = 'infinity-banner-brand-text';
  const brandItems = [...(brandCell?.children || [])].filter((el) => el.textContent.trim());
  if (!brandItems.length && brandCell?.textContent.trim()) {
    const p = document.createElement('p');
    p.textContent = brandCell.textContent.trim();
    brandItems.push(p);
  }
  // one line per paragraph or <br>: "Kotak" / "Signature Term"
  brandItems.flatMap((el) => el.innerHTML.split(/<br\s*\/?>/i)).forEach((html) => {
    const line = document.createElement('span');
    line.innerHTML = html;
    if (line.textContent.trim()) lines.append(line);
  });
  brand.append(lines);

  const divider = document.createElement('span');
  divider.className = 'infinity-banner-divider';
  divider.setAttribute('aria-hidden', 'true');

  const price = document.createElement('div');
  price.className = 'infinity-banner-price';
  const amount = document.createElement('p');
  amount.className = 'infinity-banner-amount';
  amount.textContent = amountCell?.textContent.trim() || '';
  const note = document.createElement('p');
  note.className = 'infinity-banner-note';
  const noteSource = noteCell?.querySelector('p') || noteCell;
  if (noteSource) note.append(...noteSource.childNodes);
  price.append(...[amount, note].filter((el) => el.textContent.trim()));

  card.append(brand, divider, price);
  return card;
}

function layer(className, picture) {
  const el = document.createElement('div');
  el.className = className;
  if (picture) el.append(picture);
  return el;
}

/**
 * loads and decorates the infinity-banner block (Rajiv Rao banner)
 * rows: [heading & text] [button link] [person & slogan images] [arm image]
 *       [product card item]
 * In the section after an infinity-intro block it is revealed by the
 * infinity transition: the intro video ends up playing in the infinity behind
 * the person, with strands of it in front and the arm (a cut-out of the
 * person image) on top, as in the prototype.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const [textRow, ctaRow, mediaRow, armRow] = rows.filter((row) => row.children.length === 1);
  const cardRow = rows.find((row) => row.children.length > 1);

  // background shade (under the infinity video)
  const art = document.createElement('div');
  art.className = 'infinity-banner-art';
  art.setAttribute('aria-hidden', 'true');

  // copy: heading, text, card, button
  const copy = document.createElement('div');
  copy.className = 'infinity-banner-copy';
  const textCell = textRow?.firstElementChild;
  if (textCell) {
    moveInstrumentation(textCell, copy);
    [...textCell.children].filter((el) => el.textContent.trim()).forEach((el) => {
      el.classList.add(el.matches('h1, h2, h3, h4, h5, h6') ? 'infinity-banner-title' : 'infinity-banner-text');
      copy.append(el);
    });
  }
  const offer = document.createElement('div');
  offer.className = 'infinity-banner-offer';
  if (cardRow) offer.append(buildCard(cardRow));
  const link = ctaRow?.querySelector('a[href]');
  if (link) {
    const cta = document.createElement('a');
    cta.className = 'infinity-banner-cta';
    cta.href = link.getAttribute('href');
    moveInstrumentation(ctaRow.firstElementChild, cta);
    const isUrl = /^(\/|https?:)/.test(link.textContent.trim());
    cta.innerHTML = `<span class="infinity-banner-cta-label"></span><span class="infinity-banner-cta-icon">${ARROW_ICON}</span>`;
    cta.firstElementChild.textContent = isUrl ? 'Start Now' : link.textContent.trim();
    offer.append(cta);
  }
  if (offer.children.length) copy.append(offer);

  // person (the infinity video plays behind it), arm in front, slogan bubble
  const mediaCell = mediaRow?.firstElementChild;
  const [personPicture, sloganPicture] = [...(mediaCell?.querySelectorAll('picture') || [])];
  const armPicture = armRow?.querySelector('picture');
  const figure = document.createElement('div');
  figure.className = 'infinity-banner-figure';
  if (mediaCell) moveInstrumentation(mediaCell, figure);
  const person = layer('infinity-banner-person', personPicture);
  const arm = layer('infinity-banner-arm', armPicture);
  if (armRow?.firstElementChild) moveInstrumentation(armRow.firstElementChild, arm);
  const slogan = layer('infinity-banner-slogan', sloganPicture);
  figure.append(person, ...(armPicture ? [arm] : []), ...(sloganPicture ? [slogan] : []));

  const content = document.createElement('div');
  content.className = 'infinity-banner-content';
  content.append(copy, figure);
  block.replaceChildren(art, content);

  // reveal for the infinity-intro transition (prototype v6 timings, seconds)
  block.infinityStage = {
    mode: 'swoop',
    front: true,
    tweens: () => [
      {
        el: art, at: 3.5, dur: 1.5, ease: 'sine.out', props: { opacity: [0, 1] },
      },
      {
        el: copy, at: 3.5, dur: 2, ease: 'sine.out', props: { opacity: [0, 1], y: [35, 0] },
      },
      ...[person, arm].map((el) => ({
        el, at: 3.5, dur: 2, ease: 'sine.out', props: { opacity: [0, 1], y: [100, 0] },
      })),
      {
        el: slogan, at: 3.5, dur: 1.2, ease: 'back.out', props: { opacity: [0, 1], scale: [0.3, 1], y: [20, 0] },
      },
    ],
    // the infinity ends behind the person image, wherever the layout puts it
    // (the figure is the image's box and is never transformed)
    target: () => {
      const box = figure.getBoundingClientRect();
      return {
        x: box.left + box.width * TARGET.x,
        y: box.top + box.height * TARGET.y,
        w: box.width * TARGET.w,
      };
    },
  };
}
