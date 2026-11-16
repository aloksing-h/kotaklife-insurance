/* global gsap, Draggable */
/**
 * Path editor for the pulse-animation block, loaded only with ?pulse-edit in the
 * page URL (not by itself in Universal Editor). Authors drag, add and remove points on
 * the real page, then copy each section's value into its section properties:
 * set Pulse Path to "Custom points" and paste into "Animation Point" (desktop)
 * or "Animation Point mobile" (below 900px). A section using a preset starts
 * from the preset's points; editing them switches the section to custom points.
 *
 * - click on the page: add a point to the section under the cursor
 * - drag a point: move it (snaps to layout guides, hold Alt to place freely)
 * - remove a point: select it and press Delete, right-click it, or double-click it
 * - nudge the selected point: arrow keys (Shift: 10px), also past the screen edge
 * - push a point off-screen: drag it to the screen edge and hold it there
 * - type exact values in a section's row (Enter applies them)
 * - the panel can be dragged by its header and collapsed; it stays inside the window
 */
import { loadCSS, loadScript } from '../../scripts/aem.js';

const SNAP_DISTANCE = 12;
const PANEL_MARGIN = 8; // px the panel keeps from the window edges
const PIN_INSET = 14; // px from the screen edge where off-screen points are shown
const EDGE_ZONE = 6; // px from the screen edge where holding a dragged point pushes it out
const PUSH_STEP = 4; // px per frame a point is pushed out while held at the edge
const NUDGE = 1; // px per arrow key press (Shift: 10x)
const PANEL_POSITION_KEY = 'pulse-editor-panel';

let api;
let layer;
let panel;
let list;
let enabled = false;
// true from pressing a handle until releasing it; refreshes wait meanwhile,
// because rebuilding the handles would cancel the drag
let interacting = false;
let refreshPending = false;
let altPressed = false;
let selected = null; // { section, point } of the selected handle
let ignoreMutations = false;
let refreshFrame;
let renderTimeout;
const rows = new Map(); // section element -> its panel row

const round = (value) => Math.round(value * 10) / 10;

const formatPoints = (points) => points.map(({ x, y }) => `${round(x)},${round(y)}`).join(' | ');

// parses a typed value; null when any pair is not a valid "x,y"
function parsePoints(value) {
  const pairs = value.split('|').map((pair) => pair.trim()).filter(Boolean);
  const points = pairs.map((pair) => {
    const [x, y, extra] = pair.split(',').map((v) => Number(v.trim()));
    return extra === undefined ? { x, y } : { x: NaN, y: NaN };
  });
  return points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)) ? points : null;
}

const isDesktop = () => api.desktopQuery.matches;

const getSections = () => [...api.main.querySelectorAll(':scope > .section')];

function getSectionName(section, index) {
  const name = [...section.classList]
    .find((c) => c !== 'section' && !c.endsWith('-container'))
    || [...section.classList].find((c) => c.endsWith('-container'))?.replace('-container', '');
  return `${index + 1}. ${name || 'section'}`;
}

const pointsKey = () => (isDesktop() ? 'animationPoint' : 'animationPointMobile');

// changes made here are previews; let the MutationObserver see them before re-enabling it
function withoutObserver(change) {
  ignoreMutations = true;
  change();
  setTimeout(() => { ignoreMutations = false; });
}

function writePoints(section, points) {
  const { dataset } = section;
  withoutObserver(() => {
    // editing a preset switches the section to custom points; remember the preset for Clear
    if (dataset.pulsePath !== 'custom') {
      dataset.pulseEditorPreset = dataset.pulsePath || '';
      dataset.pulsePath = 'custom';
    }
    if (points.length) dataset[pointsKey()] = formatPoints(points);
    else delete dataset[pointsKey()];
  });
}

// removes this breakpoint's custom points; a section switched from a preset gets it back
function clearPoints(section) {
  const { dataset } = section;
  withoutObserver(() => {
    delete dataset[pointsKey()];
    if ('pulseEditorPreset' in dataset && !dataset.animationPoint && !dataset.animationPointMobile) {
      if (dataset.pulseEditorPreset) dataset.pulsePath = dataset.pulseEditorPreset;
      else delete dataset.pulsePath;
      delete dataset.pulseEditorPreset;
    }
  });
}

// the points the live page uses at the current breakpoint, and where they come from
function getModel() {
  return getSections().map((el, index) => ({ el, index, ...api.getSectionPoints(el) }));
}

function describeSource(el, source) {
  const { dataset } = el;
  const notes = [];
  if (source === 'custom') notes.push('custom points');
  if (source === 'preset') notes.push(`preset: ${dataset.pulsePath}`);
  if (source === 'desktop') notes.push('using desktop points');
  if ('pulseEditorPreset' in dataset) notes.push('changed here: set Pulse Path to "Custom points"');
  if (dataset.pulsePath === 'custom' && !dataset.animationPoint) notes.push('no desktop points yet');
  return notes.join(', ');
}

const toPixels = (box, p) => ({
  x: box.x + box.width * (p.x / 100),
  y: box.y + box.height * (p.y / 100),
});

const toPercent = (box, p) => ({
  x: ((p.x - box.x) / box.width) * 100,
  y: ((p.y - box.y) / box.height) * 100,
});

function findSectionAt(model, y) {
  return model.find(({ box }) => y >= box.y && y < box.y + box.height)
    || (y < model[0].box.y ? model[0] : model[model.length - 1]);
}

// vertical guides the line can safely run along: side gutters, content edges, centre
const getGuides = () => Object.values(api.getGuides());

function snapX(x) {
  if (altPressed) return x;
  const guide = getGuides().find((g) => Math.abs(g - x) <= SNAP_DISTANCE);
  return guide ?? x;
}

/**
 * Inserts a point into a section where it lengthens the line the least,
 * taking the neighbouring sections' points into account.
 */
function insertPoint(model, sectionIndex, point) {
  const target = model[sectionIndex];
  const sectionPixels = (s) => s.points.map((p) => toPixels(s.box, p));
  const before = model.slice(0, sectionIndex).flatMap(sectionPixels);
  const after = model.slice(sectionIndex + 1).flatMap(sectionPixels);
  const own = target.points.map((p) => toPixels(target.box, p));
  const px = toPixels(target.box, point);
  const dist = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0);

  let best = own.length;
  let bestCost = Infinity;
  for (let i = 0; i <= own.length; i += 1) {
    const prev = i === 0 ? before[before.length - 1] : own[i - 1];
    const next = i === own.length ? after[0] : own[i];
    const cost = dist(prev, px) + dist(px, next) - dist(prev, next);
    if (cost < bestCost) {
      bestCost = cost;
      best = i;
    }
  }
  target.points.splice(best, 0, point);
}

function getLocalPosition(event) {
  const origin = api.main.getBoundingClientRect();
  return { x: event.clientX - origin.left, y: event.clientY - origin.top };
}

function scheduleRender() {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => api.render(), 100);
}

// batches refreshes to one per frame
function scheduleRefresh() {
  window.cancelAnimationFrame(refreshFrame);
  // eslint-disable-next-line no-use-before-define
  refreshFrame = window.requestAnimationFrame(() => refresh());
}

async function copyValue(input, button) {
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    // the editor iframe may not allow clipboard access
    input.focus();
    input.select();
    document.execCommand('copy');
  }
  button.textContent = 'Copied';
  setTimeout(() => { button.textContent = 'Copy'; }, 1200);
}

// a panel row is built once per section and then only updated, so copying and
// selecting text in it keeps working while the page changes
function createRow(el) {
  const row = document.createElement('li');
  const label = document.createElement('span');
  label.className = 'pulse-editor-label';
  const name = document.createElement('span');
  const note = document.createElement('small');
  note.className = 'pulse-editor-source';
  label.append(name, note);

  // the value can be typed, e.g. to place a point past the screen edge ("-15,40")
  const input = document.createElement('input');
  input.spellcheck = false;
  input.title = 'Type points as x,y | x,y and press Enter';
  input.addEventListener('focus', () => input.select());
  const apply = () => {
    const points = parsePoints(input.value);
    input.classList.toggle('is-invalid', !points);
    if (!points || input.value === input.dataset.applied) return;
    writePoints(el, points);
    api.render();
    scheduleRefresh();
  };
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter') apply();
    if (event.key === 'Escape') {
      input.value = input.dataset.applied;
      input.classList.remove('is-invalid');
      input.blur();
    }
  });
  input.addEventListener('change', apply);

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy';
  copy.addEventListener('click', () => copyValue(input, copy));

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Clear';
  clear.title = 'Remove the custom points for this screen size';
  clear.addEventListener('click', () => {
    clearPoints(el);
    api.render();
    scheduleRefresh();
  });

  row.append(label, input, copy, clear);
  return {
    row, name, note, input, copy, clear,
  };
}

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function updatePanel(model) {
  setText(panel.querySelector('.pulse-editor-mode'), isDesktop()
    ? 'Desktop: Pulse Path "Custom points", paste into "Animation Point"'
    : 'Mobile: Pulse Path "Custom points", paste into "Animation Point mobile"');

  // drop rows of sections that are gone (e.g. replaced by Universal Editor)
  rows.forEach((row, el) => {
    if (!el.isConnected) {
      row.row.remove();
      rows.delete(el);
    }
  });

  model.forEach(({
    el, index, points, source,
  }) => {
    if (!rows.has(el)) rows.set(el, createRow(el));
    const row = rows.get(el);
    const origin = describeSource(el, source);
    setText(row.name, getSectionName(el, index));
    setText(row.note, origin ? ` (${origin})` : '');
    row.note.className = `pulse-editor-source is-${source}`;
    const value = formatPoints(points);
    row.input.dataset.applied = value;
    // never overwrite what the author is typing
    if (row.input.value !== value && document.activeElement !== row.input) {
      row.input.value = value;
      row.input.classList.remove('is-invalid');
    }
    row.input.setAttribute('aria-label', `Points for section ${index + 1}`);
    row.copy.disabled = !points.length;
    row.clear.disabled = source !== 'custom';
    // keeps document order without re-inserting rows that are already in place
    if (list.children[index] !== row.row) list.insertBefore(row.row, list.children[index] || null);
  });
}

function removePoint(sectionIndex, pointIndex) {
  const model = getModel();
  const section = model[sectionIndex];
  if (!section) return;
  section.points.splice(pointIndex, 1);
  writePoints(section.el, section.points);
  selected = null;
  api.render();
  scheduleRefresh();
}

function onHandleDragEnd(handle, x, y) {
  const model = getModel();
  const from = model[Number(handle.dataset.section)];
  const point = Number(handle.dataset.point);
  const to = findSectionAt(model, y);

  if (to === from) {
    from.points[point] = toPercent(from.box, { x, y });
    writePoints(from.el, from.points);
  } else {
    // a point dropped in another section moves to that section
    from.points.splice(point, 1);
    writePoints(from.el, from.points);
    insertPoint(model, to.index, toPercent(to.box, { x, y }));
    writePoints(to.el, to.points);
  }

  selected = null;
  api.render();
  scheduleRefresh();
}

// the visible screen's left and right edges, in px relative to main
function getViewEdges() {
  const origin = api.main.getBoundingClientRect();
  return { left: -origin.left, right: document.documentElement.clientWidth - origin.left };
}

const pointerClientX = (event) => (event?.changedTouches?.[0] || event)?.clientX;

function createHandle(box, point, sectionIndex, pointIndex, number) {
  const { x, y } = toPixels(box, point);
  const view = getViewEdges();
  let side = '';
  if (x < view.left + PIN_INSET) side = 'left';
  if (x > view.right - PIN_INSET) side = 'right';
  // a point past the screen edge is shown pinned to that edge, so it can still be grabbed
  let shownX = x;
  if (side === 'left') shownX = view.left + PIN_INSET;
  if (side === 'right') shownX = view.right - PIN_INSET;

  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'pulse-editor-handle';
  handle.textContent = number;
  handle.title = 'Drag to move (Alt: no snapping), hold at the screen edge to push it further. '
    + 'Delete, right-click or double-click to remove';
  handle.dataset.section = sectionIndex;
  handle.dataset.point = pointIndex;
  if (selected?.section === sectionIndex && selected?.point === pointIndex) {
    handle.classList.add('is-selected');
  }
  const markOutside = (pointX, percentX) => {
    const edges = getViewEdges();
    const outside = pointX < edges.left ? 'left' : (pointX > edges.right && 'right') || '';
    handle.classList.toggle('is-outside', !!outside);
    handle.dataset.side = outside;
    handle.dataset.value = outside ? `${round(percentX)}%` : '';
  };
  markOutside(x, point.x);
  gsap.set(handle, {
    x: shownX, y, xPercent: -50, yPercent: -50,
  });

  // extra px past the handle's position while it is held at the screen edge
  let push = 0;
  let clientX;
  let pushFrame;

  const update = (draggable) => {
    const edges = getViewEdges();
    const atEdge = draggable.x <= edges.left + PIN_INSET + EDGE_ZONE
      || draggable.x >= edges.right - PIN_INSET - EDGE_ZONE;
    // moving back inside pulls the point back to the pointer
    if (!atEdge) push = 0;
    const pointX = draggable.x + push;
    const model = getModel();
    const section = model[sectionIndex];
    const percent = toPercent(section.box, { x: pointX, y: draggable.y });
    section.points[pointIndex] = percent;
    withoutObserver(() => {
      section.el.dataset[pointsKey()] = formatPoints(section.points);
    });
    markOutside(pointX, percent.x);
    // only redraw the line while dragging; the arrow animation is rebuilt on drop
    api.drawPath();
  };

  Draggable.create(handle, {
    type: 'x,y',
    // Draggable blocks the context menu by default; right-click removes a point
    allowContextMenu: true,
    liveSnap: { x: snapX },
    onPress(event) {
      interacting = true;
      clientX = pointerClientX(event);
      // a pinned handle keeps the point where it is until it is moved inside
      push = x - shownX;
    },
    onRelease() {
      interacting = false;
      window.cancelAnimationFrame(pushFrame);
      if (refreshPending) scheduleRefresh();
    },
    onDragStart() {
      const draggable = this;
      // while the pointer is held at the screen edge, keep pushing the point out
      const tick = () => {
        if (!draggable.isDragging) return;
        const width = document.documentElement.clientWidth;
        if (clientX <= EDGE_ZONE) push -= PUSH_STEP;
        else if (clientX >= width - EDGE_ZONE) push += PUSH_STEP;
        if (clientX <= EDGE_ZONE || clientX >= width - EDGE_ZONE) update(draggable);
        pushFrame = window.requestAnimationFrame(tick);
      };
      pushFrame = window.requestAnimationFrame(tick);
    },
    onDrag(event) {
      clientX = pointerClientX(event);
      update(this);
    },
    onDragEnd() {
      window.cancelAnimationFrame(pushFrame);
      onHandleDragEnd(handle, this.x + push, this.y);
    },
    onClick() {
      // a click without moving selects the point, so Delete can remove it
      selected = { section: sectionIndex, point: pointIndex };
      layer.querySelectorAll('.pulse-editor-handle.is-selected')
        .forEach((h) => h.classList.remove('is-selected'));
      handle.classList.add('is-selected');
      handle.focus();
    },
  });

  handle.addEventListener('dblclick', (event) => {
    event.stopPropagation();
    removePoint(sectionIndex, pointIndex);
  });
  handle.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    removePoint(sectionIndex, pointIndex);
  });
  return handle;
}

function updateLayer(model) {
  const origin = api.main.getBoundingClientRect();
  const nodes = [];

  getGuides().forEach((x) => {
    const guide = document.createElement('div');
    guide.className = 'pulse-editor-guide';
    guide.style.left = `${x}px`;
    nodes.push(guide);
  });

  let number = 0;
  model.forEach(({
    el, index, box, points,
  }) => {
    const boundary = document.createElement('div');
    boundary.className = 'pulse-editor-boundary';
    boundary.style.top = `${box.y}px`;
    boundary.textContent = getSectionName(el, index);
    nodes.push(boundary);

    points.forEach((point, pointIndex) => {
      number += 1;
      nodes.push(createHandle(box, point, index, pointIndex, number));
    });
  });

  // the previous handles' Draggables are dropped with their elements
  layer.querySelectorAll('.pulse-editor-handle').forEach((h) => Draggable.get(h)?.kill());
  layer.style.height = `${origin.height}px`;
  layer.replaceChildren(...nodes);
}

function refresh() {
  if (!enabled) return;
  refreshPending = interacting;
  if (interacting) return;
  const model = getModel();
  updateLayer(model);
  updatePanel(model);
}

function onLayerClick(event) {
  event.stopPropagation();
  event.preventDefault();
  if (event.target.closest('.pulse-editor-handle')) return;

  const model = getModel();
  const position = getLocalPosition(event);
  position.x = snapX(position.x);
  const section = findSectionAt(model, position.y);
  insertPoint(model, section.index, toPercent(section.box, position));
  writePoints(section.el, section.points);
  selected = null;
  api.render();
  scheduleRefresh();
}

// moves the selected point by px; it may go past the screen edge
function nudgePoint(dx, dy) {
  const model = getModel();
  const section = model[selected.section];
  const point = section?.points[selected.point];
  if (!point) return;
  const { x, y } = toPixels(section.box, point);
  section.points[selected.point] = toPercent(section.box, { x: x + dx, y: y + dy });
  writePoints(section.el, section.points);
  api.drawPath();
  scheduleRender();
  scheduleRefresh();
}

const ARROWS = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

function onKeyDown(event) {
  altPressed = event.altKey;
  if (!enabled || !selected) return;
  if (event.target.closest?.('input, textarea')) return;
  if (ARROWS[event.key]) {
    event.preventDefault();
    const step = event.shiftKey ? NUDGE * 10 : NUDGE;
    const [dx, dy] = ARROWS[event.key];
    nudgePoint(dx * step, dy * step);
    return;
  }
  if (event.key !== 'Delete' && event.key !== 'Backspace') return;
  event.preventDefault();
  removePoint(selected.section, selected.point);
}

function setEnabled(value) {
  enabled = value;
  selected = null;
  layer.hidden = !enabled;
  panel.classList.toggle('is-enabled', enabled);
  const toggle = panel.querySelector('.pulse-editor-toggle');
  toggle.textContent = enabled ? 'Done' : 'Edit path';
  toggle.setAttribute('aria-pressed', String(enabled));
  refresh();
}

function savePanelPosition(x, y) {
  try {
    localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify({ x, y }));
  } catch {
    // storage may be unavailable; the panel then starts in its default place
  }
}

function restorePanelPosition() {
  try {
    const { x, y } = JSON.parse(localStorage.getItem(PANEL_POSITION_KEY)) || {};
    if (Number.isFinite(x) && Number.isFinite(y)) gsap.set(panel, { x, y });
  } catch {
    // ignore unreadable storage
  }
}

/**
 * Moves the panel back inside the window. Needed whenever its size changes
 * (expanding it, turning editing on, the list growing) or the window resizes:
 * Draggable's bounds only apply while it is being dragged.
 */
function keepPanelInView() {
  const rect = panel.getBoundingClientRect();
  const width = document.documentElement.clientWidth;
  const height = window.innerHeight;
  let dx = 0;
  let dy = 0;
  if (rect.right > width - PANEL_MARGIN) dx = width - PANEL_MARGIN - rect.right;
  if (rect.left + dx < PANEL_MARGIN) dx = PANEL_MARGIN - rect.left;
  if (rect.bottom > height - PANEL_MARGIN) dy = height - PANEL_MARGIN - rect.bottom;
  if (rect.top + dy < PANEL_MARGIN) dy = PANEL_MARGIN - rect.top;
  if (!dx && !dy) return;

  const x = gsap.getProperty(panel, 'x') + dx;
  const y = gsap.getProperty(panel, 'y') + dy;
  gsap.set(panel, { x, y });
  Draggable.get(panel)?.update();
  savePanelPosition(x, y);
}

function createPanel() {
  panel = document.createElement('aside');
  panel.className = 'pulse-editor-panel';
  panel.setAttribute('aria-label', 'Pulse path editor');

  const header = document.createElement('div');
  header.className = 'pulse-editor-header';
  const title = document.createElement('strong');
  title.textContent = 'Pulse path';
  title.title = 'Drag to move the panel';

  const collapse = document.createElement('button');
  collapse.type = 'button';
  collapse.className = 'pulse-editor-collapse';
  collapse.textContent = '–';
  collapse.title = 'Collapse the panel';
  collapse.setAttribute('aria-expanded', 'true');
  collapse.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    collapse.textContent = collapsed ? '+' : '–';
    collapse.title = collapsed ? 'Expand the panel' : 'Collapse the panel';
    collapse.setAttribute('aria-expanded', String(!collapsed));
  });

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'pulse-editor-toggle';
  toggle.addEventListener('click', () => setEnabled(!enabled));

  const actions = document.createElement('span');
  actions.className = 'pulse-editor-actions';
  actions.append(collapse, toggle);
  header.append(title, actions);

  const mode = document.createElement('p');
  mode.className = 'pulse-editor-mode';
  const help = document.createElement('p');
  help.className = 'pulse-editor-help';
  help.textContent = 'Click the page to add a point, drag to move (Alt: no snap). '
    + 'Selected point: arrow keys nudge it (Shift: 10px), Delete removes it; right-click or '
    + 'double-click also removes. Hold a dragged point at the screen edge to push it off-screen.';

  list = document.createElement('ol');
  list.className = 'pulse-editor-list';

  panel.append(header, mode, help, list);
  // keep clicks in the panel from selecting components in Universal Editor
  panel.addEventListener('click', (event) => event.stopPropagation());
  document.body.append(panel);

  restorePanelPosition();
  Draggable.create(panel, {
    type: 'x,y',
    trigger: header,
    bounds: window,
    dragClickables: false,
    onDragEnd() {
      savePanelPosition(this.x, this.y);
      keepPanelInView();
    },
  });
  new ResizeObserver(keepPanelInView).observe(panel);
  window.addEventListener('resize', keepPanelInView);
}

function createLayer() {
  layer = document.createElement('div');
  layer.className = 'pulse-editor-layer';
  layer.addEventListener('click', onLayerClick);
  // keep presses on the layer from reaching Universal Editor
  layer.addEventListener('pointerdown', (event) => event.stopPropagation());
  api.main.append(layer);
}

// true for nodes the pulse block or this editor add to main
const isOwnNode = (node) => node.nodeType === 1
  && [...node.classList].some((c) => c.startsWith('pulse-animation-') || c.startsWith('pulse-editor-'));

function watch() {
  new ResizeObserver(scheduleRefresh).observe(api.main);
  api.desktopQuery.addEventListener('change', scheduleRefresh);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (event) => { altPressed = event.altKey; });

  // Only changes that affect the path: the section attributes, and sections
  // added or replaced (e.g. Universal Editor after a property change). Changes
  // inside sections (carousels, videos) are ignored.
  new MutationObserver((records) => {
    if (ignoreMutations || interacting) return;
    const relevant = records.some((record) => record.type === 'attributes'
      || [...record.addedNodes, ...record.removedNodes].some((node) => !isOwnNode(node)));
    if (!relevant) return;
    scheduleRender();
    scheduleRefresh();
  }).observe(api.main, {
    childList: true,
    subtree: true,
    attributeFilter: ['data-animation-point', 'data-animation-point-mobile', 'data-pulse-path'],
  });
}

/**
 * Starts the editor. Safe to call again when the block is re-decorated.
 * @param {object} options
 * @param {Element} options.main The main element
 * @param {MediaQueryList} options.desktopQuery Desktop breakpoint query
 * @param {Function} options.getSectionPoints A section's points, box and their source
 * @param {Function} options.getGuides Safe vertical lines for the path
 * @param {Function} options.drawPath Redraws the line only
 * @param {Function} options.render Redraws the line and rebuilds the animation
 */
export default async function initEditor(options) {
  const firstRun = !api;
  api = options;
  if (!firstRun) {
    if (!layer.isConnected) api.main.append(layer);
    scheduleRefresh();
    return;
  }

  await Promise.all([
    loadCSS(`${window.hlx.codeBasePath}/blocks/pulse-animation/pulse-editor.css`),
    loadScript(`${window.hlx.codeBasePath}/scripts/thirdparty/draggable.min.js`),
  ]);
  gsap.registerPlugin(Draggable);
  createLayer();
  createPanel();
  watch();
  setEnabled(false);
}
