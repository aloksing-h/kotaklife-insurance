import { decorateIcons } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { getRespectiveDomain } from '../../scripts/dom-helpers.js';

const TYPES = ['text-list', 'image', 'video'];
const PUBLISH_DOMAIN = 'https://publish-p190053-e2194583.adobeaemcloud.com';
const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i;
const YOUTUBE_HOST = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i;
const YOUTUBE_ORIGIN = 'https://www.youtube.com';
const TEXT = { play: 'Play video', video: 'Video' };

let blockIdx = 0;

/**
 * DAM paths (/content/dam/...) are served from AEM publish, not from EDS.
 * Same resolution as the video block.
 * @param {string} href
 * @returns {Promise<string>}
 */
async function resolveMediaUrl(href) {
  try {
    const url = new URL(href, window.location.href);
    if (!url.pathname.startsWith('/content/')) return url.href;
    const domain = await getRespectiveDomain();
    return `${domain === true ? PUBLISH_DOMAIN : domain}${url.pathname}`;
  } catch {
    return href;
  }
}

/**
 * YouTube video id of a watch, share, embed or shorts URL.
 * @param {string} href
 * @returns {string}
 */
function youtubeId(href) {
  try {
    const url = new URL(href);
    if (!YOUTUBE_HOST.test(url.hostname)) return '';
    const id = url.hostname.endsWith('youtu.be')
      ? url.pathname.split('/')[1]
      : url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1];
    return /^[\w-]{6,20}$/.test(id || '') ? id : '';
  } catch {
    return '';
  }
}

/**
 * Link and text values of a cell, used to recognise video sources.
 * @param {Element} cell
 * @returns {string[]}
 */
function cellValues(cell) {
  return [
    ...[...cell.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
    ...[...cell.querySelectorAll('p')].map((p) => p.textContent.trim()),
    cell.textContent.trim(),
  ];
}

/**
 * Sorts the block-level rows by what they contain, so empty or hidden
 * fields never shift the others: text, button link, images, video.
 * @param {Element[]} rows single-cell rows
 * @returns {object}
 */
function readSettings(rows) {
  const settings = {};
  rows.forEach((row) => {
    const cell = row.firstElementChild;
    if (!cell || (!cell.textContent.trim() && !cell.querySelector('picture'))) return;
    const values = cellValues(cell);
    const links = [...cell.querySelectorAll('a[href]')];
    const isVideo = values.some((v) => VIDEO_EXT.test(v) || youtubeId(v))
      || values.some((v) => v === 'dam' || v === 'youtube');
    if (isVideo && !settings.video) settings.video = cell;
    else if (cell.querySelector('picture') && !settings.media) settings.media = cell;
    else if (!settings.text) {
      // heading, subtitle and button share one cell: the button is the last
      // link on its own line, links inside the subtitle stay inline
      settings.text = cell;
      const cta = links.reverse().find((a) => {
        const line = a.closest('p, li');
        return line && line.textContent.trim() === a.textContent.trim();
      });
      if (cta) {
        settings.link = cta;
        cta.closest('p, li').remove();
      }
    }
  });
  return settings;
}

/**
 * Pill CTA (red, white arrow circle).
 * @param {HTMLAnchorElement} link
 * @returns {HTMLParagraphElement}
 */
function buildCta(link) {
  const text = link.textContent.trim();
  const label = text && !/^(https?:|\/)/.test(text) ? text : 'Buy Online';
  const cta = document.createElement('a');
  cta.className = 'how-it-works-cta';
  cta.href = link.getAttribute('href');
  if (link.title && link.title !== label) cta.title = link.title;
  moveInstrumentation(link, cta);
  cta.innerHTML = '<span></span><span class="icon icon-right-white-filled"></span>';
  cta.firstElementChild.textContent = label;
  decorateIcons(cta);
  const wrapper = document.createElement('p');
  wrapper.className = 'how-it-works-cta-wrapper';
  wrapper.append(cta);
  return wrapper;
}

/**
 * Section header: heading, subtitle(s) and CTA.
 * @param {object} settings
 * @param {string} id
 * @returns {HTMLDivElement}
 */
function buildHeader(settings, id) {
  const header = document.createElement('div');
  header.className = 'how-it-works-header';
  const intro = document.createElement('div');
  intro.className = 'how-it-works-intro';
  const aside = document.createElement('div');
  aside.className = 'how-it-works-aside';

  const { text } = settings;
  if (text) {
    // the Universal Editor wraps rich text in an instrumented div
    const wrapper = [...text.children].find((el) => el.tagName === 'DIV' && el.dataset.aueProp);
    const source = wrapper || text;
    if (wrapper) moveInstrumentation(wrapper, intro);
    else moveInstrumentation(text, intro);
    const elements = [...source.children].filter((el) => el.textContent.trim());
    let title = elements.find((el) => /^H[1-6]$/.test(el.tagName));
    if (!title && elements.length) {
      // no heading authored: the first paragraph is the title
      title = document.createElement('h2');
      title.append(...elements[0].childNodes);
      elements[0].replaceWith(title);
      elements[0] = title;
    }
    title.classList.add('how-it-works-title');
    title.id = title.id || `${id}-title`;
    intro.append(title);
    elements.filter((el) => el !== title).forEach((el) => {
      el.classList.add('how-it-works-subtitle');
      aside.append(el);
    });
  }
  if (settings.link) aside.append(buildCta(settings.link));

  header.append(intro);
  if (aside.children.length) header.append(aside);
  return header;
}

/**
 * Numbered steps from the Step items: [title] [description].
 * @param {Element[]} rows
 * @returns {HTMLOListElement|null}
 */
function buildSteps(rows) {
  const steps = rows.map((row) => {
    const [titleCell, descCell] = [...row.children];
    const title = titleCell?.textContent.trim();
    if (!title && !descCell?.textContent.trim()) return null;
    const li = document.createElement('li');
    li.className = 'how-it-works-step';
    moveInstrumentation(row, li);

    const body = document.createElement('div');
    body.className = 'how-it-works-step-body';
    if (title) {
      const h3 = document.createElement('h3');
      h3.className = 'how-it-works-step-title';
      moveInstrumentation(titleCell, h3);
      h3.textContent = title;
      body.append(h3);
    }
    if (descCell?.textContent.trim()) {
      const desc = document.createElement('div');
      desc.className = 'how-it-works-step-text';
      moveInstrumentation(descCell, desc);
      const blocks = [...descCell.children];
      if (blocks.length) desc.append(...blocks);
      else desc.textContent = descCell.textContent.trim();
      body.append(desc);
    }
    li.append(body);
    return li;
  }).filter(Boolean);
  if (!steps.length) return null;

  const list = document.createElement('ol');
  list.className = 'how-it-works-steps';
  steps.forEach((li, i) => {
    const badge = document.createElement('span');
    badge.className = 'how-it-works-step-number';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = String(i + 1).padStart(2, '0');
    li.prepend(badge);
  });
  list.append(...steps);
  return list;
}

/**
 * Infographic: desktop image, optional mobile image (below 900px).
 * @param {Element} cell
 * @returns {HTMLDivElement|null}
 */
function buildImage(cell) {
  const pictures = [...(cell?.querySelectorAll('picture') || [])];
  if (!pictures.length) return null;
  const [desktop, mobile] = pictures;
  const alt = desktop.querySelector('img')?.alt || '';
  const media = document.createElement('div');
  media.className = 'how-it-works-media';
  desktop.classList.add('how-it-works-image', mobile ? 'how-it-works-image-desktop' : 'how-it-works-image-all');
  media.append(desktop);
  if (mobile) {
    const img = mobile.querySelector('img');
    if (img && !img.alt) img.alt = alt;
    mobile.classList.add('how-it-works-image', 'how-it-works-image-mobile');
    media.append(mobile);
  }
  media.querySelectorAll('img').forEach((img) => { img.loading = 'lazy'; });
  return media;
}

/**
 * Video: poster + play button, the player replaces the poster on click.
 * @param {Element} cell [poster] [source] [DAM link] [YouTube URL]
 * @returns {HTMLDivElement|null}
 */
function buildVideo(cell) {
  if (!cell) return null;
  const values = cellValues(cell);
  const source = values.find((v) => v === 'dam' || v === 'youtube');
  const ytId = youtubeId(values.find((v) => youtubeId(v)) || '');
  const dam = values.find((v) => VIDEO_EXT.test(v) && !youtubeId(v));
  const useYoutube = ytId && (source === 'youtube' || !dam);
  if (!useYoutube && !dam) return null;

  const media = document.createElement('div');
  media.className = 'how-it-works-video';
  let picture = cell.querySelector('picture');
  if (!picture && useYoutube) {
    picture = document.createElement('picture');
    // widescreen thumbnail (hqdefault is 4:3 with black bars), hqdefault when missing
    picture.innerHTML = `<img src="https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg" alt="" width="1280" height="720">`;
    picture.firstElementChild.addEventListener('error', (e) => {
      e.target.src = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    }, { once: true });
  }
  const img = picture?.querySelector('img');
  if (img) {
    img.loading = 'lazy';
    img.classList.add('how-it-works-poster');
  }
  if (picture) media.append(picture);

  const label = img?.alt?.trim() || '';
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'how-it-works-play';
  play.setAttribute('aria-label', label ? `${TEXT.play}: ${label}` : TEXT.play);
  play.innerHTML = `<img src="${window.hlx.codeBasePath}/icons/play-button.svg" alt="" width="28" height="28">`;
  media.append(play);

  play.addEventListener('click', async () => {
    let player;
    if (useYoutube) {
      const query = new URLSearchParams({
        autoplay: 1, rel: 0, playsinline: 1, origin: window.location.origin,
      });
      player = document.createElement('iframe');
      player.src = `${YOUTUBE_ORIGIN}/embed/${encodeURIComponent(ytId)}?${query}`;
      player.title = label || TEXT.video;
      player.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
      player.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    } else {
      player = document.createElement('video');
      player.controls = true;
      player.playsInline = true;
      player.preload = 'auto';
      if (label) player.setAttribute('aria-label', label);
      if (img?.currentSrc) player.poster = img.currentSrc;
      player.src = await resolveMediaUrl(dam);
    }
    player.className = 'how-it-works-player';
    media.replaceChildren(player);
    media.classList.add('is-playing');
    if (player.tagName === 'VIDEO') {
      player.focus();
      player.play().catch(() => { /* autoplay blocked: native controls stay available */ });
    } else {
      player.focus();
    }
  }, { once: true });

  return media;
}

/**
 * loads and decorates the how-it-works block
 * rows: [heading, subtitle & button] [images] [video] [steps...]
 * @param {Element} block The block element
 */
export default function decorate(block) {
  blockIdx += 1;
  const id = `how-it-works-${blockIdx}`;
  const type = TYPES.find((t) => block.classList.contains(t)) || 'text-list';
  block.classList.add(type);

  const rows = [...block.children];
  const settings = readSettings(rows.filter((row) => row.children.length === 1));
  const stepRows = rows.filter((row) => row.children.length > 1);

  const header = buildHeader(settings, id);
  let body = null;
  if (type === 'image') body = buildImage(settings.media);
  else if (type === 'video') body = buildVideo(settings.video);
  else body = buildSteps(stepRows);

  if (body) {
    body.classList.add('how-it-works-body');
    const title = header.querySelector('.how-it-works-title');
    if (title && body.tagName === 'OL') body.setAttribute('aria-labelledby', title.id);
  }
  block.replaceChildren(...[header, body].filter(Boolean));
}
