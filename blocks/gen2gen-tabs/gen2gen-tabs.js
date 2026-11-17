import { loadCSS } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { getRespectiveDomain } from '../../scripts/dom-helpers.js';

const MOBILE_QUERY = window.matchMedia('(width < 900px)');
const LABELS = { more: 'Read more', less: 'Read less' };
const PUBLISH_DOMAIN = 'https://publish-p190053-e2194583.adobeaemcloud.com';

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
 * Video tab panel: thumbnail + play button, the <video> is only created on click.
 * Item row: [label] [thumbnail] [video]
 * @param {Element} row
 * @param {string} panelId
 * @param {string} tabId
 * @returns {HTMLDivElement}
 */
function buildVideoPanel(row, panelId, tabId) {
  const [, imageCell, videoCell] = [...row.children];
  const panel = document.createElement('div');
  panel.className = 'gen2gen-tabs-video-panel';
  panel.id = panelId;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', tabId);
  panel.tabIndex = 0;
  moveInstrumentation(row, panel);

  const wrap = document.createElement('div');
  wrap.className = 'gen2gen-tabs-video';
  const picture = imageCell?.querySelector('picture');
  const img = picture?.querySelector('img');
  if (img) {
    img.loading = 'lazy';
    img.classList.add('gen2gen-tabs-video-img');
  }
  if (picture) wrap.append(picture);
  panel.append(wrap);

  const href = videoCell?.querySelector('a[href]')?.getAttribute('href')
    || videoCell?.textContent.trim();
  if (!href) return panel;

  const alt = img?.alt;
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'gen2gen-tabs-play';
  play.setAttribute('aria-label', alt ? `Play video: ${alt}` : 'Play video');
  play.innerHTML = `<img src="${window.hlx.codeBasePath}/icons/play-button.svg" alt="" width="28" height="28">`;
  wrap.append(play);

  play.addEventListener('click', async () => {
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'auto';
    if (alt) video.setAttribute('aria-label', alt);
    if (img?.currentSrc) video.poster = img.currentSrc;
    const source = document.createElement('source');
    source.src = await resolveMediaUrl(href);
    source.type = 'video/mp4';
    video.append(source);
    wrap.replaceChildren(video);
    wrap.classList.add('is-playing');
    video.focus();
    video.play().catch(() => { /* autoplay blocked: native controls stay available */ });
  }, { once: true });

  return panel;
}

/**
 * Builds the cards from the grouped cell: [icon][text] x 3.
 * @param {Element} cell
 * @returns {HTMLUListElement|null}
 */
function buildCards(cell) {
  if (!cell) return null;
  const list = document.createElement('ul');
  list.className = 'gen2gen-tabs-cards';
  let card = null;
  let hasText = false;

  const newCard = () => {
    card = document.createElement('li');
    card.className = 'gen2gen-tabs-card';
    list.append(card);
    hasText = false;
  };

  // the cell may be wrapped in a <p> when it starts with an image, so walk
  // pictures and text paragraphs in document order instead of direct children
  const parts = [...cell.querySelectorAll('picture, p')]
    .filter((el) => el.matches('picture') || !el.querySelector('picture, p'));

  parts.forEach((el) => {
    const picture = el.matches('picture') ? el : null;
    if (picture) {
      newCard();
      const icon = document.createElement('span');
      icon.className = 'gen2gen-tabs-card-icon';
      const img = picture.querySelector('img');
      if (img && !img.alt) img.setAttribute('aria-hidden', 'true');
      icon.append(picture);
      card.append(icon);
      return;
    }
    if (!el.textContent.trim()) return;
    if (!card || hasText) newCard();
    el.classList.add('gen2gen-tabs-card-text');
    card.append(el);
    hasText = true;
  });

  return list.children.length ? list : null;
}

/**
 * Mobile Read more / Read less, only shown when the text overflows 4 lines.
 * @param {HTMLElement} textWrap
 * @param {HTMLElement} text
 */
function addReadMore(textWrap, text) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'gen2gen-tabs-toggle';
  toggle.setAttribute('aria-controls', text.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = `<span class="gen2gen-tabs-toggle-ellipsis" aria-hidden="true">…</span><span class="gen2gen-tabs-toggle-label">${LABELS.more}</span>`;
  textWrap.append(toggle);

  const label = toggle.querySelector('.gen2gen-tabs-toggle-label');
  const setExpanded = (expanded) => {
    textWrap.classList.toggle('is-expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    label.textContent = expanded ? LABELS.less : LABELS.more;
  };
  const update = () => {
    if (textWrap.classList.contains('is-expanded')) return;
    const truncated = MOBILE_QUERY.matches && text.scrollHeight > text.clientHeight + 1;
    textWrap.classList.toggle('is-truncated', truncated);
  };

  toggle.addEventListener('click', () => {
    setExpanded(!textWrap.classList.contains('is-expanded'));
    update();
  });
  MOBILE_QUERY.addEventListener('change', () => {
    setExpanded(false);
    update();
  });
  // panels start hidden, so re-measure once they get a size
  new ResizeObserver(update).observe(text);
}

/**
 * Builds one tab panel from an item row: [label] [illustration] [text] [cards]
 * @param {Element} row
 * @param {string} panelId
 * @param {string} tabId
 * @returns {HTMLDivElement}
 */
function buildPanel(row, panelId, tabId) {
  const [, imageCell, textCell, cardsCell] = [...row.children];
  const panel = document.createElement('div');
  panel.className = 'gen2gen-tabs-panel';
  panel.id = panelId;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', tabId);
  panel.tabIndex = 0;
  moveInstrumentation(row, panel);

  const media = document.createElement('div');
  media.className = 'gen2gen-tabs-media';
  const picture = imageCell?.querySelector('picture');
  if (picture) media.append(picture);

  const body = document.createElement('div');
  body.className = 'gen2gen-tabs-body';

  if (textCell?.textContent.trim()) {
    const text = document.createElement('div');
    text.className = 'gen2gen-tabs-text';
    text.id = `${panelId}-text`;
    moveInstrumentation(textCell, text);
    text.append(...textCell.childNodes);
    const textWrap = document.createElement('div');
    textWrap.className = 'gen2gen-tabs-text-wrap';
    textWrap.append(text);
    addReadMore(textWrap, text);
    body.append(textWrap);
  }

  const cards = buildCards(cardsCell);
  if (cards) body.append(cards);

  panel.append(media, body);
  panel.querySelectorAll('img').forEach((img) => { img.loading = 'lazy'; });
  return panel;
}

/**
 * Pill tab bar using the shared tab-animation look (sliding indicator, mobile paddles).
 * @param {HTMLButtonElement[]} tabs
 * @param {HTMLDivElement[]} panels
 * @param {string} label
 * @returns {HTMLDivElement}
 */
function buildTabBar(tabs, panels, label) {
  const nav = document.createElement('div');
  nav.className = 'gen2gen-tabs-nav tab-list tab-animation';
  nav.innerHTML = `<div class="tab-wrapper">
    <div class="tab-mask"><ul role="tablist"></ul><div class="tab-indicator" aria-hidden="true"></div></div>
    <div class="tab-paddles">
      <button type="button" class="paddle-btn paddle-prev" aria-label="Previous tab" tabindex="-1"></button>
      <button type="button" class="paddle-btn paddle-next" aria-label="Next tab" tabindex="-1"></button>
    </div>
  </div>`;
  const list = nav.querySelector('[role="tablist"]');
  if (label) list.setAttribute('aria-label', label);
  const mask = nav.querySelector('.tab-mask');
  const indicator = nav.querySelector('.tab-indicator');
  const prev = nav.querySelector('.paddle-prev');
  const next = nav.querySelector('.paddle-next');

  tabs.forEach((tab) => {
    const li = document.createElement('li');
    li.append(tab);
    list.append(li);
  });

  let active = 0;
  const updateIndicator = () => {
    const tab = tabs[active];
    if (!tab || !tab.offsetWidth) return;
    indicator.style.left = `${tab.offsetLeft}px`;
    indicator.style.width = `${tab.offsetWidth}px`;
    nav.classList.toggle('has-overflow', mask.scrollWidth > mask.clientWidth + 1);
    prev.disabled = active === 0;
    next.disabled = active === tabs.length - 1;
  };

  const select = (index, focus = false) => {
    active = (index + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => {
      const selected = i === active;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
      // stop a playing video when its tab is left
      if (!selected) panels[i].querySelector('video')?.pause();
    });
    const tab = tabs[active];
    const target = tab.offsetLeft - (mask.clientWidth - tab.offsetWidth) / 2;
    mask.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    updateIndicator();
    if (focus) tab.focus();
  };

  tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));
  list.addEventListener('keydown', (e) => {
    const keys = {
      ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: tabs.length - 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    select(keys[e.key], true);
  });
  prev.addEventListener('click', () => select(active - 1));
  next.addEventListener('click', () => select(active + 1));
  const resizeObserver = new ResizeObserver(updateIndicator);
  resizeObserver.observe(list);
  resizeObserver.observe(mask);

  select(0);
  return nav;
}

/**
 * loads and decorates the gen2gen-tabs block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  blockIdx += 1;
  const prefix = `gen2gen-tabs-${blockIdx}`;
  const cssLoaded = loadCSS(`${window.hlx.codeBasePath}/blocks/tab-list/tab-animation.css`);

  const header = document.createElement('div');
  header.className = 'gen2gen-tabs-header';
  const items = [];

  [...block.children].forEach((row) => {
    if (row.children.length > 1) {
      items.push(row);
      return;
    }
    const cell = row.firstElementChild;
    if (cell?.textContent.trim() && !header.children.length) {
      moveInstrumentation(cell, header);
      header.append(...cell.childNodes);
    }
  });

  const tabs = [];
  const panels = [];
  items.forEach((row, i) => {
    const tabId = `${prefix}-tab-${i + 1}`;
    const panelId = `${prefix}-panel-${i + 1}`;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = tabId;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panelId);
    tab.textContent = row.firstElementChild?.textContent.trim() || `Tab ${i + 1}`;
    tabs.push(tab);
    // video tabs have three cells [label, thumbnail, video], persona tabs four
    const isVideo = row.children.length === 3;
    panels.push(isVideo ? buildVideoPanel(row, panelId, tabId) : buildPanel(row, panelId, tabId));
  });

  const content = [];
  if (header.children.length) content.push(header);
  if (tabs.length) {
    const heading = header.querySelector('h1, h2, h3, h4, h5, h6');
    const panelWrap = document.createElement('div');
    panelWrap.className = 'gen2gen-tabs-panels';
    panelWrap.append(...panels);
    await cssLoaded;
    content.push(buildTabBar(tabs, panels, heading?.textContent.trim()), panelWrap);
  }
  block.replaceChildren(...content);
}
