import { moveInstrumentation } from '../../scripts/scripts.js';
import { getRespectiveDomain } from '../../scripts/dom-helpers.js';

const PUBLISH_DOMAIN = 'https://publish-p190053-e2194583.adobeaemcloud.com';
const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i;
const YOUTUBE_HOST = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i;
const YOUTUBE_ORIGIN = 'https://www.youtube.com';
const HOVER_QUERY = window.matchMedia('(hover: hover) and (pointer: fine)');
const HOVER_PREVIEW_ENABLED = false;
const MOTION_QUERY = window.matchMedia('(prefers-reduced-motion: reduce)');
const DEFAULT_LABELS = ['Read more', 'Close', 'Previous', 'Next'];
const TEXT = {
  play: 'Play video',
  video: 'Video testimonial',
  slides: 'Testimonials',
  slide: (i, n) => `Go to slide ${i} of ${n}`,
};
const ICON_ARROW = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" focusable="false"><path d="M18.5 12H5M13 18s6-4.42 6-6-6-6-6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" focusable="false"><path d="M17.5 6.5l-11 11M17.5 17.5l-11-11" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Figma "remove" icon of the expanded testimonial
const ICON_REMOVE = '<svg viewBox="0 0 28 28" width="28" height="28" fill="none" aria-hidden="true" focusable="false"><path d="M18.95 9.05l-9.9 9.9M18.95 18.95l-9.9-9.9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Read more / close: the card eases between its slide width and full width
const RESIZE_DURATION = 350;
const RESIZE_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

let blockIdx = 0;

const icon = (name) => `${window.hlx.codeBasePath}/icons/${name}.svg`;
const scrollBehavior = () => (MOTION_QUERY.matches ? 'auto' : 'smooth');

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
 * YouTube embed URL. The origin parameter and a referrer (see the iframe
 * referrerPolicy) are required by YouTube, without them embeds fail with
 * "Error 153 video player configuration error".
 * @param {string} id
 * @param {object} params extra player parameters
 * @returns {string}
 */
function youtubeEmbed(id, params = {}) {
  const query = new URLSearchParams({
    rel: 0, playsinline: 1, enablejsapi: 1, origin: window.location.origin, ...params,
  });
  return `${YOUTUBE_ORIGIN}/embed/${encodeURIComponent(id)}?${query}`;
}

/**
 * Reads an item row.
 * Row: [testimonial type] [name + customer type] [testimonial] [poster + source + video]
 * Rows authored with the earlier two-cell models are still understood.
 * @param {Element} row
 * @returns {object}
 */
function parseRow(row) {
  const cells = [...row.children];
  const values = [
    ...[...row.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
    ...[...row.querySelectorAll('p')].map((p) => p.textContent.trim()),
    ...cells.map((cell) => cell.textContent.trim()),
  ];
  const youtube = values.find((value) => youtubeId(value));
  const dam = values.find((value) => VIDEO_EXT.test(value) && !youtubeId(value));

  let format;
  let personCell;
  let quoteCell;
  let mediaCell;
  if (cells.length >= 4) {
    [, personCell, quoteCell, mediaCell] = cells;
    format = cells[0].textContent.trim().toLowerCase();
  }
  if (format !== 'text' && format !== 'video') {
    format = row.querySelector('picture, video') || youtube || dam ? 'video' : 'text';
  }
  if (cells.length < 4) {
    if (format === 'video') mediaCell = row;
    else [personCell, quoteCell] = cells;
  }

  const source = [...(mediaCell?.querySelectorAll('p') || [])]
    .map((p) => p.textContent.trim().toLowerCase())
    .find((value) => value === 'dam' || value === 'youtube');
  const useYoutube = youtube && (source === 'youtube' || !dam);
  return {
    format,
    personCell,
    quoteCell,
    picture: mediaCell?.querySelector('picture'),
    video: useYoutube
      ? { type: 'youtube', id: youtubeId(youtube) }
      : dam && { type: 'dam', href: dam },
  };
}

/**
 * Muted in-place preview of a DAM video.
 * @param {HTMLDivElement} media
 * @param {string} href
 * @param {HTMLImageElement} img poster
 * @param {function} setState
 * @returns {{load: function, play: function, pause: function, playing: function}}
 */
function damPreview(media, href, img, setState) {
  let video = null;
  return {
    load: async () => {
      if (video) return;
      video = document.createElement('video');
      video.className = 'customer-testimonials-player';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('aria-hidden', 'true');
      if (img?.currentSrc) video.poster = img.currentSrc;
      video.src = await resolveMediaUrl(href);
      video.addEventListener('playing', () => setState(true));
      video.addEventListener('pause', () => setState(false));
      video.addEventListener('ended', () => setState(false));
      media.append(video);
    },
    play: () => {
      if (!video) return;
      video.muted = true;
      video.play().catch(() => {});
    },
    pause: () => video?.pause(),
    playing: () => Boolean(video && !video.paused),
  };
}

/**
 * Muted in-place preview of a YouTube video: a chrome-less embed driven with
 * the IFrame Player API messages (play / pause, state changes).
 * @param {HTMLDivElement} media
 * @param {string} id YouTube video id
 * @param {string} label
 * @param {function} setState
 * @returns {{load: function, play: function, pause: function, playing: function}}
 */
function youtubePreview(media, id, label, setState) {
  let frame = null;
  let ready = null;
  let playing = false;
  let wanted = false;
  const send = (func) => frame?.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args: [] }),
    YOUTUBE_ORIGIN,
  );
  let heard = false;
  const onMessage = (e) => {
    if (e.source !== frame?.contentWindow) return;
    heard = true;
    let message;
    try {
      message = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    } catch {
      return;
    }
    const state = message?.event === 'onStateChange' ? message.info : message?.info?.playerState;
    if (state === undefined || state === null) return;
    playing = state === 1 || state === 3;
    setState(state === 1);
    // a play request that arrived before the player was ready
    if (state === 1 && !wanted) send('pauseVideo');
  };
  return {
    load: () => {
      if (ready) return ready;
      frame = document.createElement('iframe');
      frame.className = 'customer-testimonials-player customer-testimonials-player-youtube';
      frame.src = youtubeEmbed(id, {
        autoplay: 1,
        mute: 1,
        controls: 0,
        loop: 1,
        playlist: id,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
      });
      frame.title = label || TEXT.video;
      frame.allow = 'autoplay; encrypted-media';
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      window.addEventListener('message', onMessage);
      ready = new Promise((resolve) => {
        frame.addEventListener('load', () => {
          // subscribe to player events; repeat until the player answers
          let tries = 0;
          const listen = () => {
            if (heard || tries > 20) return;
            tries += 1;
            const hello = JSON.stringify({ event: 'listening', id, channel: 'widget' });
            frame.contentWindow?.postMessage(hello, YOUTUBE_ORIGIN);
            setTimeout(listen, 250);
          };
          listen();
          resolve();
        }, { once: true });
      });
      media.append(frame);
      return ready;
    },
    play: () => {
      wanted = true;
      send('mute');
      send('playVideo');
    },
    pause: () => {
      wanted = false;
      send('pauseVideo');
      playing = false;
      setState(false);
    },
    playing: () => playing,
  };
}

/**
 * Video card: poster + play button. Hovering (mouse) previews a DAM video
 * muted in place; clicking the card opens the video popup with sound.
 * @param {Element} row
 * @param {object} data parsed row
 * @param {function} openModal
 * @returns {HTMLLIElement}
 */
function buildVideoCard(row, data, openModal) {
  const card = document.createElement('li');
  card.className = 'customer-testimonials-card customer-testimonials-video';
  card.dataset.type = 'video';
  moveInstrumentation(row, card);

  const media = document.createElement('div');
  media.className = 'customer-testimonials-media';
  let { picture } = data;
  if (!picture && data.video?.type === 'youtube') {
    picture = document.createElement('picture');
    picture.innerHTML = `<img src="https://i.ytimg.com/vi/${data.video.id}/hqdefault.jpg" alt="" width="480" height="360">`;
  }
  const img = picture?.querySelector('img');
  if (img) {
    img.loading = 'lazy';
    img.classList.add('customer-testimonials-poster');
  }
  if (picture) media.append(picture);
  card.append(media);

  if (!data.video) return card;
  const label = img?.alt?.trim() || '';
  card.videoData = { ...data.video, label, poster: img };

  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'customer-testimonials-play';
  play.setAttribute('aria-haspopup', 'dialog');
  play.setAttribute('aria-label', label ? `${TEXT.play}: ${label}` : TEXT.play);
  play.innerHTML = `<img src="${icon('play-button')}" alt="" width="28" height="28">`;
  const playIcon = play.firstElementChild;
  card.append(play);

  const setState = (playing) => {
    card.classList.toggle('is-playing', playing);
    playIcon.src = icon(playing ? 'pause-button' : 'play-button');
  };
  const preview = data.video.type === 'youtube'
    ? youtubePreview(media, data.video.id, label, setState)
    : damPreview(media, data.video.href, img, setState);

  // the whole card opens the popup; the play button is its keyboard control
  card.addEventListener('click', () => {
    delete card.dataset.hover;
    preview.pause();
    openModal(card, play);
  });

  // hover preview: muted, mouse only, not for users who prefer reduced motion
  card.addEventListener('pointerenter', async (e) => {
    if (!HOVER_PREVIEW_ENABLED) return;
    if (e.pointerType !== 'mouse' || !HOVER_QUERY.matches || MOTION_QUERY.matches) return;
    if (preview.playing()) return;
    card.dataset.hover = 'true';
    await preview.load();
    if (card.dataset.hover) preview.play();
  });
  card.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse' || !card.dataset.hover) return;
    delete card.dataset.hover;
    preview.pause();
  });

  // stop the preview once the card is scrolled away
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting && preview.playing()) preview.pause();
  }).observe(card);

  return card;
}

/**
 * Text card: name, customer type and testimonial, shortened with Read more.
 * @param {Element} row
 * @param {object} data parsed row
 * @param {object} labels
 * @returns {HTMLLIElement}
 */
function buildTextCard(row, data, labels) {
  const { personCell, quoteCell } = data;
  const card = document.createElement('li');
  card.className = 'customer-testimonials-card customer-testimonials-quote';
  card.dataset.type = 'text';
  moveInstrumentation(row, card);

  const parts = personCell
    ? [...personCell.querySelectorAll('p, h1, h2, h3, h4, h5, h6')]
      .map((el) => el.textContent.trim()).filter(Boolean)
    : [];
  if (!parts.length && personCell?.textContent.trim()) parts.push(personCell.textContent.trim());
  const [name, role, date] = parts;

  const figure = document.createElement('figure');
  figure.className = 'customer-testimonials-figure';
  const caption = document.createElement('figcaption');
  caption.className = 'customer-testimonials-person';
  if (name) {
    const nameEl = document.createElement('p');
    nameEl.className = 'customer-testimonials-name';
    nameEl.textContent = name;
    caption.append(nameEl);
  }
  if (role) {
    const roleEl = document.createElement('p');
    roleEl.className = 'customer-testimonials-role';
    roleEl.textContent = role;
    caption.append(roleEl);
  }
  // optional date, shown at the end of the customer type line
  if (date) {
    const meta = document.createElement('div');
    meta.className = 'customer-testimonials-meta';
    const dateEl = document.createElement('p');
    dateEl.className = 'customer-testimonials-date';
    dateEl.textContent = date;
    const roleEl = caption.querySelector('.customer-testimonials-role');
    if (roleEl) meta.append(roleEl);
    meta.append(dateEl);
    caption.append(meta);
  }

  const quote = document.createElement('blockquote');
  quote.className = 'customer-testimonials-text';
  let full = [];
  if (quoteCell) {
    moveInstrumentation(quoteCell, quote);
    full = [...quoteCell.children];
    if (!full.length && quoteCell.textContent.trim()) {
      const p = document.createElement('p');
      p.textContent = quoteCell.textContent.trim();
      full = [p];
    }
  }
  quote.append(...full.map((el) => el.cloneNode(true)));

  if (caption.children.length) figure.append(caption);
  figure.append(quote);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'customer-testimonials-close';
  close.setAttribute('aria-label', name ? `${labels.close}: ${name}` : labels.close);
  close.innerHTML = ICON_REMOVE;
  close.hidden = true;

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'customer-testimonials-more';
  more.textContent = labels.readMore;
  more.setAttribute('aria-expanded', 'false');
  if (name) more.setAttribute('aria-label', `${labels.readMore}: ${name}`);

  card.append(close, figure);
  card.textData = {
    quote, full, more, close, words: full.map((el) => el.textContent).join(' ').split(/\s+/).filter(Boolean),
  };
  return card;
}

/** Shows the whole testimonial. */
function showFull(card) {
  const { quote, full } = card.textData;
  quote.replaceChildren(...full.map((el) => el.cloneNode(true)));
}

/**
 * Shortens the testimonial to the lines that fit and appends Read more.
 * The rest of the text stays available to screen readers.
 * @param {HTMLLIElement} card
 */
function shorten(card) {
  const { quote, words, more } = card.textData;
  showFull(card);
  const fits = () => quote.scrollHeight <= quote.clientHeight + 1;
  if (fits() || words.length < 2) return;

  const p = document.createElement('p');
  const shown = document.createElement('span');
  const ellipsis = document.createElement('span');
  ellipsis.textContent = '… ';
  ellipsis.setAttribute('aria-hidden', 'true');
  const rest = document.createElement('span');
  rest.className = 'customer-testimonials-sr';
  p.append(shown, rest, ellipsis, more);
  quote.replaceChildren(p);

  let low = 0;
  let high = words.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    shown.textContent = words.slice(0, mid).join(' ');
    if (fits()) low = mid;
    else high = mid - 1;
  }
  shown.textContent = words.slice(0, low).join(' ');
  rest.textContent = ` ${words.slice(low).join(' ')}`;
}

/**
 * Prev / next arrow button.
 * @param {string} direction prev | next
 * @param {string} label
 * @returns {HTMLButtonElement}
 */
function arrowButton(direction, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `customer-testimonials-arrow customer-testimonials-arrow-${direction}`;
  button.setAttribute('aria-label', label);
  button.innerHTML = ICON_ARROW;
  return button;
}

/**
 * Video popup: DAM videos play in a native player, YouTube in an embed.
 * The arrows move between the video testimonials only.
 * @param {object} labels
 * @param {HTMLLIElement[]} videoCards
 * @returns {{ dialog: HTMLDialogElement, open: function }}
 */
function createModal(labels, videoCards) {
  const dialog = document.createElement('dialog');
  dialog.className = 'customer-testimonials-modal';
  dialog.setAttribute('aria-label', TEXT.video);

  const inner = document.createElement('div');
  inner.className = 'customer-testimonials-modal-inner';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'customer-testimonials-modal-close';
  close.setAttribute('aria-label', labels.close);
  close.innerHTML = ICON_CLOSE;
  const player = document.createElement('div');
  player.className = 'customer-testimonials-modal-player';
  const prev = arrowButton('prev', labels.previous);
  const next = arrowButton('next', labels.next);
  inner.append(close, player, prev, next);
  dialog.append(inner);

  let current = 0;
  let token = 0;
  let opener = null;

  const show = async (index) => {
    current = index;
    token += 1;
    const ticket = token;
    const { videoData } = videoCards[index];
    dialog.setAttribute('aria-label', videoData.label || TEXT.video);
    prev.disabled = index === 0;
    next.disabled = index === videoCards.length - 1;
    prev.hidden = videoCards.length < 2;
    next.hidden = videoCards.length < 2;

    if (videoData.type === 'youtube') {
      const iframe = document.createElement('iframe');
      iframe.src = youtubeEmbed(videoData.id, { autoplay: 1 });
      iframe.title = videoData.label || TEXT.video;
      iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      player.replaceChildren(iframe);
      return;
    }
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'auto';
    if (videoData.label) video.setAttribute('aria-label', videoData.label);
    const poster = videoData.poster?.currentSrc || videoData.poster?.src;
    if (poster) video.poster = poster;
    player.replaceChildren(video);
    const src = await resolveMediaUrl(videoData.href);
    if (ticket !== token) return;
    video.src = src;
    video.play().catch(() => { /* autoplay blocked: native controls stay available */ });
  };

  prev.addEventListener('click', () => current > 0 && show(current - 1));
  next.addEventListener('click', () => current < videoCards.length - 1 && show(current + 1));
  close.addEventListener('click', () => dialog.close());
  // click on the dimmed area around the player closes the popup
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target === inner) dialog.close();
  });
  dialog.addEventListener('close', () => {
    token += 1;
    player.replaceChildren();
    opener?.focus({ preventScroll: true });
  });

  return {
    dialog,
    open: (card, button) => {
      const index = videoCards.indexOf(card);
      if (index < 0) return;
      opener = button;
      if (!dialog.open) dialog.showModal();
      show(index);
      close.focus();
    },
  };
}

/**
 * Native horizontal scroll with snap (touch / trackpad swipe), mouse drag,
 * line pagination (collapsed) and prev / next arrows (expanded).
 * Positions are computed from the visible cards, so the expanded view, where
 * video cards are hidden, only stops on text testimonials.
 * @param {HTMLUListElement} track
 * @param {HTMLDivElement} dots
 * @param {HTMLDivElement} arrows
 * @returns {object}
 */
function initCarousel(track, dots, arrows) {
  const cards = [...track.children];
  const [prev, next] = [...arrows.children];
  let positions = [];

  const visible = () => cards.filter((card) => card.getClientRects().length);
  const leftOf = (card) => card.offsetLeft - (visible()[0]?.offsetLeft || 0);
  const activeIndex = () => {
    const { scrollLeft } = track;
    let index = 0;
    positions.forEach((left, i) => {
      if (Math.abs(left - scrollLeft) < Math.abs(positions[index] - scrollLeft)) index = i;
    });
    return index;
  };

  const update = () => {
    const current = activeIndex();
    [...dots.children].forEach((dot, i) => {
      if (i === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    prev.disabled = current === 0;
    next.disabled = current >= positions.length - 1;
  };

  const refresh = () => {
    const max = track.scrollWidth - track.clientWidth;
    positions = [];
    visible().forEach((card) => {
      const left = Math.min(leftOf(card), max);
      if (!positions.length || left - positions[positions.length - 1] > 1) positions.push(left);
    });
    if (dots.children.length !== positions.length) {
      dots.replaceChildren(...positions.map((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'customer-testimonials-dot';
        dot.setAttribute('aria-label', TEXT.slide(i + 1, positions.length));
        dot.setAttribute('aria-controls', track.id);
        dot.addEventListener('click', () => track.scrollTo({ left: positions[i], behavior: scrollBehavior() }));
        return dot;
      }));
    }
    update();
  };

  const go = (delta) => {
    const index = Math.max(0, Math.min(positions.length - 1, activeIndex() + delta));
    track.scrollTo({ left: positions[index], behavior: scrollBehavior() });
  };
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));

  let frame = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }, { passive: true });

  // mouse drag; touch and trackpads use native scrolling
  let drag = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return;
    drag = { x: e.clientX, left: track.scrollLeft, moved: false };
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) {
      drag.moved = true;
      track.classList.add('is-dragging');
      track.setPointerCapture(e.pointerId);
    }
    if (drag.moved) track.scrollLeft = drag.left - dx;
  });
  const endDrag = () => {
    if (!drag) return;
    const { moved } = drag;
    drag = null;
    if (!moved) return;
    track.classList.remove('is-dragging');
    track.scrollTo({ left: positions[activeIndex()], behavior: scrollBehavior() });
    // swallow the click that follows a drag so a video card doesn't open
    track.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, { capture: true, once: true });
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('dragstart', (e) => e.preventDefault());

  return {
    refresh, leftOf, positionCount: () => positions.length,
  };
}

/**
 * Inert, attribute-free copy of an element, pinned where it is laid out now,
 * so the old layout can stay on screen while the new one animates in.
 * @param {HTMLElement} el
 * @param {{left: number, top: number, width: number, height?: number}} [box]
 *   position in the offset parent, defaults to the element's own
 * @returns {HTMLElement}
 */
function ghostOf(el, box) {
  const {
    left = el.offsetLeft, top = el.offsetTop, width = el.offsetWidth, height,
  } = box || {};
  const ghost = el.cloneNode(true);
  // no second iframe / video download for a copy that lives a few frames
  ghost.querySelectorAll('iframe, video').forEach((media) => media.remove());
  [ghost, ...ghost.querySelectorAll('*')].forEach((node) => {
    [...node.attributes]
      .filter(({ name }) => name === 'id' || name.startsWith('data-aue') || name.startsWith('data-richtext'))
      .forEach(({ name }) => node.removeAttribute(name));
  });
  ghost.classList.add('customer-testimonials-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  Object.assign(ghost.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    ...(height ? { height: `${height}px` } : {}),
  });
  return ghost;
}

/**
 * Animates a change of the slide layout (Read more / close) as in the Figma
 * prototype: the card eases from its old width to its new one while the
 * other cards travel with it unchanged (on expand the next cards are pushed
 * off to the right, on close they slide back in) and the track height
 * follows. The text never re-wraps: it is laid out at its final width from
 * the first frame and cross-fades with a copy of the old text. The layout
 * itself is changed by `change`, so the end state is exactly the static one.
 * @param {HTMLUListElement} track
 * @param {HTMLLIElement} card the card that expands or collapses
 * @param {Function} change applies the new layout and scroll position
 * @returns {Promise<void>}
 */
function animateLayout(track, card, change) {
  if (MOTION_QUERY.matches || !card.animate) {
    change();
    return Promise.resolve();
  }
  const block = track.closest('.customer-testimonials');
  const visible = () => [...track.children].filter((item) => item.getClientRects().length);
  const trackBox = track.getBoundingClientRect();
  const from = card.getBoundingClientRect();
  const fromHeight = track.offsetHeight;
  const figure = card.querySelector('.customer-testimonials-figure');
  const textGhost = card.textData && figure ? ghostOf(card.textData.quote) : null;
  // the other cards in view keep their old look while they slide (on expand
  // they are relaid full width with the whole text, or hidden if videos)
  const others = visible().filter((item) => {
    const box = item.getBoundingClientRect();
    return item !== card && box.right > trackBox.left && box.left < trackBox.right;
  }).map((item) => ({ item, box: item.getBoundingClientRect() }));

  block.classList.add('is-resizing');
  change();
  const to = card.getBoundingClientRect();
  const toHeight = track.offsetHeight;
  const figureWidth = figure?.offsetWidth;
  const growth = Math.max(0, to.width - from.width);
  const style = getComputedStyle(track);
  // while the card is still narrow the track is shorter than at the end; the
  // extra end padding keeps the final scroll position reachable
  if (growth) track.style.paddingInlineEnd = `${parseFloat(style.paddingInlineEnd) + growth}px`;
  const options = { duration: RESIZE_DURATION, easing: RESIZE_EASE };
  const shift = from.left - to.left;
  const cards = visible();
  const animations = cards.map((item) => item.animate(
    [{ transform: `translateX(${shift}px)` }, { transform: 'none' }],
    options,
  ));
  animations.push(card.animate(
    [{ flexBasis: `${from.width}px` }, { flexBasis: `${to.width}px` }],
    options,
  ));
  animations.push(track.animate(
    [{ height: `${fromHeight}px` }, { height: `${toHeight}px` }],
    options,
  ));

  // text: laid out at its final width from the first frame so it never
  // re-wraps; the old text cross-fades out on top of it (clipped by the card)
  const ghosts = [];
  if (textGhost) {
    figure.style.width = `${figureWidth}px`;
    figure.append(textGhost);
    ghosts.push(textGhost);
    animations.push(textGhost.animate([{ opacity: 1 }, { opacity: 0 }], options));
    animations.push(card.textData.quote.animate([{ opacity: 0 }, { opacity: 1 }], options));
    const { close } = card.textData;
    if (!close.hidden) {
      animations.push(close.animate(
        [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }],
        options,
      ));
    }
  }

  if (growth) {
    // the cards before slide out to the left with the row, the ones after
    // are pushed right by the growing card
    const pushed = to.right - from.right;
    others.forEach(({ item, box }) => {
      const ghost = ghostOf(item, {
        left: box.left - trackBox.left + track.scrollLeft,
        top: box.top - trackBox.top,
        width: box.width,
        height: box.height,
      });
      track.append(ghost);
      ghosts.push(ghost);
      const distance = box.left < from.left ? -shift : pushed;
      animations.push(ghost.animate(
        [{ transform: 'none' }, { transform: `translateX(${distance}px)` }],
        options,
      ));
    });
    cards.filter((item) => item !== card).forEach((item) => animations.push(item.animate(
      [{ opacity: 0 }, { opacity: 0 }],
      options,
    )));
  } else {
    // on close the gutter the expanded track ran into is wiped away with it
    const gutter = parseFloat(style.marginInlineEnd);
    block.classList.remove('is-resizing');
    const extra = parseFloat(getComputedStyle(track).marginInlineEnd) - gutter;
    block.classList.add('is-resizing');
    if (extra > 0) {
      animations.push(track.animate(
        [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: `inset(0 ${extra}px 0 0)` }],
        options,
      ));
    }
  }

  return Promise.all(animations.map((animation) => animation.finished)).then(() => {
    ghosts.forEach((ghost) => ghost.remove());
    figure?.style.removeProperty('width');
    track.style.removeProperty('padding-inline-end');
    block.classList.remove('is-resizing');
  });
}

/**
 * loads and decorates the customer-testimonials block
 * rows: [heading & subtitle] [labels] [testimonials...]
 * @param {Element} block The block element
 */
export default function decorate(block) {
  blockIdx += 1;
  const id = `customer-testimonials-${blockIdx}`;
  const rows = [...block.children];
  const [textRow, labelsRow] = rows.filter((row) => row.children.length === 1);
  const authored = [...(labelsRow?.firstElementChild?.querySelectorAll('p') || [])]
    .map((p) => p.textContent.trim());
  const [readMore, close, previous, next] = DEFAULT_LABELS
    .map((fallback, i) => authored[i] || fallback);
  const labels = {
    readMore, close, previous, next,
  };

  const header = document.createElement('div');
  header.className = 'customer-testimonials-header';
  const textCell = textRow?.firstElementChild;
  if (textCell?.textContent.trim()) {
    moveInstrumentation(textCell, header);
    const elements = [...textCell.children].filter((el) => el.textContent.trim());
    const title = elements.find((el) => el.matches('h1, h2, h3, h4, h5, h6'));
    if (title) {
      title.classList.add('customer-testimonials-title');
      title.id = title.id || `${id}-heading`;
    }
    elements.filter((el) => el !== title)
      .forEach((el) => el.classList.add('customer-testimonials-subtitle'));
    header.append(...elements);
  }

  const track = document.createElement('ul');
  track.className = 'customer-testimonials-track';
  track.id = `${id}-track`;
  const videoCards = [];
  const textCards = [];
  let modal = null;
  const openModal = (card, button) => modal?.open(card, button);
  rows.filter((row) => row.children.length > 1).forEach((row) => {
    const data = parseRow(row);
    const card = data.format === 'video'
      ? buildVideoCard(row, data, openModal)
      : buildTextCard(row, data, labels);
    if (card.videoData) videoCards.push(card);
    if (card.textData) textCards.push(card);
    track.append(card);
  });
  const heading = header.querySelector('.customer-testimonials-title');
  if (heading) track.setAttribute('aria-labelledby', heading.id);
  else track.setAttribute('aria-label', TEXT.slides);

  const dots = document.createElement('div');
  dots.className = 'customer-testimonials-dots';
  dots.setAttribute('role', 'group');
  dots.setAttribute('aria-label', TEXT.slides);

  const arrows = document.createElement('div');
  arrows.className = 'customer-testimonials-arrows';
  arrows.hidden = true;
  arrows.append(arrowButton('prev', previous), arrowButton('next', next));
  [...arrows.children].forEach((button) => button.setAttribute('aria-controls', track.id));

  const carousel = document.createElement('div');
  carousel.className = 'customer-testimonials-carousel';
  carousel.append(track, dots, arrows);

  const content = [...(header.children.length ? [header] : []), carousel];
  if (videoCards.length) {
    modal = createModal(labels, videoCards);
    content.push(modal.dialog);
  }
  block.replaceChildren(...content);

  const slider = initCarousel(track, dots, arrows);
  let expanded = null;
  let restoreLeft = 0;

  const syncControls = () => {
    slider.refresh();
    dots.hidden = Boolean(expanded) || slider.positionCount() < 2;
    arrows.hidden = !expanded || slider.positionCount() < 2;
  };

  // expanded: every text testimonial full width with its whole text, video
  // testimonials hidden, so the arrows and swipe skip them
  // one Read more / close animation at a time
  let animating = false;

  // shorten the testimonials whenever the card width changes (first layout,
  // resize, web fonts), then recompute the slide positions; skipped while a
  // card animates its width and run once the animation has finished
  let lastWidth = 0;
  const relayout = (force) => {
    if (animating) return;
    // the slide width only counts while collapsed (expanded cards are full width)
    if (!expanded) {
      const width = textCards[0]?.offsetWidth || 0;
      if (force || width !== lastWidth) textCards.forEach(shorten);
      lastWidth = width;
    }
    syncControls();
  };

  const expand = (card) => {
    if (animating || expanded) return;
    animating = true;
    restoreLeft = track.scrollLeft;
    animateLayout(track, card, () => {
      expanded = card;
      block.classList.add('is-expanded');
      textCards.forEach((textCard) => {
        showFull(textCard);
        textCard.textData.close.hidden = false;
        textCard.textData.more.setAttribute('aria-expanded', 'true');
      });
      syncControls();
      track.scrollTo({ left: slider.leftOf(card), behavior: 'auto' });
      syncControls();
      card.textData.close.focus({ preventScroll: true });
    }).finally(() => {
      animating = false;
      relayout(false);
    });
  };

  const collapse = () => {
    if (animating || !expanded) return;
    animating = true;
    const origin = expanded;
    // the card in view is the one that shrinks back (arrows may have moved on)
    const current = textCards.find((textCard) => Math.abs(slider.leftOf(textCard)
      - track.scrollLeft) < 2) || origin;
    animateLayout(track, current, () => {
      expanded = null;
      block.classList.remove('is-expanded');
      textCards.forEach((textCard) => {
        textCard.textData.close.hidden = true;
        textCard.textData.more.setAttribute('aria-expanded', 'false');
        shorten(textCard);
      });
      syncControls();
      track.scrollTo({ left: restoreLeft, behavior: 'auto' });
      const target = origin?.textData.more.isConnected ? origin.textData.more : origin;
      if (target === origin) origin.tabIndex = -1;
      target?.focus({ preventScroll: true });
    }).finally(() => {
      animating = false;
      relayout(false);
    });
  };

  textCards.forEach((card) => {
    card.textData.more.addEventListener('click', () => expand(card));
    card.textData.close.addEventListener('click', collapse);
  });
  block.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && expanded && !modal?.dialog.open) collapse();
  });

  new ResizeObserver(() => relayout(false)).observe(track);
  // web fonts load after the first section; text metrics change when they arrive
  document.fonts?.addEventListener('loadingdone', () => relayout(true));
  document.fonts?.ready.then(() => relayout(true));
}
