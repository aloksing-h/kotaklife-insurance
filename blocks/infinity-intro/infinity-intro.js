import { moveInstrumentation } from '../../scripts/scripts.js';
import createTimeline, { EASE, elementTarget } from './infinity-timeline.js';

const DESKTOP_QUERY = window.matchMedia('(width >= 900px)');
const PUBLISH_ORIGIN = 'https://publish-p190053-e2194583.adobeaemcloud.com';

const STEP_MS = { forward: 2500, backward: 1800 };
// const NAV_SWITCH_LEAD_MS = 1000;
const NAV_THEME_SWITCH_MS = 1000;
const SHUTTER_MS = 1500;
const SHUTTER_EASE = 'power2.inOut';
const HERO_FADE_MS = 1000;
const INTRO_FADE_MS = 600;
const PREWARM_S = 0.5;
const SWIPE_PX = 35;
// trackpads keep sending wheel events after a step; swallow them until they pause
const WHEEL_SETTLE_MS = 250;
const DESIGN_WIDTH = 1200;
// with no banner after it, the intro hands over to a following section with
// one of these styles (agentic flow: Looking For)
const SECTION_PARTNERS = ['looking-for'];

// the infinity mask image (1600 x 961): it is fully opaque within this radius
// of its centre (fraction of its width), so a mask this large covers the stage
const MASK_RATIO = 961 / 1600;
const MASK_CORE = 0.085;
// prototype: the infinity starts at 11.6x and fits the ribbon at 0.82x
const START_FACTOR = 11.6 / 0.82;
// a landscape video on a portrait screen (no mobile video authored) sits at
// the bottom at this multiple of the screen width instead of filling it
// (Figma mobile: the infinity about 75% of the width, low in the frame)
const BOTTOM_ZOOM = 1.65;
// where the infinity ribbon sits in each video (fractions of the video frame);
// CSS can override them with --infinity-ribbon-x / -y / -w
const RIBBON = {
  desktop: { x: 0.508, y: 0.512, w: 0.461 },
  mobile: { x: 0.514, y: 0.77, w: 0.643 },
};

const MOUSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
  <path d="M31.8113 29.0094C31.8113 33.1636 28.4436 36.5313 24.2894 36.5313C20.1352 36.5313 16.7676 33.1636 16.7676 29.0094V22.5621C16.7676 18.4079 20.1352 15.0403 24.2894 15.0403C28.4436 15.0403 31.8113 18.4079 31.8113 22.5621V28.5796" stroke-width="2" stroke-linecap="round" stroke="white"/>
  <path class="infinity-intro-wheel" d="M24.29 18.2666V21.4902" stroke-width="2" stroke-linecap="round" stroke="white"/>
  <path d="M27.3828 6.80444L27.3828 12.607" stroke-linecap="round" stroke="#FA1432"/>
  <path d="M21.3555 1L21.3555 10.6709" stroke-linecap="round" stroke="#FA1432"/>
  <path opacity="0.3" d="M23.6445 39.2646L23.6445 47.0014" stroke-linecap="round" stroke="#FA1432"/>
  <path opacity="0.7" d="M17.8428 37.0383L17.8428 40.262" stroke-linecap="round" stroke="#FA1432"/>
  <path opacity="0.7" d="M30.7373 38.0383L30.7373 43.1962" stroke-linecap="round" stroke="#FA1432"/>
</svg>`;

// on the preview / live hosts DAM files come from AEM publish; on the site's own
// domain the CDN serves /content/dam itself
const PREVIEW_HOSTS = ['aem.page', 'aem.live', 'localhost'];
// Delivery (Dynamic Media) /play URLs are an HTML player page, not a video file
const DELIVERY_PLAY = /^(https:\/\/delivery-[^/]+\/adobe\/assets\/urn:aaid:aem:[^/]+)\/play\/?$/;

/**
 * Absolute URL of an authored video.
 * @param {string} href
 * @returns {string}
 */
function videoUrl(href) {
  const play = href.match(DELIVERY_PLAY);
  if (play) return `${play[1]}/original/as/video.mp4`;
  const onPreview = PREVIEW_HOSTS.some((host) => window.location.hostname.endsWith(host));
  if (href.startsWith('/content/dam/') && onPreview) return `${PUBLISH_ORIGIN}${href}`;
  return new URL(href, window.location.href).href;
}

/**
 * Opens the connection to a video host on another origin right away, so the
 * first bytes of the intro arrive sooner.
 * @param {string} src
 */
function preconnect(src) {
  const { origin } = new URL(src);
  if (origin === window.location.origin) return;
  if ([...document.head.querySelectorAll('link[rel="preconnect"]')].some((link) => link.href.startsWith(origin))) return;
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = origin;
  document.head.append(link);
}

/**
 * Resolves once the video has painted a frame, so revealing it never shows a
 * black frame. A failed video resolves false instead of pretending it painted.
 * @param {HTMLVideoElement} video
 * @returns {Promise<boolean>}
 */
function painted(video) {
  return new Promise((resolve) => {
    let pending = false;
    let callback = null;
    let frame;
    let failed;
    const finish = (ready) => {
      video.removeEventListener('loadeddata', frame);
      video.removeEventListener('playing', frame);
      video.removeEventListener('error', failed);
      if (callback !== null) video.cancelVideoFrameCallback?.(callback);
      resolve(ready);
    };
    failed = () => finish(false);
    frame = () => {
      if (pending || video.readyState < 2) return;
      pending = true;
      if (video.requestVideoFrameCallback && !video.paused) {
        callback = video.requestVideoFrameCallback(() => finish(true));
      } else {
        requestAnimationFrame(() => finish(true));
      }
    };
    video.addEventListener('loadeddata', frame);
    video.addEventListener('playing', frame);
    video.addEventListener('error', failed, { once: true });
    if (video.error) failed();
    else frame();
  });
}

/**
 * A cell with up to two video links: [intro, loop], or just [loop].
 * @param {Element} cell
 * @returns {{ intro: string|null, loop: string|null }}
 */
function readVideos(cell) {
  const links = [...(cell?.querySelectorAll('a[href]') || [])]
    .map((a) => a.getAttribute('href'))
    .filter(Boolean)
    .map(videoUrl);
  if (links.length > 1) return { intro: links[0], loop: links[1] };
  return { intro: null, loop: links[0] || null };
}

function createVideo(src, className, loop) {
  const video = document.createElement('video');
  video.className = className;
  if (loop && (src.startsWith(PUBLISH_ORIGIN) || src.startsWith('https://delivery-'))) {
    video.crossOrigin = 'anonymous';
  }
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.loop = loop;
  video.preload = loop ? 'metadata' : 'auto';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.tabIndex = -1;
  video.src = src;
  return video;
}

/**
 * requestAnimationFrame tween of 0..1, eased.
 * @returns {Function} cancel
 */
function tween(ms, ease, update, done) {
  let frame = 0;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / ms);
    update(EASE[ease](p));
    if (p < 1) frame = requestAnimationFrame(tick);
    else done?.();
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

function animateShutter(shutter) {
  if (shutter.isConnected === false) return Promise.resolve();
  const { height } = shutter.getBoundingClientRect();
  if (!height) {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve(animateShutter(shutter)));
    });
  }
  shutter.style.setProperty('--infinity-stage-h', `${height}px`);
  const distanceToEdge = height / 2 - 1.5;
  const animations = [...shutter.children].map((half, index) => half.animate(
    Array.from({ length: 61 }, (_, frameIndex) => {
      const progress = frameIndex / 60;
      const distance = EASE[SHUTTER_EASE](progress) * distanceToEdge * (index === 0 ? -1 : 1);
      return { transform: `translate3d(0, ${distance}px, 0)`, offset: progress };
    }),
    { duration: SHUTTER_MS, easing: 'linear', fill: 'forwards' },
  ));
  return Promise.all(animations.map((animation) => animation.finished))
    .then(() => shutter.remove());
}

function isEditable(el) {
  return el?.closest?.('input, textarea, select, [contenteditable="true"]');
}

/**
 * Resolves once every block of the section is decorated.
 * @param {Element} section
 * @returns {Promise<void>}
 */
function sectionLoaded(section) {
  if (!section || section.dataset.sectionStatus === 'loaded') return Promise.resolve();
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (section.dataset.sectionStatus !== 'loaded') return;
      observer.disconnect();
      resolve();
    });
    observer.observe(section, { attributes: true, attributeFilter: ['data-section-status'] });
  });
}

/**
 * Viewport rectangle of a video drawn with object-fit: cover in a box.
 * @param {DOMRect} box
 * @param {number} aspect width / height of the video
 */
function coverRect(box, aspect) {
  const width = Math.max(box.width, box.height * aspect);
  const height = width / aspect;
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
  };
}

// how the mask sits on the ribbon, relative to the ribbon's red extent on the
// loop's first frame (offsets in units of that width), found on the desktop
// loop where the mask covers nothing but ribbon in every frame
const CALIBRATION = { x: 0.0168, y: 0.2974, w: 0.971 };

/**
 * Measures where the ribbon sits in a video from its current frame: the
 * extent of its red pixels (width and top edge; the floor reflection below
 * varies), mapped with CALIBRATION. Needs a same-origin video (the canvas
 * cannot be read otherwise) and returns null when it cannot tell.
 * @param {HTMLVideoElement} video
 * @returns {{ x: number, y: number, w: number }|null} fractions of the frame
 */
function measureRibbon(video) {
  if (!video.videoWidth || !video.videoHeight) return null;
  const width = 320;
  const height = Math.round((width * video.videoHeight) / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let data;
  try {
    context.drawImage(video, 0, 0, width, height);
    ({ data } = context.getImageData(0, 0, width, height));
  } catch (e) {
    return null;
  }
  const xs = [];
  const ys = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r > 80 && r > g * 1.8 && r > b * 1.5) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length < width * height * 0.01) return null;
  const at = (values, share) => values
    .sort((m, n) => m - n)[Math.floor(share * (values.length - 1))];
  const left = at(xs, 0.01);
  const right = at(xs, 0.99);
  const top = at(ys, 0.01);
  const extent = right - left;
  if (extent < width * 0.2) return null;
  return {
    x: ((left + right) / 2 + CALIBRATION.x * extent) / width,
    y: (top + CALIBRATION.y * extent) / height,
    w: (CALIBRATION.w * extent) / width,
  };
}

function readRibbon(el, fallback) {
  const style = getComputedStyle(el);
  const read = (name, value) => {
    const number = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(number) ? number : value;
  };
  return {
    x: read('--infinity-ribbon-x', fallback.x),
    y: read('--infinity-ribbon-y', fallback.y),
    w: read('--infinity-ribbon-w', fallback.w),
  };
}

/**
 * Rectangle of the video in a box: cover, or (fit = bottom) a fixed multiple
 * of the box width resting on its bottom edge.
 */
function frameRect(box, aspect, fit) {
  if (fit !== 'bottom') {
    const frame = coverRect(box, aspect);
    if (fit === 'cover-bottom') frame.top = box.top + box.height - frame.height;
    return frame;
  }
  const width = box.width * BOTTOM_ZOOM;
  const height = width / aspect;
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + box.height - height,
    width,
    height,
  };
}

/**
 * Where the infinity ribbon sits in a box that shows the video (px from the
 * box's top left corner).
 */
function ribbonIn(box, aspect, ribbon, fit) {
  const video = frameRect({
    left: 0, top: 0, width: box.width, height: box.height,
  }, aspect, fit);
  return {
    x: video.left + ribbon.x * video.width,
    y: video.top + ribbon.y * video.height,
    w: ribbon.w * video.width,
  };
}

/**
 * Geometry of the transition, measured from the layout. The video first
 * plays in the intro's stage (stage box), where the mask shrinks from
 * covering the stage (startW) onto the ribbon (rs, fitW). From the hand-off
 * on it plays in the banner's box (host box: the banner itself when it is in
 * a section of its own, else the same stage), where the video is scaled by k
 * and its ribbon carried from c0 (the fitted ribbon) to c1 (the banner's
 * target). The mask follows the video transform, so ribbon and mask stay
 * aligned at every size. Points are local to their box.
 */
function stageGeometry({
  stage, host, aspect, ribbon, fit, target, mode,
}) {
  const rs = ribbonIn(stage, aspect, ribbon, fit);
  const rp = ribbonIn(host, aspect, ribbon, fit);
  // the video box scales about its own centre (its transform origin)
  const box = frameRect({
    left: 0, top: 0, width: host.width, height: host.height,
  }, aspect, fit);
  const corners = [[0, 0], [stage.width, 0], [0, stage.height], [stage.width, stage.height]];
  const far = Math.max(...corners.map(([x, y]) => Math.hypot(x - rs.x, y - rs.y)));
  const k0 = rs.w / rp.w;
  const c0 = { x: stage.left + rs.x - host.left, y: stage.top + rs.y - host.top };
  // fade: shrink about the ribbon; swoop: carry the ribbon onto the target
  let k1 = k0;
  let c1 = c0;
  if (mode === 'fade') {
    k1 = k0 * (0.5 / 0.8);
  } else if (target) {
    k1 = target.w / rp.w;
    c1 = { x: target.x - host.left, y: target.y - host.top };
  }
  return {
    rs,
    rp,
    sc: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
    startW: Math.max(rs.w * START_FACTOR, (far / MASK_CORE) * 1.05),
    fitW: mode === 'fade' ? rs.w * (0.8 / 0.82) : rs.w,
    k0,
    k1,
    c0,
    c1,
  };
}

/**
 * The two prototype timelines (seconds): "swoop" shrinks the video into the
 * infinity, fits it to the ribbon and carries it behind the person, with the
 * front strands fading in (prototype v6); "fade" shrinks it, holds it on
 * white and fades it away before the next screen comes up. At 3.5 s the
 * banner takes over (swap): from there on the video plays in its box.
 */
function stageTweens(mode, g, { hero, stage }) {
  const swap = {
    target: stage, at: 3.5, dur: 0, ease: 'none', props: { swap: [0, 1] },
  };
  if (mode === 'fade') {
    return [
      swap,
      {
        target: hero, at: 0, dur: 1, ease: 'none', props: { opacity: [1, 0], y: [0, -25] },
      },
      {
        target: stage, at: 0, dur: 3.5, ease: 'sine.out', props: { w1: [g.startW, g.fitW] },
      },
      {
        target: stage, at: 4, dur: 2.5, ease: 'sine.inOut', props: { p2: [0, 1], op: [1, 0] },
      },
    ];
  }
  return [
    swap,
    {
      target: hero, at: 0, dur: 0.18, ease: 'none', props: { opacity: [1, 0], y: [0, -25] },
    },
    {
      target: stage, at: 0, dur: 3.5, ease: 'sine.out', props: { w1: [g.startW, g.fitW] },
    },
    {
      target: stage, at: 3.5, dur: 2, ease: 'sine.out', props: { p2: [0, 1], front: [0, 1] },
    },
  ];
}

/**
 * loads and decorates the infinity-intro block
 * rows: [desktop videos] [mobile videos] [hero text & slogan] [scroll label]
 * Works together with a banner block placed after it in the same section or
 * in the next section (infinity-banner, agentic-search): the first scroll /
 * swipe / arrow key plays the infinity transition into that banner,
 * scrolling back up at the top reverses it. A banner in a section of its own
 * takes the intro's place at the hand-off and the video moves into it, so
 * the banner section keeps working on its own (e.g. inside a slider).
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const [desktopRow, mobileRow, contentRow, labelRow] = [...block.children];
  const desktop = readVideos(desktopRow?.firstElementChild);
  const mobile = readVideos(mobileRow?.firstElementChild);
  const sources = () => {
    const isDesktop = DESKTOP_QUERY.matches;
    return {
      intro: (isDesktop ? desktop.intro : mobile.intro || desktop.intro) || null,
      loop: (isDesktop ? desktop.loop : mobile.loop || desktop.loop) || null,
    };
  };
  const section = block.closest('.section');
  const editing = window.self !== window.top;
  // the intro plays for everyone, also with Reduce Motion (iPad) or Remove
  // animations (Samsung) turned on
  const reduced = false;

  // --- video frame (masked by the infinity) ---
  const media = document.createElement('div');
  media.className = 'infinity-intro-media';
  media.setAttribute('aria-hidden', 'true');
  const videoBox = document.createElement('div');
  videoBox.className = 'infinity-intro-videos';
  const shade = document.createElement('div');
  shade.className = 'infinity-intro-shade';
  const { intro: introSrc, loop: loopSrc } = sources();
  if (!editing) [introSrc, loopSrc].filter(Boolean).slice(0, 1).forEach(preconnect);
  const loop = loopSrc ? createVideo(loopSrc, 'infinity-intro-loop', true) : null;
  const intro = introSrc && !reduced && !editing ? createVideo(introSrc, 'infinity-intro-intro', false) : null;
  videoBox.append(...[loop, intro].filter(Boolean), shade);
  media.append(videoBox);

  // --- hero copy ---
  const hero = document.createElement('div');
  hero.className = 'infinity-intro-hero';
  // the blur panel is its own layer: a backdrop-filter inside the fading hero would not blur
  const backdrop = document.createElement('div');
  backdrop.className = 'infinity-intro-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  const copy = document.createElement('div');
  copy.className = 'infinity-intro-copy';
  const contentCell = contentRow?.firstElementChild;
  if (contentCell) {
    moveInstrumentation(contentCell, copy);
    [...contentCell.children].forEach((el) => {
      const picture = el.querySelector('picture');
      if (picture) {
        const slogan = document.createElement('div');
        slogan.className = 'infinity-intro-slogan';
        slogan.append(picture);
        copy.append(slogan);
      } else if (el.textContent.trim()) {
        if (el.matches('h1, h2, h3, h4, h5, h6')) el.classList.add('infinity-intro-title');
        copy.append(el);
      }
    });
  }
  const scroll = document.createElement('button');
  scroll.type = 'button';
  scroll.className = 'infinity-intro-scroll';
  const labelCell = labelRow?.firstElementChild;
  if (labelCell) moveInstrumentation(labelCell, scroll);
  scroll.innerHTML = `<span class="infinity-intro-scroll-label"></span>${MOUSE_ICON}`;
  scroll.firstElementChild.textContent = labelCell?.textContent.trim() || 'Scroll down';
  hero.append(copy, scroll);

  // --- shutter: splits open from a thin centre line ---
  const shutter = document.createElement('div');
  shutter.className = 'infinity-intro-shutter';
  shutter.setAttribute('aria-hidden', 'true');
  shutter.innerHTML = '<div class="infinity-intro-shutter-half"></div><div class="infinity-intro-shutter-half"></div>';

  block.replaceChildren(media, backdrop, hero, ...(intro ? [shutter] : []));

  if (editing) {
    section?.classList.add('infinity-intro-editing');
    return;
  }

  // the video fills the stage (object-fit: cover); the scripts only measure it
  const usingMobileVideo = !DESKTOP_QUERY.matches && Boolean(mobile.loop);
  media.dataset.video = usingMobileVideo ? 'mobile' : 'desktop';
  const videoAspect = () => {
    if (loop?.videoWidth && loop.videoHeight) return loop.videoWidth / loop.videoHeight;
    return usingMobileVideo ? 9 / 16 : 16 / 9;
  };
  // --- step controller ---
  let partner = null;
  // where the ribbon sits in the mobile loop, measured on its first frame
  let measuredRibbon = null;
  // a banner in the next section hosts the video after the hand-off
  let host = null;
  let hostSection = null;
  let swapped = false;
  let ready = false;
  let queued = false;
  let step = 0;
  let progress = 0;
  let busy = false;
  let timeline = null;
  let settleUntil = 0;
  let heroFade = null;
  let heroShown = false;
  let handedOff = !intro;
  /*
  let savedNavClass = null;

  const setWhiteNav = (on) => {
    const nav = document.querySelector('header nav#nav');
    if (!nav) return;
    nav.toggleAttribute('data-infinity-white-nav', on);
    if (on) {
      const current = [...nav.classList].find((cls) => cls.endsWith('-nav') && cls !== 'white-nav');
      if (current) {
        savedNavClass = current;
        nav.classList.remove(current);
      }
      nav.classList.add('white-nav');
    } else {
      nav.classList.remove('white-nav');
      if (savedNavClass) nav.classList.add(savedNavClass);
      savedNavClass = null;
    }
    nav.dispatchEvent(new Event('nav-theme-change'));
  };
  */

  // front strands of the ribbon (in front of the person): the same masked
  // video, mirrored into canvases so they stay frame-exact with the loop
  const fronts = [];
  const mirrorBoxes = [];
  const canvases = [];

  const layout = () => {
    if (!section || section.classList.contains('infinity-intro-gone')) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    section.style.setProperty('--infinity-top', `${Math.max(0, Math.round(top))}px`);
    section.style.setProperty('--infinity-unit', section.clientWidth / DESIGN_WIDTH);
    // the video box covers its frame at the video's own aspect ratio, so the
    // whole picture is still there when the box shrinks into the infinity
    // a landscape video on a portrait screen rests on the bottom (fit = bottom)
    const box = section.getBoundingClientRect();
    let fit = box.width < box.height && videoAspect() > 1 ? 'bottom' : 'cover';
    if (window.innerWidth >= 500 && window.innerWidth <= 900 && fit === 'cover') {
      fit = 'cover-bottom';
    }
    [media, ...fronts].forEach((el) => {
      el.style.setProperty('--infinity-video-aspect', videoAspect().toFixed(4));
      el.dataset.fit = fit;
    });
  };
  layout();

  const addFronts = (container) => {
    ['infinity-front-ribbon', 'infinity-front-corner'].forEach((name, i) => {
      const layer = document.createElement('div');
      layer.className = `infinity-intro-front infinity-intro-front-${i + 1}`;
      layer.setAttribute('aria-hidden', 'true');
      layer.style.setProperty('--infinity-front-mask', `url('${window.hlx.codeBasePath}/blocks/infinity-intro/${name}.png')`);
      layer.style.setProperty('--infinity-video-aspect', videoAspect().toFixed(4));
      layer.dataset.fit = media.dataset.fit;
      const box = document.createElement('div');
      box.className = 'infinity-intro-videos';
      const canvas = document.createElement('canvas');
      canvas.className = 'infinity-intro-mirror';
      box.append(canvas, shade.cloneNode());
      layer.append(box);
      container.append(layer);
      fronts.push(layer);
      mirrorBoxes.push(box);
      canvases.push(canvas);
    });
  };

  // which of the two sections shows: the intro until the hand-off, then the
  // banner, which takes the video with it (moving a playing video within the
  // page in one go does not interrupt it)
  const place = (inHost) => {
    if (!host) return;
    section.classList.toggle('infinity-intro-gone', inHost);
    hostSection.classList.toggle('infinity-intro-waiting', !inHost);
    (inHost ? host : block).prepend(media);
  };
  const setSwapped = (on) => {
    if (!host || on === swapped) return;
    swapped = on;
    place(on);
  };
  let mirroring = false;
  const mirror = () => {
    if (!mirroring || !loop) return;
    if (loop.readyState >= 2) {
      canvases.forEach((canvas) => {
        const width = loop.videoWidth;
        const height = loop.videoHeight;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        canvas.getContext('2d').drawImage(loop, 0, 0, width, height);
      });
    }
    if (loop.requestVideoFrameCallback) loop.requestVideoFrameCallback(mirror);
    else requestAnimationFrame(mirror);
  };
  const startMirror = () => {
    if (mirroring || !canvases.length) return;
    mirroring = true;
    mirror();
  };

  const frame = (els, boxes, {
    c, k, sc, r, width,
  }) => {
    const transform = `translate(${c.x - sc.x - (r.x - sc.x) * k}px, ${c.y - sc.y - (r.y - sc.y) * k}px) scale(${k})`;
    boxes.forEach((box) => { box.style.transform = transform; });
    els.forEach((el) => {
      // All three masks share one coordinate space, despite different source dimensions.
      const size = `${width}px ${width * MASK_RATIO}px`;
      const position = `${c.x - width / 2}px ${c.y - (width * MASK_RATIO) / 2}px`;
      el.style.setProperty('-webkit-mask-size', size);
      el.style.setProperty('-webkit-mask-position', position);
      el.style.maskSize = size;
      el.style.maskPosition = position;
    });
  };

  // one target drives the video, the mask and the front strands together:
  // w1 = mask width before the move, p2 = progress of the move, op / front =
  // opacity, swap = the banner has taken over
  const stageTarget = {
    apply({
      w1, p2 = 0, op = 1, front = 0, swap = 0,
    }) {
      const g = timeline?.geometry;
      if (!g) return;
      setSwapped(swap >= 1);
      const k = g.k0 + (g.k1 - g.k0) * p2;
      const inHost = {
        c: { x: g.c0.x + (g.c1.x - g.c0.x) * p2, y: g.c0.y + (g.c1.y - g.c0.y) * p2 },
        k,
        sc: g.sc,
        r: g.rp,
        width: (w1 ?? g.startW) * k * (g.rp.w / g.rs.w),
      };
      // before the hand-off a hosted video still plays in the intro's stage
      const inStage = {
        c: g.rs, k: 1, sc: g.rs, r: g.rs, width: w1 ?? g.startW,
      };
      frame([media], [videoBox], host && !swapped ? inStage : inHost);
      frame(fronts, mirrorBoxes, inHost);
      media.style.opacity = op;
      fronts.forEach((el) => { el.style.opacity = front; });
    },
  };
  const heroLayers = [elementTarget(hero), elementTarget(backdrop)];
  const heroTarget = { apply: (values) => heroLayers.forEach((layer) => layer.apply(values)) };
  const setHeroHidden = (hidden) => {
    hero.hidden = hidden;
    backdrop.hidden = hidden;
  };

  // measures the stage, and the banner as it stands after the hand-off; a
  // hosting banner and the intro swap places for it (undone before paint)
  const measure = (target) => {
    if (!host) {
      layout();
      const stage = media.getBoundingClientRect();
      return { stage, host: stage, target: target?.() };
    }
    place(false);
    layout();
    const stage = media.getBoundingClientRect();
    place(true);
    const measured = { stage, host: host.getBoundingClientRect(), target: target?.() };
    place(swapped);
    return measured;
  };

  const buildTimeline = () => {
    if (!partner) return null;
    const { mode, tweens, target } = partner.infinityStage;
    const geometry = stageGeometry({
      ...measure(target),
      aspect: videoAspect(),
      ribbon: measuredRibbon || readRibbon(media, RIBBON[media.dataset.video]),
      fit: media.dataset.fit,
      mode,
    });
    const built = createTimeline([
      ...stageTweens(mode, geometry, { hero: heroTarget, stage: stageTarget }),
      ...tweens().map(({ el, ...rest }) => ({ target: elementTarget(el), ...rest })),
    ]);
    built.geometry = geometry;
    return built;
  };

  const refresh = () => {
    layout();
    if (!partner || !timeline) return;
    timeline = buildTimeline();
    if (progress) timeline?.render(progress);
    else stageTarget.apply({ w1: timeline.geometry.startW });
  };
  loop?.addEventListener('loadedmetadata', refresh, { once: true });

  // the mobile video frames the ribbon its own way: measure it on the loop
  // (its width and top edge are the same in every frame); a frame may not be
  // drawable yet when the data arrives, so it retries on the next painted ones.
  // Falls back to RIBBON.mobile when the video cannot be read.
  if (loop && usingMobileVideo) {
    let tries = 0;
    const calibrate = () => {
      measuredRibbon = measureRibbon(loop);
      if (!measuredRibbon) {
        tries += 1;
        if (tries < 12 && loop.requestVideoFrameCallback) loop.requestVideoFrameCallback(calibrate);
        else if (tries < 12) setTimeout(calibrate, 250);
        return;
      }
      // re-fit at once (also mid-transition: the running tween picks it up)
      refresh();
    };
    if (loop.readyState >= 2) calibrate();
    else loop.addEventListener('loadeddata', calibrate, { once: true });
  }

  const showHero = () => {
    setHeroHidden(false);
    heroShown = true;
    heroFade?.();
    if (reduced) {
      heroTarget.apply({ opacity: 1 });
      return;
    }
    heroFade = tween(HERO_FADE_MS, 'power2.out', (p) => heroTarget.apply({ opacity: p, y: 15 * (1 - p) }));
  };

  const handoff = () => {
    if (handedOff) return;
    handedOff = true;
    if (!loop) {
      intro?.classList.add('is-done');
    } else {
      // the intro holds its last frame until the loop underneath has painted
      loop.play().catch(() => {});
      painted(loop).then((readyFrame) => {
        if (!readyFrame) return;
        intro?.classList.add('is-done');
        setTimeout(() => intro?.pause(), INTRO_FADE_MS);
      });
    }
    if (step === 0 && progress <= 0.02) showHero();
  };

  const isNavigationOpen = () => {
    if (document.querySelector('.modal.desk-hamburger dialog[open]')) return true;
    const nav = document.getElementById('nav');
    if (!nav) return false;
    return DESKTOP_QUERY.matches
      ? !!nav.querySelector('.nav-drop.active')
      : nav.getAttribute('aria-expanded') === 'true';
  };

  const setStep = (target, { focus = false } = {}) => {
    if (isNavigationOpen() || busy || target === step || !partner) return;
    step = target;
    timeline = buildTimeline();
    if (!timeline) return;
    busy = true;
    heroFade?.();
    if (target === 1) {
      startMirror();
      // scrolled before the intro ended: jump to the loop, the hero never shows
      const wasShown = heroShown;
      handoff();
      if (!wasShown) setHeroHidden(true);
      hero.inert = true;
    } else {
      partner.inert = true;
      if (handedOff) {
        setHeroHidden(false);
        heroShown = true;
      }
    }
    let navThemeTimeout = 0;
    let navThemeUpdated = false;
    const updateNavTheme = () => {
      if (navThemeUpdated) return;
      const nav = document.querySelector('header nav#nav');
      if (!nav) return;
      const themeSource = target === 1 ? partner : block;
      const theme = themeSource.dataset.navTheme || themeSource.closest('.section')?.dataset.navTheme;
      nav.dispatchEvent(new CustomEvent('banner-nav-theme-change', { detail: { theme } }));
      navThemeUpdated = true;
    };
    const finish = () => {
      busy = false;
      settleUntil = performance.now() + WHEEL_SETTLE_MS;
      if (step === 1) {
        setHeroHidden(true);
        partner.inert = false;
        if (focus) {
          const heading = partner.querySelector('h1, h2, h3') || partner;
          if (heading.tabIndex < 0) heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      } else {
        hero.inert = false;
        mirroring = false;
      }
      // const themeSource = step === 1 ? partner : block;
      // const theme = themeSource.dataset.navTheme ||
      // themeSource.closest('.section')?.dataset.navTheme;
      // document.querySelector('header nav#nav')?.dispatchEvent(
      //   new CustomEvent('banner-nav-theme-change', { detail: { theme } }),
      // );
      clearTimeout(navThemeTimeout);
      updateNavTheme();
    };
    if (reduced) {
      progress = target;
      timeline.render(progress);
      // setWhiteNav(target === 1);
      finish();
      return;
    }
    const from = progress;
    const duration = target ? STEP_MS.forward : STEP_MS.backward;
    // setTimeout(() => setWhiteNav(target === 1), Math.max(0, duration - NAV_SWITCH_LEAD_MS));
    navThemeTimeout = setTimeout(updateNavTheme, NAV_THEME_SWITCH_MS);
    tween(duration, 'power1.inOut', (p) => {
      progress = from + (target - from) * p;
      timeline.render(progress);
    }, finish);
  };

  // the stage only takes over the scroll while it sits at the top of the page
  const inPlace = () => Math.abs(window.scrollY) < 2;
  const wantsStep = (down) => (down ? step === 0 && inPlace() : step === 1 && inPlace());
  // until the banner has loaded, a step down waits for it instead of scrolling the page
  const holds = (down) => {
    if (ready || !down || step !== 0 || !inPlace()) return false;
    queued = true;
    return true;
  };

  window.addEventListener('wheel', (e) => {
    if (isNavigationOpen()) return;
    if (holds(e.deltaY > 0)) {
      e.preventDefault();
      return;
    }
    if (!partner) return;
    const now = performance.now();
    if (busy || now < settleUntil) {
      e.preventDefault();
      if (!busy) settleUntil = now + WHEEL_SETTLE_MS;
      return;
    }
    if (!e.deltaY || !wantsStep(e.deltaY > 0)) return;
    e.preventDefault();
    setStep(e.deltaY > 0 ? 1 : 0);
  }, { passive: false });

  let touchY = null;
  let swiped = false;
  window.addEventListener('touchstart', (e) => {
    touchY = isNavigationOpen() ? null : e.touches[0].clientY;
    swiped = false;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (isNavigationOpen()) {
      touchY = null;
      return;
    }
    if (touchY === null) return;
    const delta = touchY - e.touches[0].clientY;
    if (holds(delta > 0)) {
      e.preventDefault();
      return;
    }
    if (!partner) return;
    if (busy) {
      e.preventDefault();
      return;
    }
    if (!delta || !wantsStep(delta > 0)) return;
    e.preventDefault();
    if (!swiped && Math.abs(delta) > SWIPE_PX) {
      swiped = true;
      setStep(delta > 0 ? 1 : 0);
    }
  }, { passive: false });
  window.addEventListener('touchend', () => { touchY = null; }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (isNavigationOpen() || e.altKey || e.ctrlKey || e.metaKey || isEditable(e.target)) return;
    const down = ['ArrowDown', 'PageDown', ' '].includes(e.key);
    const up = ['ArrowUp', 'PageUp'].includes(e.key);
    if (holds(down)) {
      e.preventDefault();
      return;
    }
    if (!partner || (!down && !up) || (!busy && !wantsStep(down))) return;
    e.preventDefault();
    setStep(down ? 1 : 0, { focus: true });
  });

  scroll.addEventListener('click', () => {
    if (isNavigationOpen()) return;
    if (!holds(true)) setStep(1, { focus: true });
  });

  // re-render the current state when the stage size changes; the header is
  // watched too, as the stage height depends on where the section starts
  const resized = new ResizeObserver(refresh);
  resized.observe(section || block);
  const header = document.querySelector('body > header');
  if (header) resized.observe(header);

  // save the GPU while the stage is scrolled out of view
  let mediaVisible = true;
  if (loop) {
    new IntersectionObserver(([entry]) => {
      mediaVisible = entry.isIntersecting;
      if (!handedOff || reduced) return;
      if (entry.isIntersecting) loop.play().catch(() => {});
      else loop.pause();
    }).observe(media);
  }

  // where the browser holds autoplay back (iPadOS Low Power Mode or Auto-Play
  // off, Samsung Internet / Android power or data saving) or pauses the video
  // itself (app switch, page restored from the cache), the video that should
  // be running plays on the first tap or key, and whenever the page shows again
  const resume = () => {
    const video = handedOff ? loop : intro;
    if (!video || !video.paused || video.ended || (handedOff && !mediaVisible)) return;
    video.play().catch(() => {});
  };
  ['touchend', 'pointerup', 'click', 'keydown'].forEach((type) => {
    window.addEventListener(type, resume, { capture: true, passive: true });
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
  window.addEventListener('pageshow', resume);

  // the banner: a block with `infinityStage` in this section, else in the next one
  const findPartner = (el) => [...(el?.querySelectorAll('.block') || [])]
    .find((el2) => el2 !== block && el2.infinityStage) || null;
  const next = section?.nextElementSibling?.classList.contains('section') ? section.nextElementSibling : null;
  // no banner: a Looking For section itself comes up (the video fades out in it)
  const stageSection = async (el) => {
    if (!SECTION_PARTNERS.some((name) => el.classList.contains(name))) return null;
    const { default: prepare } = await import('./infinity-intro-section.js');
    return prepare(el);
  };
  sectionLoaded(section).then(async () => {
    partner = findPartner(section);
    if (!partner && next) {
      await sectionLoaded(next);
      partner = findPartner(next) || await stageSection(next);
      if (partner) {
        host = partner.infinityStage.host || partner;
        hostSection = next;
      }
    }
    if (!partner) {
      ready = true;
      return;
    }
    const masks = [
      'infinity-mask',
      ...(partner.infinityStage.front ? ['infinity-front-ribbon', 'infinity-front-corner'] : []),
    ];
    try {
      await Promise.all(masks.map((name) => {
        const image = new Image();
        image.src = `${window.hlx.codeBasePath}/blocks/infinity-intro/${name}.png`;
        return image.decode();
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Unable to load infinity transition masks.', error);
      partner = null;
      ready = true;
      return;
    }
    section.classList.add('infinity-intro-staged');
    partner.inert = true;
    if (host) {
      host.classList.add('infinity-intro-host');
      hostSection.classList.add('infinity-intro-staged', 'infinity-intro-host-section', 'infinity-intro-waiting');
      resized.observe(host);
      // its images load while the intro plays, not when it comes up
      host.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; });
    }
    if (partner.infinityStage.front && loop) addFronts(host || block);
    timeline = buildTimeline();
    const heroStyles = [hero, backdrop].map((el) => el.style.cssText);
    timeline?.render(0);
    // Late partner loading must not interrupt the independent hero fade.
    [hero, backdrop].forEach((el, i) => { el.style.cssText = heroStyles[i]; });
    media.classList.add('is-masked');
    ready = true;
    if (queued) setStep(1, { focus: true });
  });

  // --- intro sequence ---
  if (!intro) {
    if (loop && !reduced) loop.play().catch(() => {});
    if (loop && reduced) loop.preload = 'auto';
    showHero();
    return;
  }

  heroTarget.apply({ opacity: 0 });
  let opened = false;
  const openShutter = () => {
    if (opened) return;
    opened = true;
    animateShutter(shutter).catch(() => {});
  };
  openShutter();
  painted(intro).then((readyFrame) => {
    if (readyFrame) intro.classList.add('is-ready');
  });
  intro.addEventListener('playing', () => { if (loop) loop.preload = 'auto'; }, { once: true });
  intro.addEventListener('timeupdate', () => {
    // start the loop just before the intro ends so the swap is seamless
    if (!intro.duration || intro.currentTime < intro.duration - PREWARM_S) return;
    loop?.play().catch(() => {});
  });
  intro.addEventListener('ended', handoff, { once: true });
  intro.addEventListener('error', handoff, { once: true });
  intro.play().catch((error) => {
    // autoplay held back: the page opens as usual, the loop starts on the first
    // tap (a paused video may never show a frame, so the shutter does not wait)
    if (error?.name === 'NotAllowedError') openShutter();
    handoff();
  });
}
