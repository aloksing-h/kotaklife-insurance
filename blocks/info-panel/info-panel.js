/*
 * Info Panel Block
 * Pay premium payment guides (Figma: NEFT 1:3319 / 1:3570, UPI 1:3318 / 1:3571,
 * Kotak Life branch 1:3421, Kotak Mahindra Bank branch 1:3420, mobile 1:3573).
 * A card with a light blue header (heading, description and an illustration), then any of:
 * - Info Row items: [icon] [label] [value]: a two column details list (NEFT details)
 * - Info Card items: [logo] [steps]: app cards (UPI apps)
 * - Check points: the bulleted list of the block, one row per point after a red check
 * - a note (small print) and a notice box with Info Action items (as the Notice Banner)
 * Block rows, in model order: [heading and description] [illustration] [check points]
 * [note] [notice]; then the items (told apart by their number of cells: 3, 2 and 4).
 */
import { loadCSS } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { buildNoticeActions, buildNoticeText } from '../notice-banner/notice-banner.js';

const textOf = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

/**
 * Makes an authored picture lazy and decorative when it has no alt text.
 * @param {Element} cell
 * @returns {HTMLPictureElement|null}
 */
function takePicture(cell) {
  const picture = cell?.querySelector('picture');
  if (!picture) return null;
  const img = picture.querySelector('img');
  if (img) {
    img.loading = 'lazy';
    if (!img.alt) img.setAttribute('aria-hidden', 'true');
  }
  return picture;
}

/**
 * Info Row items as a description list: icon and label, then the value.
 * @param {Element[]} rows
 * @returns {HTMLDListElement}
 */
function buildRows(rows) {
  const list = document.createElement('dl');
  list.className = 'info-panel-rows';
  rows.forEach((row) => {
    const [iconCell, labelCell, valueCell] = [...row.children];
    const item = document.createElement('div');
    item.className = 'info-panel-row';
    moveInstrumentation(row, item);

    const dt = document.createElement('dt');
    dt.className = 'info-panel-label';
    const picture = takePicture(iconCell);
    if (picture) {
      const icon = document.createElement('span');
      icon.className = 'info-panel-icon';
      icon.append(picture);
      dt.append(icon);
    }
    const label = document.createElement('span');
    label.textContent = textOf(labelCell);
    dt.append(label);

    const dd = document.createElement('dd');
    dd.className = 'info-panel-value';
    if (valueCell) dd.append(...valueCell.childNodes);
    // plain text values become a paragraph, so the first paragraph is always the value
    if (!dd.querySelector('p') && textOf(dd)) {
      const p = document.createElement('p');
      p.append(...dd.childNodes);
      dd.append(p);
    }
    item.append(dt, dd);
    list.append(item);
  });
  return list;
}

/**
 * Info Card items: a round logo and the steps.
 * @param {Element[]} rows
 * @returns {HTMLUListElement}
 */
function buildCards(rows) {
  const list = document.createElement('ul');
  list.className = 'info-panel-cards';
  rows.forEach((row) => {
    const [logoCell, textCell] = [...row.children];
    const li = document.createElement('li');
    li.className = 'info-panel-card';
    moveInstrumentation(row, li);
    const picture = takePicture(logoCell);
    if (picture) {
      const logo = document.createElement('span');
      logo.className = 'info-panel-logo';
      logo.append(picture);
      li.append(logo);
    }
    const text = document.createElement('div');
    text.className = 'info-panel-card-text';
    if (textCell) text.append(...textCell.childNodes);
    li.append(text);
    list.append(li);
  });
  return list;
}

/**
 * The check points: each list item of the authored list in its own row.
 * @param {Element} cell
 * @returns {HTMLUListElement|null}
 */
function buildPoints(cell) {
  const items = [...(cell?.querySelectorAll('li') || [])];
  const paragraphs = items.length ? [] : [...(cell?.querySelectorAll('p') || [])];
  const entries = [...items, ...paragraphs].filter((el) => textOf(el));
  if (!entries.length) return null;
  const list = document.createElement('ul');
  list.className = 'info-panel-points';
  entries.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'info-panel-point';
    li.append(...entry.childNodes);
    list.append(li);
  });
  return list;
}

/**
 * loads and decorates the info-panel block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const rows = [...block.children];
  const settings = rows.filter((row) => row.children.length <= 1);
  const [textRow, imageRow, pointsRow, noteRow, noticeRow] = settings;
  const detailRows = rows.filter((row) => row.children.length === 3);
  const cardRows = rows.filter((row) => row.children.length === 2);
  const actionRows = rows.filter((row) => row.children.length >= 4);

  // header: heading and description, illustration
  const header = document.createElement('div');
  header.className = 'info-panel-header';
  const intro = document.createElement('div');
  intro.className = 'info-panel-intro';
  const textCell = textRow?.firstElementChild;
  if (textCell) {
    moveInstrumentation(textCell, intro);
    intro.append(...textCell.childNodes);
  }
  intro.querySelector('h1, h2, h3, h4, h5, h6')?.classList.add('info-panel-title');
  header.append(intro);
  const picture = takePicture(imageRow);
  if (picture) {
    const media = document.createElement('div');
    media.className = 'info-panel-media';
    media.append(picture);
    header.append(media);
  }

  const body = document.createElement('div');
  body.className = 'info-panel-body';
  if (detailRows.length) body.append(buildRows(detailRows));
  if (cardRows.length) body.append(buildCards(cardRows));
  const points = buildPoints(pointsRow?.firstElementChild);
  if (points) body.append(points);

  const noteCell = noteRow?.firstElementChild;
  if (textOf(noteCell)) {
    const note = document.createElement('div');
    note.className = 'info-panel-note';
    moveInstrumentation(noteCell, note);
    note.append(...noteCell.childNodes);
    body.append(note);
  }

  const noticeCell = noticeRow?.firstElementChild;
  const actions = buildNoticeActions(actionRows);
  if (textOf(noticeCell) || actions) {
    // the action cards share the Notice Banner styles
    await loadCSS(`${window.hlx.codeBasePath}/blocks/notice-banner/notice-banner.css`);
    const notice = document.createElement('div');
    notice.className = 'info-panel-notice';
    if (textOf(noticeCell)) notice.append(buildNoticeText(noticeCell));
    if (actions) notice.append(actions);
    body.append(notice);
  }

  block.replaceChildren(header, ...(body.children.length ? [body] : []));
}
