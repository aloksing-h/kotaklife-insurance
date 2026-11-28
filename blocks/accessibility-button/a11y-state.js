/**
 * Accessibility preferences: settings, profiles, state rules, persistence and page application.
 *
 * State = { profiles: [profile ids, in activation order], overrides: { setting: level },
 *           vision: colour vision type, collapsed: profiles section collapsed }
 * Effective level of a setting = the user's explicit choice (override) if there is one,
 * otherwise the strongest value from the active profiles, otherwise 0 (off).
 * Levels are numbers: 0 = off, n = the nth value in the setting's `values`.
 * The page reflects the effective levels as data-a11y-<setting>="<value>" attributes on <html>,
 * which a11y-adjustments.css turns into styles; nothing else is written to page elements
 * except the original font size recorded for Bigger Text.
 */

export const STORAGE_KEY = 'kotak-a11y';
const LEGACY_STORAGE_KEY = 'kotak-accessibility-preferences';
const ROOT = document.documentElement;
const PANEL_SELECTOR = '.accessibility-button-panel, .accessibility-button';

/**
 * Settings. `ordinal` settings combine across profiles by taking the highest level;
 * the others take the value of the most recently activated profile.
 */
export const SETTINGS = {
  contrast: { values: ['dark', 'light', 'high'] },
  text: { values: ['1', '2', '3'], ordinal: true },
  'line-height': { values: ['1', '2', '3'], ordinal: true },
  align: { values: ['left', 'center', 'right'] },
  spacing: { values: ['1', '2', '3'], ordinal: true },
  links: { values: ['on'], ordinal: true },
  cursor: { values: ['on'], ordinal: true },
  saturation: { values: ['low', 'high', 'gray'] },
  dyslexia: { values: ['on'], ordinal: true },
  // set by profiles only (no tile of their own)
  vision: { values: ['protanopia', 'deuteranopia', 'tritanopia'] },
  focus: { values: ['on'], ordinal: true },
  targets: { values: ['on'], ordinal: true },
};

export const VISION_TYPES = SETTINGS.vision.values;

/** Profile bundles: setting -> level. `vision` is filled in from state.vision. */
export const PROFILES = {
  'color-blind': { vision: 'type', links: 1 },
  'visually-impaired': {
    text: 2, contrast: 3, links: 1, cursor: 1, 'line-height': 1,
  },
  'motor-impaired': {
    focus: 1, cursor: 1, links: 1, targets: 1,
  },
  dyslexia: {
    dyslexia: 1, spacing: 1, 'line-height': 2, align: 1,
  },
};

const FILTER_SETTINGS = ['contrast', 'saturation', 'vision'];

export function emptyState() {
  return {
    profiles: [], overrides: {}, vision: 'deuteranopia', collapsed: false,
  };
}

function clampLevel(setting, level) {
  const max = SETTINGS[setting]?.values.length || 0;
  const n = Number(level);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : 0;
}

function sanitize(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== 'object') return state;
  if (Array.isArray(raw.profiles)) {
    state.profiles = raw.profiles.filter((id, i, all) => PROFILES[id] && all.indexOf(id) === i);
  }
  if (raw.overrides && typeof raw.overrides === 'object') {
    Object.entries(raw.overrides).forEach(([setting, level]) => {
      if (SETTINGS[setting]) state.overrides[setting] = clampLevel(setting, level);
    });
  }
  if (VISION_TYPES.includes(raw.vision)) state.vision = raw.vision;
  state.collapsed = raw.collapsed === true;
  return state;
}

/** Maps the preferences saved by the previous version of the tool, then removes them. */
function migrateLegacy() {
  let legacy;
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (e) {
    return null;
  }
  if (!legacy || typeof legacy !== 'object') return null;
  const state = emptyState();
  if (legacy.contrast) state.overrides.contrast = 3;
  if (legacy['large-text']) state.overrides.text = 1;
  if (legacy['underline-links']) state.overrides.links = 1;
  return state;
}

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return sanitize(JSON.parse(saved));
  } catch (e) {
    // storage unavailable or corrupt: start clean
  }
  return migrateLegacy() || emptyState();
}

/** Effective level of every setting. */
export function resolve(state) {
  const levels = {};
  Object.entries(SETTINGS).forEach(([setting, { ordinal }]) => {
    if (setting in state.overrides) {
      levels[setting] = state.overrides[setting];
      return;
    }
    let level = 0;
    state.profiles.forEach((id) => {
      let value = PROFILES[id][setting];
      if (value === undefined) return;
      if (value === 'type') value = VISION_TYPES.indexOf(state.vision) + 1;
      level = ordinal ? Math.max(level, value) : value;
    });
    levels[setting] = level;
  });
  return levels;
}

/** Attribute values for the active settings, e.g. { contrast: 'dark', text: '2' }. */
export function toAttributes(levels) {
  const applied = {};
  Object.entries(levels).forEach(([setting, level]) => {
    if (level > 0) applied[setting] = SETTINGS[setting].values[level - 1];
  });
  if (FILTER_SETTINGS.some((setting) => applied[setting])) applied.filter = 'on';
  return applied;
}

export function saveState(state, applied) {
  try {
    const empty = !state.profiles.length && !Object.keys(state.overrides).length;
    if (empty && !state.collapsed) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, applied }));
  } catch (e) {
    // private mode or storage full: settings still apply for this page
  }
}

/** Keeps an explicit choice only while it differs from what the active profiles give. */
function prune(state) {
  const overrides = { ...state.overrides };
  Object.keys(overrides).forEach((setting) => {
    const without = { ...overrides };
    delete without[setting];
    if (resolve({ ...state, overrides: without })[setting] === overrides[setting]) {
      delete overrides[setting];
    }
  });
  return { ...state, overrides };
}

/** Cycles a tile setting: off -> level 1 -> ... -> last level -> off. */
export function cycleSetting(state, setting) {
  const current = resolve(state)[setting];
  const next = (current + 1) % (SETTINGS[setting].values.length + 1);
  return prune({ ...state, overrides: { ...state.overrides, [setting]: next } });
}

/**
 * Toggles a profile. Turning one on clears the user's own choices only for the settings in
 * that profile, so the profile's values take effect; other choices are left alone.
 */
export function toggleProfile(state, id) {
  if (state.profiles.includes(id)) {
    return prune({ ...state, profiles: state.profiles.filter((p) => p !== id) });
  }
  const overrides = { ...state.overrides };
  Object.keys(PROFILES[id]).forEach((setting) => { delete overrides[setting]; });
  return { ...state, profiles: [...state.profiles, id], overrides };
}

export function setVision(state, type) {
  const overrides = { ...state.overrides };
  delete overrides.vision;
  return { ...state, vision: type, overrides };
}

export function resetState(state) {
  return { ...emptyState(), collapsed: state.collapsed };
}

/* ---------- Bigger Text: scale from each element's own original size ---------- */

const TEXT_SELECTOR = 'p, li, dt, dd, h1, h2, h3, h4, h5, h6, a, span, strong, em, b, i, small, label, '
  + 'button, input, select, textarea, td, th, caption, figcaption, blockquote, legend, summary, sup, sub';
const FS_PROP = '--a11y-fs';
let textObserver;
let pendingRoots = [];

function hasOwnText(el) {
  return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
}

/**
 * Records the original font size of every text element under root. All sizes are read first and
 * written afterwards, so the page's styles are recalculated once rather than once per element.
 */
function recordTree(root) {
  if (root.nodeType !== 1 || root.closest(PANEL_SELECTOR)) return;
  const candidates = [root, ...root.querySelectorAll(`${TEXT_SELECTOR}, div`)]
    .filter((el) => (el.matches(TEXT_SELECTOR) || (el.matches('div') && hasOwnText(el)))
      && el.textContent.trim() // icon-only controls keep their size
      && !el.style.getPropertyValue(FS_PROP) && !el.closest(PANEL_SELECTOR));
  const originals = new Map();
  candidates.forEach((el) => {
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (!size) return;
    // an element that only inherits its size from an already scaled ancestor takes the
    // ancestor's original size (only happens for content added while Bigger Text is on)
    const parent = el.parentElement?.closest(`[style*="${FS_PROP}"]`);
    if (parent && !originals.has(parent)) {
      const parentOriginal = parseFloat(parent.style.getPropertyValue(FS_PROP));
      if (Math.abs(size - parseFloat(getComputedStyle(parent).fontSize)) < 0.1) {
        originals.set(el, parentOriginal);
        return;
      }
    }
    originals.set(el, size);
  });
  originals.forEach((size, el) => el.style.setProperty(FS_PROP, `${size}px`));
}

function startTextScaling() {
  if (textObserver) return;
  recordTree(document.body);
  textObserver = new MutationObserver((mutations) => {
    if (!pendingRoots.length) {
      requestAnimationFrame(() => {
        const roots = pendingRoots;
        pendingRoots = [];
        roots.forEach((node) => { if (node.isConnected) recordTree(node); });
      });
    }
    mutations.forEach((m) => m.addedNodes.forEach((node) => {
      if (node.nodeType === 1) pendingRoots.push(node);
    }));
  });
  textObserver.observe(document.body, { childList: true, subtree: true });
}

function stopTextScaling() {
  if (!textObserver) return;
  textObserver.disconnect();
  textObserver = null;
  pendingRoots = [];
  document.querySelectorAll(`[style*="${FS_PROP}"]`).forEach((el) => {
    el.style.removeProperty(FS_PROP);
    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
}

/* ---------- Page application ---------- */

let appliedKeys = [];

/**
 * Applies the effective settings to the page. Bigger Text is measured before its attribute is
 * set, so the original sizes are recorded unscaled.
 * @returns {Object} the attributes now applied
 */
export function applyState(state) {
  const applied = toAttributes(resolve(state));
  if (applied.text) {
    ROOT.removeAttribute('data-a11y-text');
    startTextScaling();
  } else {
    stopTextScaling();
  }
  [...new Set([...appliedKeys, ...Object.keys(SETTINGS), 'filter'])].forEach((key) => {
    if (applied[key]) ROOT.setAttribute(`data-a11y-${key}`, applied[key]);
    else ROOT.removeAttribute(`data-a11y-${key}`);
  });
  appliedKeys = Object.keys(applied);
  return applied;
}
