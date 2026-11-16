/* global gsap, MotionPathPlugin, ScrollTrigger */
import { getMetadata, loadScript } from '../../scripts/aem.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TRIGGER_ID = 'pulse-animation';
const MIN_SIDE_INSET = 24;
const MAX_LAYOUT_WIDTH = 1200;

// default arrow (no image authored): a tapered shape that bends along the line
// const TRAIL_LENGTH = 155; // px along the line, tail to tip
// const TRAIL_HALF_WIDTH = 22; // px at the tail
const TRAIL_LENGTH = 147;
const TRAIL_HALF_WIDTH = 15;
const TRAIL_SAMPLES = 28;

// sections use data-animation-point-mobile below the desktop breakpoint
const desktopQuery = window.matchMedia('(min-width: 900px)');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

// the line and arrow are shared by the page, so they live at module level
let gsapReady;
let overlayPath;
let arrow; // authored image arrow, moved by MotionPathPlugin
let trail; // default bending arrow, drawn into the overlay
let redrawTimeout;
let layoutWatched = false;

// GSAP UMD bundles must load in order: core first, then its plugins.
async function loadGsap() {
  if (!gsapReady) {
    gsapReady = (async () => {
      await loadScript(`${window.hlx.codeBasePath}/scripts/thirdparty/gsap.min.js`);
      await Promise.all([
        loadScript(`${window.hlx.codeBasePath}/scripts/thirdparty/motionpathplugin.min.js`),
        loadScript(`${window.hlx.codeBasePath}/scripts/thirdparty/scrolltrigger.min.js`),
      ]);
      gsap.registerPlugin(MotionPathPlugin, ScrollTrigger);
    })();
  }
  return gsapReady;
}

/**
 * Creates the SVG overlay that holds the line. It spans the whole of main,
 * so it is appended to main rather than to the block.
 * @param {Element} main The main element
 */
const svgEl = (name, attributes = {}) => {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
};

function createGradient(id, stops) {
  const gradient = svgEl('linearGradient', { id, gradientUnits: 'userSpaceOnUse' });
  stops.forEach(([offset, color, opacity]) => {
    gradient.append(svgEl('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }));
  });
  return gradient;
}

function createBlur(id, deviation, margin) {
  const filter = svgEl('filter', {
    id,
    x: `-${margin}%`,
    y: `-${margin}%`,
    width: `${100 + 2 * margin}%`,
    height: `${100 + 2 * margin}%`,
    'color-interpolation-filters': 'sRGB',
  });
  // filter.append(svgEl('feGaussianBlur', { stdDeviation: deviation }));
  filter.append(svgEl('feGaussianBlur', { stdDeviation: deviation }));
  return filter;
}

/**
 * Creates the default arrow: a blurred blue glow under a soft core that runs
 * from a blue tail to a red tip. Its shape is redrawn on every scroll update.
 */
function createTrail() {
  // const glowGrad = createGradient('pulse-animation-trail-glow', [
  //   [0, '#70afff', 0], [0.25, '#70afff', 0.95], [0.65, '#9cc7ff', 1],
  //   [0.8, '#ed3237', 0.8], [1, '#ed3237', 0.4],
  // ]);
  // const coreGrad = createGradient('pulse-animation-trail-core', [
  //   [0.08, '#fff', 0], [0.32, '#9cc7ff', 0.9], [0.65, '#9cc7ff', 1],
  //   [0.78, '#ed3237', 1], [1, '#ed3237', 1],
  // ]);
  // const coreGrad = createGradient('pulse-animation-trail-core', [
  //   [0.116685, '#fff', 1], [0.382537, '#B2DDFF', 1], [0.648389, '#B2DDFF', 1],
  //   [0.779171, '#FA1432', 1], [1, '#FA1432', 1],
  // ]);
  const glowGrad = createGradient('pulse-animation-trail-glow', [
    [0.116685, '#fff', 1], [0.382537, '#B2DDFF', 1], [0.648389, '#B2DDFF', 1],
    [0.779171, '#FA1432', 1], [1, '#FA1432', 1],
  ]);
  // const blueGlowGrad = createGradient('pulse-animation-trail-blue-glow', [
  //   [0, '#B2DDFF', 0], [0.3, '#B2DDFF', 0],
  //   [0.44, '#B2DDFF', 0.9], [0.6, '#B2DDFF', 0.85],
  //   [0.76, '#B2DDFF', 0], [1, '#B2DDFF', 0],
  // ]);
  // const blueGlowGrad = createGradient('pulse-animation-trail-blue-glow', [
  //   [0, '#B2DDFF', 0], [0.16, '#B2DDFF', 0.1],
  //   [0.34, '#B2DDFF', 0.85], [0.48, '#B2DDFF', 0.8],
  //   [0.6, '#B2DDFF', 0.35], [0.72, '#B2DDFF', 0], [1, '#B2DDFF', 0],
  // ]);
  const blueGlowGrad = createGradient('pulse-animation-trail-blue-glow', [
    [0, '#B2DDFF', 0], [0.12, '#B2DDFF', 0.25],
    [0.28, '#B2DDFF', 0.85], [0.44, '#B2DDFF', 0.75],
    [0.6, '#B2DDFF', 0.25], [0.72, '#B2DDFF', 0], [1, '#B2DDFF', 0],
  ]);
  const coreGrad = createGradient('pulse-animation-trail-core', [
    [0.116685, '#fff', 0], [0.382537, '#B2DDFF', 0], [0.648389, '#B2DDFF', 0],
    // [0.779171, '#FA1432', 1], [1, '#FA1432', 1],
    // [0.779171, '#D80F2A', 1], [0.84, '#FA1432', 1], [1, '#FA1432', 1],
    // [0.779171, '#FA1432', 1], [0.84, '#FA1432', 1],
    // [0.9, '#D80F2A', 1], [1, '#D80F2A', 1],
    // [0.779171, '#FA1432', 1], [0.86, '#FA1432', 1],
    // [0.9, '#D80F2A', 1], [0.94, '#FA1432', 1], [1, '#FA1432', 1],
    [0.779171, '#FA1432', 1], [1, '#FA1432', 1],
  ]);
  const tipGrad = createGradient('pulse-animation-trail-tip', [
    [0, '#FA1432', 0], [0.84, '#FA1432', 0],
    [0.88, '#FA1432', 1], [1, '#FA1432', 1],
  ]);
  // Object.entries({ x1: -72.9945, y1: 58.7124, x2: 151.729, y2: -14.8486 })
  //   .forEach(([name, value]) => coreGrad.setAttribute(name, value));
  // [glowGrad, coreGrad].forEach((gradient) => {
  [glowGrad, blueGlowGrad, coreGrad, tipGrad].forEach((gradient) => {
    Object.entries({
      x1: -72.9945, y1: 58.7124, x2: 151.729, y2: -14.8486,
    })
      .forEach(([name, value]) => gradient.setAttribute(name, value));
  });
  const defs = svgEl('defs');
  defs.append(
    // glowGrad,
    glowGrad,
    blueGlowGrad,
    coreGrad,
    tipGrad,
    // createBlur('pulse-animation-trail-blur', 12, 60),
    createBlur('pulse-animation-trail-blur', 13, 200),
    // createBlur('pulse-animation-trail-blue-blur', 22, 300),
    // createBlur('pulse-animation-trail-blue-blur', 28, 300),
    createBlur('pulse-animation-trail-blue-blur', 32, 300),
    // createBlur('pulse-animation-trail-soft', 2, 50),
    createBlur('pulse-animation-trail-soft', 2, 50),
  );

  const blueGlow = svgEl('path', {
    fill: 'url(#pulse-animation-trail-blue-glow)',
    stroke: 'url(#pulse-animation-trail-blue-glow)',
    // 'stroke-width': 20,
    // 'stroke-width': 32,
    'stroke-width': 48,
    'stroke-linejoin': 'round',
    filter: 'url(#pulse-animation-trail-blue-blur)',
    // opacity: 0.8,
    opacity: 0.9,
  });
  const glow = svgEl('path', {
    // fill: 'url(#pulse-animation-trail-glow)',
    // filter: 'url(#pulse-animation-trail-blur)', opacity: 0.9,
    // fill: 'none',
    fill: 'url(#pulse-animation-trail-glow)',
    filter: 'url(#pulse-animation-trail-blur)',
    // opacity: 0.9,
    opacity: 1,
  });
  const core = svgEl('path', {
    // fill: 'url(#pulse-animation-trail-core)',
    // filter: 'url(#pulse-animation-trail-soft)', opacity: 0.95,
    // fill: 'url(#pulse-animation-trail-core)', opacity: 0.95,
    fill: 'url(#pulse-animation-trail-core)',
    // filter: 'url(#pulse-animation-trail-blur)',
    filter: 'url(#pulse-animation-trail-soft)',
    opacity: 1,
  });
  const tip = svgEl('path', { fill: 'url(#pulse-animation-trail-tip)' });
  const group = svgEl('g', { class: 'pulse-animation-trail' });
  // group.append(glow, core);
  group.append(blueGlow, glow, core, tip);

  return {
    // defs, group, glow, core, gradients: [glowGrad, coreGrad],
    // defs, group, glow, core, gradients: [coreGrad],
    // defs, group, glow, core, gradients: [glowGrad, coreGrad],
    defs, group, blueGlow, glow, core, tip, gradients: [glowGrad, blueGlowGrad, coreGrad, tipGrad],
  };
}

/**
 * Creates the SVG overlay that holds the line and the default arrow. It spans
 * the whole of main, so it is appended to main rather than to the block.
 * @param {Element} main The main element
 */
function createOverlay(main) {
  if (overlayPath?.isConnected) return;

  const svg = svgEl('svg', { class: 'pulse-animation-overlay', 'aria-hidden': 'true' });
  overlayPath = svgEl('path', { class: 'pulse-animation-path' });
  trail = createTrail();
  svg.append(trail.defs, overlayPath, trail.group);
  main.append(svg);
}

/**
 * Draws the default arrow with its tip at the given progress along the line.
 * Each slice is pushed out to both sides of the line, so the arrow bends with
 * the curve; it tapers from the tail to a needle tip and has a notch at the tail.
 * @param {number} progress 0 = arrow at the start of the line, 1 = at the end
 */
function drawTrail(progress) {
  const total = overlayPath.getTotalLength();
  const length = Math.min(TRAIL_LENGTH, total);
  const head = length + progress * (total - length);
  const tail = head - length;

  const top = [];
  const bottom = [];
  for (let i = 0; i <= TRAIL_SAMPLES; i += 1) {
    const u = i / TRAIL_SAMPLES; // 0 = tail, 1 = tip
    const at = tail + u * length;
    const point = overlayPath.getPointAtLength(at);
    const before = overlayPath.getPointAtLength(Math.max(0, at - 1.5));
    const after = overlayPath.getPointAtLength(Math.min(total, at + 1.5));
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    const halfWidth = TRAIL_HALF_WIDTH * (1 - u) ** 1.15;
    const nx = (-dy / magnitude) * halfWidth;
    const ny = (dx / magnitude) * halfWidth;
    top.push({ x: point.x + nx, y: point.y + ny });
    bottom.push({ x: point.x - nx, y: point.y - ny });
  }

  const tip = top[TRAIL_SAMPLES];
  const tailMid = overlayPath.getPointAtLength(tail);
  const notch = {
    x: tailMid.x + (top[0].x - tailMid.x) * 0.12,
    y: tailMid.y + (top[0].y - tailMid.y) * 0.12,
  };
  const outline = [...top.slice().reverse(), notch, ...bottom]
    .map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`);
  const d = `M${outline.join(' L')} Z`;

  trail.blueGlow.setAttribute('d', d);
  trail.glow.setAttribute('d', d);
  trail.core.setAttribute('d', d);
  trail.tip.setAttribute('d', d);
  // the gradients run from the tail to the tip
  trail.gradients.forEach((gradient) => {
    // gradient.setAttribute('x1', tailMid.x);
    // gradient.setAttribute('y1', tailMid.y);
    // gradient.setAttribute('x2', tip.x);
    // gradient.setAttribute('y2', tip.y);
    const dx = tip.x - tailMid.x;
    const dy = tip.y - tailMid.y;
    const referenceX = 172.002 - 26;
    const referenceY = 49.3965 - 40.8128;
    const referenceLengthSquared = referenceX ** 2 + referenceY ** 2;
    const real = (dx * referenceX + dy * referenceY) / referenceLengthSquared;
    const imaginary = (dy * referenceX - dx * referenceY) / referenceLengthSquared;
    const translateX = tailMid.x - real * 26 + imaginary * 40.8128;
    const translateY = tailMid.y - imaginary * 26 - real * 40.8128;
    gradient.setAttribute(
      'gradientTransform',
      `matrix(${real} ${imaginary} ${-imaginary} ${real} ${translateX} ${translateY})`,
    );
  });
}

/**
 * Builds the arrow from the authored image. Images arrive via the Media Bus as a
 * <picture>; SVGs are delivered as content and may render as a link, so both work.
 * The graphic should point right (0°): autoRotate turns it along the path.
 * @param {Element} block The pulse-animation block
 * @returns {Promise<HTMLImageElement|null>} the arrow image, or null if none authored
 */
async function getAuthoredArrow(block) {
  const img = block.querySelector('img');
  const link = block.querySelector('a[href]');
  const src = img?.getAttribute('src') || link?.getAttribute('href');
  if (!src) return null;

  const graphic = document.createElement('img');
  graphic.src = src;
  graphic.alt = img?.alt || '';
  // wait for the intrinsic size so alignOrigin centres the graphic on the path
  await graphic.decode().catch(() => { });
  return graphic;
}

/**
 * Creates the authored arrow that travels along the line, replacing the one of
 * a previous decoration (e.g. a Universal Editor re-render). Without an authored
 * image the default bending arrow in the overlay is used instead.
 * @param {Element} block The pulse-animation block
 * @param {Element} main The main element
 */
async function createArrow(block, main) {
  const graphic = await getAuthoredArrow(block);
  arrow?.remove();
  arrow = null;
  if (!graphic) return;

  graphic.classList.add('pulse-animation-arrow-graphic');
  arrow = document.createElement('div');
  arrow.classList.add('pulse-animation-arrow');
  arrow.append(graphic);
  main.append(arrow);
}

/**
 * Returns the box the authored percentages refer to: a centered desktop layout
 * including section margins vertically, in pixels relative to main.
 * @param {Element} section The section element
 * @param {DOMRect} origin The bounding rect of main
 * @returns {{x: number, y: number, width: number, height: number}}
 */
function getSectionBox(section, origin) {
  const rect = section.getBoundingClientRect();
  const style = window.getComputedStyle(section);
  const marginTop = parseFloat(style.marginTop) || 0;
  const marginBottom = parseFloat(style.marginBottom) || 0;
  const marginLeft = parseFloat(style.marginLeft) || 0;
  const marginRight = parseFloat(style.marginRight) || 0;
  const sectionWidth = rect.width + marginLeft + marginRight;
  const width = desktopQuery.matches ? Math.min(sectionWidth, MAX_LAYOUT_WIDTH) : sectionWidth;

  return {
    // x: rect.left - origin.left - marginLeft,
    x: rect.left - origin.left - marginLeft + (sectionWidth - width) / 2,
    y: rect.top - origin.top - marginTop,
    // width: rect.width + marginLeft + marginRight,
    width,
    height: rect.height + marginTop + marginBottom,
  };
}

const toPixels = (box, p) => ({
  x: box.x + box.width * (p.x / 100),
  y: box.y + box.height * (p.y / 100),
});

const toPercent = (box, p) => ({
  x: ((p.x - box.x) / box.width) * 100,
  y: ((p.y - box.y) / box.height) * 100,
});

// parses authored points: "x,y | x,y" in % of the section box
function parsePoints(value = '') {
  return value.split('|').map((pair) => {
    const [x, y] = pair.split(',').map((v) => parseFloat(v));
    return { x, y };
  }).filter(({ x, y }) => !Number.isNaN(x) && !Number.isNaN(y));
}

/**
 * Vertical lines the pulse can safely run along, in pixels relative to main:
 * the middle of each side gutter, the edges of the content column and the centre.
 * The narrowest content column on the page is used, so full-bleed sections
 * don't pull the line to the screen edge.
 * @param {Element} main The main element
 */
function getGuides(main) {
  const origin = main.getBoundingClientRect();
  let contentLeft = 0;
  main.querySelectorAll(':scope > .section > div').forEach((column) => {
    const rect = column.getBoundingClientRect();
    const padding = parseFloat(window.getComputedStyle(column).paddingLeft) || 0;
    contentLeft = Math.max(contentLeft, rect.left - origin.left + padding);
  });
  const contentRight = origin.width - contentLeft;
  // narrow mobile gutters would let the curve swing off-screen
  // const side = Math.max(contentLeft / 2, MIN_SIDE_INSET);
  const layoutLeft = desktopQuery.matches ? Math.max(0, (origin.width - MAX_LAYOUT_WIDTH) / 2) : 0;
  const side = layoutLeft + Math.max((contentLeft - layoutLeft) / 2, MIN_SIDE_INSET);

  return {
    left: side,
    contentLeft,
    center: origin.width / 2,
    contentRight,
    right: origin.width - side,
  };
}

/**
 * Pulse Path presets, chosen per section in its metadata. Each returns pixel
 * points relative to main, built from the live layout, so the line keeps to the
 * side gutters and the gaps between sections at every width.
 */
const PRESETS = (() => {
  const side = (x) => (l) => [{ x, y: l.at(0.15) }, { x, y: l.at(0.85) }];
  // runs down one side, then crosses through the gap below the section
  const cross = (from) => (l) => [
    { x: l.guides[from], y: l.at(0.15) },
    { x: l.guides[from], y: l.at(0.7) },
    { x: l.guides.center, y: l.gapBelow },
  ];
  // runs down one side with a loop that swings in towards the content
  const loop = (at, direction) => (l) => {
    const x = l.guides[at];
    const r = l.loopRadius;
    const d = direction * r;
    const m = l.at(0.5);
    return [
      { x, y: l.at(0.15) },
      { x, y: m },
      { x: x + d, y: m + r },
      { x: x + 2 * d, y: m },
      { x: x + d, y: m - r },
      { x, y: l.at(0.85) },
    ];
  };

  return {
    left: (l) => side(l.guides.left)(l),
    right: (l) => side(l.guides.right)(l),
    'left-to-right': cross('left'),
    'right-to-left': cross('right'),
    'loop-left': loop('left', 1),
    'loop-right': loop('right', -1),
  };
})();

function getPresetPoints(name, section, main, origin) {
  const preset = PRESETS[name];
  if (!preset) return null;

  const rect = section.getBoundingClientRect();
  const marginBottom = parseFloat(window.getComputedStyle(section).marginBottom) || 0;
  const top = rect.top - origin.top;
  return preset({
    guides: getGuides(main),
    at: (fraction) => top + rect.height * fraction,
    gapBelow: top + rect.height + marginBottom / 2,
    loopRadius: Math.min(80, origin.width * 0.1),
  });
}

/**
 * The points a section contributes at the current breakpoint, in % of its box.
 * The section's Pulse Path decides: a preset is computed from the layout;
 * "custom" uses the authored points (mobile falls back to the desktop ones).
 * @param {Element} section The section element
 * @param {Element} main The main element
 * @returns {{source: string, box: object, points: {x: number, y: number}[]}}
 *   source is 'custom', 'preset', 'desktop' or 'none'
 */
function getSectionPoints(section, main) {
  const origin = main.getBoundingClientRect();
  const box = getSectionBox(section, origin);
  const { animationPoint, animationPointMobile, pulsePath } = section.dataset;

  // "none" hides the line even when points are still stored from an earlier choice
  if (pulsePath === 'none') return { source: 'none', box, points: [] };

  // Custom points are used when Pulse Path is "custom", or when it is not set
  // but points exist (content authored before the dropdown existed).
  if (pulsePath === 'custom' || (!pulsePath && (animationPoint || animationPointMobile))) {
    if (!desktopQuery.matches && animationPointMobile) {
      return { source: 'custom', box, points: parsePoints(animationPointMobile) };
    }
    if (desktopQuery.matches) return { source: 'custom', box, points: parsePoints(animationPoint) };
    // mobile without its own points uses the desktop ones
    return { source: 'desktop', box, points: parsePoints(animationPoint) };
  }

  const preset = getPresetPoints(pulsePath, section, main, origin);
  if (preset) return { source: 'preset', box, points: preset.map((p) => toPercent(box, p)) };

  return { source: 'none', box, points: [] };
}

// function pathEase(path, axis = 'y', precision = 1) {
/* Previous vertical-only scroll mapping:
function pathEase(path, axis = 'y', precision = 1, startProgress = 0) {
  const rawPath = MotionPathPlugin.cacheRawPathMeasurements(
    MotionPathPlugin.getRawPath(gsap.utils.toArray(path)[0]),
    Math.round(precision * 12),
  );
  const useX = axis === 'x';
  // const start = rawPath[0][useX ? 0 : 1];
  const start = MotionPathPlugin.getPositionOnPath(rawPath, startProgress)[axis];
  const end = rawPath[rawPath.length - 1][
    rawPath[rawPath.length - 1].length - (useX ? 2 : 1)
  ];
  const range = end - start;
  if (Math.abs(range) < 1) return (progress) => progress;
  const l = Math.round(precision * 200);
  const inc = 1 / l;
  const positions = [0];
  const a = [];
  let minIndex = 0;
  const getClosest = (p) => {
    // while (positions[minIndex] <= p && minIndex++ < l) {}
    while (positions[minIndex] <= p) {
      minIndex += 1;
      if (minIndex > l) break;
    }
    // a.push(
    //   ((p - positions[minIndex - 1])
    //       / (positions[minIndex] - positions[minIndex - 1]))
    //       * inc
    //       + minIndex * inc,
    // );
    const upper = Math.min(minIndex, l);
    const lower = Math.max(0, upper - 1);
    const span = positions[upper] - positions[lower];
    const fraction = span > 0 ? (p - positions[lower]) / span : 0;
    a.push(Math.max(0, Math.min(1, (lower + fraction) * inc)));
  };
  let i = 1;
  let p;
  let v;
  for (; i < l; i += 1) {
    p = i / l;
    // v = MotionPathPlugin.getPositionOnPath(rawPath, p)[axis];
    v = MotionPathPlugin.getPositionOnPath(rawPath, startProgress + p * (1 - startProgress))[axis];
    positions[i] = (v - start) / range;
  }
  positions[l] = 1;
  for (i = 0; i < l; i += 1) {
    getClosest(i / l);
  }
  a.push(1);
  return (progress) => {
    const sampleIndex = progress * l;
    const s = a[Math.trunc(sampleIndex)];
    return sampleIndex
      ? s + (a[Math.ceil(sampleIndex)] - s) * (sampleIndex % 1)
      : 0;
  };
}
*/

/* Previous page-wide distance-weighted mapping:
function pathEase(path, axis = 'y', precision = 1, startProgress = 0) {
  const rawPath = MotionPathPlugin.cacheRawPathMeasurements(
    MotionPathPlugin.getRawPath(gsap.utils.toArray(path)[0]),
    Math.round(precision * 12),
  );
  const samples = Math.min(10000, Math.max(200, Math.ceil((rawPath.totalLength || 2000) / 4)));
  const start = Math.max(0, Math.min(1, startProgress));
  const stepLength = (rawPath.totalLength || 2000) * (1 - start) / samples;
  const positions = [0];
  let previous = MotionPathPlugin.getPositionOnPath(rawPath, start)[axis];
  for (let index = 1; index <= samples; index += 1) {
    const progress = start + (index / samples) * (1 - start);
    const current = MotionPathPlugin.getPositionOnPath(rawPath, progress)[axis];
    const weight = Math.max(Math.abs(current - previous), stepLength * 0.5);
    positions.push(positions[index - 1] + weight);
    previous = current;
  }
  const total = positions[samples];
  if (!total) return (progress) => Math.max(0, Math.min(1, progress));

  return (progress) => {
    const target = Math.max(0, Math.min(1, progress)) * total;
    let lower = 0;
    let upper = samples;
    while (upper - lower > 1) {
      const middle = Math.floor((lower + upper) / 2);
      if (positions[middle] <= target) lower = middle;
      else upper = middle;
    }
    const fraction = (target - positions[lower]) / (positions[upper] - positions[lower]);
    return (lower + fraction) / samples;
  };
}
*/

function pathEase(path, axis = 'y', precision = 1, startProgress = 0) {
  const rawPath = MotionPathPlugin.cacheRawPathMeasurements(
    MotionPathPlugin.getRawPath(gsap.utils.toArray(path)[0]),
    Math.round(precision * 12),
  );
  const samples = Math.min(10000, Math.max(200, Math.ceil((rawPath.totalLength || 2000) / 4)));
  const start = Math.max(0, Math.min(1, startProgress));
  const first = MotionPathPlugin.getPositionOnPath(rawPath, start)[axis];
  const last = MotionPathPlugin.getPositionOnPath(rawPath, 1)[axis];
  const range = last - first;
  if (range < 1) return (progress) => Math.max(0, Math.min(1, progress));
  const minimumSpan = range * 0.5;
  const groups = [];
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const position = MotionPathPlugin.getPositionOnPath(rawPath, start + progress * (1 - start));
    // const value = Math.max(0,
    //   Math.min(range - minimumSpan, position[axis] - first - progress * minimumSpan));
    const value = Math.max(
      0,
      Math.min(range - minimumSpan, position[axis] - first - progress * minimumSpan),
    );
    groups.push({
      from: index, to: index, sum: value, count: 1,
    });
    while (groups.length > 1) {
      const right = groups[groups.length - 1];
      const left = groups[groups.length - 2];
      if (left.sum / left.count <= right.sum / right.count) break;
      left.to = right.to;
      left.sum += right.sum;
      left.count += right.count;
      groups.pop();
    }
  }
  const positions = [];
  groups.forEach((group) => {
    const value = group.sum / group.count;
    for (let index = group.from; index <= group.to; index += 1) {
      positions[index] = value + (index / samples) * minimumSpan;
    }
  });

  return (progress) => {
    const target = Math.max(0, Math.min(1, progress)) * range;
    let lower = 0;
    let upper = samples;
    while (upper - lower > 1) {
      const middle = Math.floor((lower + upper) / 2);
      if (positions[middle] <= target) lower = middle;
      else upper = middle;
    }
    const fraction = (target - positions[lower]) / (positions[upper] - positions[lower]);
    return (lower + fraction) / samples;
  };
}

/**
 * Collects the points of every section, in pixels relative to main.
 * @param {Element} main The main element
 * @returns {{x: number, y: number}[]} points in document order
 */
function getPoints(main) {
  // return [...main.querySelectorAll(':scope > .section')].flatMap((section) => {
  return [...main.querySelectorAll(':scope > .section')].flatMap((section) => {
    if (!section.getClientRects().length) return [];
    const { box, points } = getSectionPoints(section, main);
    return points.map((p) => toPixels(box, p));
  });
}

/**
 * Wave shapes measured from the design, in fractions of the page width.
 * start: the curve under the first section - where it leaves the section (x),
 *   where it bottoms out (bottomX), how deep (depth) and how far below the
 *   section it meets the page edge (endY).
 * wave: drawn left to right - offsets below the crest of the left edge, the
 *   trough and the right edge, plus where the crest and trough sit.
 */
const WAVE_SHAPES = {
  mobile: {
    start: {
      x: 0.42, bottomX: 0.51, depth: 0.14, endY: 0.035,
    },
    wave: {
      left: 0.01, crestX: 0.15, troughX: 0.73, trough: 0.07, right: 0.035,
    },
  },
  desktop: {
    start: {
      x: 0.47, bottomX: 0.54, depth: 0.0875, endY: 0.022,
    },
    wave: {
      left: 0.052, crestX: 0.41, troughX: 0.77, trough: 0.0225, right: 0.003,
    },
  },
};

/**
 * Page-level "waves" path, from the `pulse-auto` page metadata. A curve comes
 * out from under the first section, then a wave crosses the page in the gap
 * after every following section. Between waves the line runs down just outside
 * the page edge, where it is clipped, so only the waves show; the arrow still
 * travels one continuous line.
 * @param {Element} main The main element
 * @returns {string|null} the path data, or null when waves are off
 */
function getWavePath(main) {
  const start = getMetadata('pulse-auto');
  if (start !== 'left' && start !== 'right') return null;

  const origin = main.getBoundingClientRect();
  const w = origin.width;
  // page sections, top to bottom; on blog pages the article and sidebar
  // sections are wrapped in .blog-grid, which counts as one section
  const elements = [...main.querySelectorAll(':scope > .section, :scope > .blog-grid')]
    .filter((section) => !section.querySelector('.pulse-animation'))
    .filter((section) => section.getBoundingClientRect().height > 0)
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  const sections = elements.map((section) => section.getBoundingClientRect());
  // the gap between each section and the next one, relative to main
  const gaps = sections.slice(1).map((rect, i) => ({
    middle: (sections[i].bottom + rect.top) / 2 - origin.top,
    nextTop: rect.top - origin.top,
  }));
  if (!gaps.length) return null;

  const shape = WAVE_SHAPES[w < 600 ? 'mobile' : 'desktop'];
  const u = Math.min(w, 1440); // heights stop growing on very wide screens
  const edge = 40; // how far outside main the hidden runs are
  // drawn as "start curve to the right", mirrored for "left"
  const X = (x) => Math.round((start === 'left' ? w - x : x) * 10) / 10;
  const Y = (y) => Math.round(y * 10) / 10;
  const pt = ([x, y]) => `${X(x)},${Y(y)}`;
  const curve = ([c1, c2, end]) => ` C${pt(c1)} ${pt(c2)} ${pt(end)}`;

  // start curve: drops out from under the first section (e.g. the hero) into
  // a tight bottom, then eases up to the page edge. It must end above the
  // next section's first content; with too little room (e.g. a blog article
  // right under its banner) it is left out and the line starts at the waves.
  const s = shape.start;
  const y0 = sections[0].bottom - origin.top - 4;
  // the visually highest content of the next section (CSS order can differ
  // from the DOM, e.g. the blog sidebar form shows first on mobile)
  const contentTop = Math.min(...[...(elements[1]?.querySelectorAll(
    'h1, h2, h3, h4, h5, h6, p, li, img, a, .block',
  ) || [])].map((el) => el.getBoundingClientRect())
    .filter((rect) => rect.height > 0)
    .map((rect) => rect.top - origin.top));
  const room = contentTop - y0 - 16;
  const depth = Math.min(u * s.depth, room);
  let d = '';
  let onRight = false;
  let lastY = -Infinity;
  if (depth >= u * s.depth * 0.6) {
    const p0 = [w * s.x, y0];
    const bottom = [w * s.bottomX, y0 + depth];
    const exit = [w + edge, y0 + depth * (s.endY / s.depth)];
    const drop = bottom[0] - p0[0];
    const rise = w - bottom[0];
    d = `M${pt(p0)}`;
    d += curve([[p0[0], y0 + depth * 0.65], [bottom[0] - drop * 0.55, bottom[1]], bottom]);
    d += curve([[bottom[0] + rise * 0.35, bottom[1]], [bottom[0] + rise * 0.55, exit[1]], exit]);
    onRight = true;
    [, lastY] = bottom;
  }

  const v = shape.wave;
  const extent = u * Math.max(v.left, v.trough, v.right); // crest to lowest point
  gaps.slice(1).forEach(({ middle, nextTop }) => {
    // centred in the gap, but kept clear of the next section's background
    const crestY = Math.min(middle - extent / 2, nextTop - 8 - extent);
    // short sections leave no room for a wave of their own
    if (crestY < lastY + 8) return;
    lastY = crestY + extent;

    // the wave, left to right, as cubic segments with level crest and trough
    const left = [-edge, crestY + u * v.left];
    const crest = [w * v.crestX, crestY];
    const trough = [w * v.troughX, crestY + u * v.trough];
    const right = [w + edge, crestY + u * v.right];
    const span = (from, to) => to[0] - from[0];
    const segments = [
      [[left[0] + span(left, crest) / 3, left[1] + (crest[1] - left[1]) * 0.4],
        [crest[0] - span(left, crest) * 0.4, crest[1]], crest],
      [[crest[0] + span(crest, trough) * 0.45, crest[1]],
        [trough[0] - span(crest, trough) * 0.45, trough[1]], trough],
      [[trough[0] + span(trough, right) * 0.45, trough[1]],
        [right[0] - span(trough, right) * 0.35, right[1] + (trough[1] - right[1]) * 0.3], right],
    ];

    if (onRight) {
      // walked right to left: reverse the segments and swap their controls
      const ends = [left, crest, trough, right];
      d += `${d ? ' L' : 'M'}${pt(right)}`;
      segments.slice().reverse().forEach(([c1, c2], i) => {
        d += curve([c2, c1, ends[2 - i]]);
      });
    } else {
      d += `${d ? ' L' : 'M'}${pt(left)}`;
      segments.forEach((segment) => { d += curve(segment); });
    }
    onRight = !onRight;
  });

  return d || null;
}

/**
 * Draws the curve through the current breakpoint's points.
 * @param {Element} main The main element
 * @returns {boolean} false when there are not enough points for a line
 */
function drawPath(main) {
  const waves = getWavePath(main);
  overlayPath.closest('svg').classList.toggle('pulse-animation-waves', !!waves);
  if (waves) {
    overlayPath.setAttribute('d', waves);
    return true;
  }

  const points = getPoints(main);
  if (points.length < 2) {
    overlayPath.removeAttribute('d');
    return false;
  }

  const rawPath = MotionPathPlugin.arrayToRawPath(points, { curviness: 1.5 });
  overlayPath.setAttribute('d', MotionPathPlugin.rawPathToString(rawPath));
  return true;
}

function killAnimation() {
  const previous = ScrollTrigger.getById(TRIGGER_ID);
  previous?.animation?.kill();
  previous?.kill();
}

// const scrollTrigger = (extra = {}) => ({
const scrollTrigger = (extra = {}, startProgress = 0) => ({
  id: TRIGGER_ID,
  trigger: overlayPath,
  // start: 'top center+=10%',
  start: () => {
    const origin = overlayPath.closest('main').getBoundingClientRect().top + window.scrollY;
    const point = overlayPath.getPointAtLength(overlayPath.getTotalLength() * startProgress);
    return origin + point.y - window.innerHeight * 0.6;
  },
  // markers: true,
  // end: 'bottom center',
  end: () => {
    const origin = overlayPath.closest('main').getBoundingClientRect().top + window.scrollY;
    const point = overlayPath.getPointAtLength(overlayPath.getTotalLength());
    return origin + point.y - window.innerHeight * 0.6;
  },
  // scrub: 1,
  // scrub: 0.5,
  scrub: 0.2,
  ...extra,
});

// Moves the default arrow along the line, scrubbed by scroll.
function animateTrail() {
  const state = { progress: 0 };
  const total = overlayPath.getTotalLength();
  const startProgress = Math.min(TRAIL_LENGTH, total) / total;
  drawTrail(0);
  gsap.to(state, {
    progress: 1,
    // ease: pathEase('.pulse-animation-path', 'y', 0.4),
    ease: pathEase('.pulse-animation-path', 'y', 1, startProgress),
    // scrollTrigger: scrollTrigger(),
    scrollTrigger: scrollTrigger({}, startProgress),
    onUpdate: () => drawTrail(state.progress),
  });
}

// Moves the authored arrow along the line, scrubbed by scroll; it flips when scrolling up.
function animateArrow() {
  const graphic = arrow.querySelector('.pulse-animation-arrow-graphic');
  let currentDirection = 1;

  gsap.to(arrow, {
    motionPath: {
      path: overlayPath,
      align: overlayPath,
      alignOrigin: [0.5, 0.5],
      autoRotate: true,
    },
    scrollTrigger: scrollTrigger({
      onUpdate: (self) => {
        if (self.direction !== currentDirection) {
          currentDirection = self.direction;
          gsap.to(graphic, {
            scaleX: currentDirection,
            duration: 0.3,
            overwrite: 'auto',
          });
        }
      },
    }),
    // ease: 'none',
    ease: pathEase('.pulse-animation-path'),

  });
}

/**
 * Redraws the line and rebuilds the arrow animation for the current layout.
 * The tween is recreated because MotionPathPlugin reads the path when it starts.
 * @param {Element} main The main element
 */
function render(main) {
  killAnimation();
  const hasPath = drawPath(main);
  // with reduced motion only the static line is shown
  const moving = hasPath && !reducedMotionQuery.matches;
  trail.group.toggleAttribute('hidden', !moving || !!arrow);
  if (arrow) arrow.hidden = !moving;
  if (moving) {
    if (arrow) animateArrow();
    else animateTrail();
  }
  ScrollTrigger.refresh();
  const current = ScrollTrigger.getById(TRIGGER_ID);
  current?.animation?.progress(current.progress);
}

function scheduleRender(main) {
  clearTimeout(redrawTimeout);
  redrawTimeout = setTimeout(() => render(main), 150);
}

/**
 * Re-renders when the layout changes: viewport resizes, late layout shifts
 * (fonts, images) and switching between the mobile and desktop points.
 * @param {Element} main The main element
 */
function watchLayout(main) {
  if (layoutWatched) return;
  layoutWatched = true;

  new ResizeObserver(() => scheduleRender(main)).observe(main);
  // blocks can retarget a section's path at runtime, e.g. tab-list on tab change
  new MutationObserver(() => scheduleRender(main)).observe(main, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-pulse-path', 'data-animation-point', 'data-animation-point-mobile'],
  });
  desktopQuery.addEventListener('change', () => render(main));
  reducedMotionQuery.addEventListener('change', () => render(main));
}

async function setup(block, main) {
  createOverlay(main);
  await createArrow(block, main);
  render(main);
  watchLayout(main);
}

// The path editor loads only with ?pulse-edit, never by itself in Universal Editor.
function isEditMode() {
  return new URLSearchParams(window.location.search).has('pulse-edit');
}

async function loadEditor(main) {
  const { default: initEditor } = await import('./pulse-editor.js');
  initEditor({
    main,
    desktopQuery,
    getSectionPoints: (section) => getSectionPoints(section, main),
    getGuides: () => getGuides(main),
    drawPath: () => drawPath(main),
    render: () => render(main),
  });
}

/**
 * loads and decorates the block
 * @param {Element} block The pulse-animation block
 */
export default async function decorate(block) {
  // only the page's own sections (body > main > .section) carry the line;
  // header, footer and other fragments have their own main and are ignored
  const main = document.querySelector('body > main');
  if (!main || !main.contains(block)) return;
  await loadGsap();

  // Points are measured once every section is laid out. Not awaited: sections
  // wait for decorate(), so awaiting the remaining sections here would never resolve.
  setup(block, main).then(() => {
    if (isEditMode()) loadEditor(main);
  });
}
