/*
 * Video Cards Block
 * Life Advisor page video section (Figma 11291:43956 desktop, 11291:44036 mobile):
 * a centred heading and description, then Video Card items (thumbnail, title,
 * description, video). Four in a row on desktop, two by two on mobile. The play button
 * opens the video in a dialog; the player (DAM, YouTube or Vimeo) is the Video
 * Testimonials one and loads only when the visitor presses play.
 */

import { moveInstrumentation } from '../../scripts/scripts.js';
import { createPlayer, toUrl } from '../video-testimonials/video-testimonials.js';

const UI = {
  play: 'Play video',
  close: 'Close video',
};

function element(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text) el.textContent = text;
  return el;
}

function iconButton(className, label) {
  const button = element('button', className);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(element('span', 'video-cards-icon'));
  button.firstChild.setAttribute('aria-hidden', 'true');
  return button;
}

/**
 * Builds one card from an item row: [thumbnail] [video] [title] [description]
 * @param {Element} row
 * @returns {{ card: HTMLLIElement, play: HTMLButtonElement|null, item: object }}
 */
function buildCard(row) {
  const [imageCell, videoCell, titleCell, descriptionCell] = row.children;
  const picture = imageCell?.querySelector('picture');
  const img = picture?.querySelector('img');
  const link = videoCell?.querySelector('a[href]');
  const title = titleCell?.textContent.trim() || link?.title.trim() || '';
  const description = descriptionCell?.textContent.trim() || '';
  const url = toUrl(link?.getAttribute('href') || videoCell?.textContent.trim() || '');

  const card = element('li', 'video-cards-card');
  moveInstrumentation(row, card);
  if (picture) {
    if (img) {
      img.loading = 'lazy';
      // the title names the video; the blurred thumbnail is decorative
      img.alt = '';
    }
    const media = element('div', 'video-cards-media');
    media.append(picture);
    card.append(media);
  }

  let play = null;
  if (url) {
    play = iconButton('video-cards-play', title ? `${UI.play}: ${title}` : UI.play);
    card.append(play);
  }

  const body = element('div', 'video-cards-body');
  if (title) body.append(element('h3', 'video-cards-title', title));
  if (description) body.append(element('p', 'video-cards-description', description));
  card.append(body);

  return {
    card,
    play,
    item: { url, title, poster: img?.currentSrc || img?.src || '' },
  };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const textRow = rows.find((row) => row.children.length === 1);
  const itemRows = rows.filter((row) => row.children.length > 1);

  const header = element('div', 'video-cards-header');
  [...(textRow?.firstElementChild?.children || [])]
    .filter((el) => el.textContent.trim())
    .forEach((el) => {
      el.classList.add(el.matches('h1, h2, h3, h4, h5, h6') ? 'video-cards-heading' : 'video-cards-text');
      header.append(el);
    });

  const list = element('ul', 'video-cards-list');
  const cards = itemRows.map(buildCard);
  cards.forEach(({ card }) => list.append(card));

  // the dialog is created on first use; closing it removes the player, which stops playback
  let dialog = null;
  let stage = null;
  let close = null;
  let opener = null;
  // embedded players (YouTube) take keyboard focus as they load, and Escape no longer
  // reaches the dialog; focus taken in the first moments goes back to the close button
  const keepFocus = (player) => {
    if (player.tagName !== 'IFRAME') return;
    const onBlur = () => setTimeout(() => {
      if (document.activeElement === player) close.focus();
    });
    window.addEventListener('blur', onBlur);
    setTimeout(() => window.removeEventListener('blur', onBlur), 2000);
  };
  const openDialog = (item, trigger) => {
    if (!dialog) {
      dialog = element('dialog', 'video-cards-dialog');
      close = iconButton('video-cards-close', UI.close);
      stage = element('div', 'video-cards-stage');
      dialog.append(close, stage);
      close.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener('close', () => {
        stage.replaceChildren();
        opener?.focus();
      });
      block.append(dialog);
    }
    opener = trigger;
    dialog.setAttribute('aria-label', item.title || UI.play);
    const player = createPlayer(item, 'video-cards');
    stage.replaceChildren(player);
    dialog.showModal();
    keepFocus(player);
  };
  cards.forEach(({ play, item }) => play?.addEventListener('click', () => openDialog(item, play)));

  const children = [];
  if (header.children.length) children.push(header);
  if (list.children.length) children.push(list);
  block.replaceChildren(...children);
}
