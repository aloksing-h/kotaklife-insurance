import { loadCSS } from '../../scripts/aem.js';
import {
  STORAGE_KEY, SETTINGS, VISION_TYPES,
  loadState, saveState, applyState, resolve,
  cycleSetting, toggleProfile, setVision, resetState,
} from './a11y-state.js';

/*
 * Accessibility tool: a floating launcher and a panel of accessibility profiles and settings.
 * The site loads it on every page (scripts.js); an authored block on a page sets the launcher
 * icon, its side and its label. The settings logic lives in a11y-state.js and the effects on the
 * page in a11y-adjustments.css (loaded only when a setting is on).
 */

const LABELS = {
  launcher: 'Accessibility options',
  title: 'Accessibility tool',
  close: 'Close accessibility tool',
  profiles: 'Accessibility Profile',
  profilesGroup: 'Accessibility profiles',
  settingsGroup: 'Accessibility settings',
  reset: 'Reset all',
  resetDone: 'All accessibility settings are reset',
  vision: 'Colour blindness type',
  on: 'on',
  off: 'off',
  profile: 'profile',
  level: (level, max) => `level ${level} of ${max}`,
};

const PROFILE_TILES = [
  { id: 'color-blind', label: 'Color Blind', icon: 'a11y-view' },
  { id: 'visually-impaired', label: 'Visually Impaired', icon: 'a11y-eye-off' },
  { id: 'motor-impaired', label: 'Motor Impaired', icon: 'a11y-wheelchair' },
  { id: 'dyslexia', label: 'Dyslexia Font', icon: 'a11y-font' },
];

/* `values` (optional) names each level on the tile itself; otherwise the tile shows level steps */
const SETTING_TILES = [
  {
    id: 'contrast',
    label: 'Contrast',
    icon: 'a11y-contrast',
    values: ['Dark Contrast', 'Light Contrast', 'High Contrast'],
  },
  { id: 'text', label: 'Bigger Text', icon: 'a11y-text-size' },
  { id: 'line-height', label: 'Line Height', icon: 'a11y-line-height' },
  {
    id: 'align', label: 'Text Align', icon: 'a11y-align', values: ['Align Left', 'Align Center', 'Align Right'],
  },
  { id: 'spacing', label: 'Text Spacing', icon: 'a11y-spacing' },
  { id: 'links', label: 'Highlight Links', icon: 'a11y-link' },
  { id: 'cursor', label: 'Cursor', icon: 'a11y-cursor' },
  {
    id: 'saturation', label: 'Saturation', icon: 'a11y-droplet', values: ['Low Saturation', 'High Saturation', 'Grayscale'],
  },
  {
    id: 'dyslexia', label: 'Dyslexia Friendly', icon: 'a11y-view', wide: true,
  },
];

const VISION_LABELS = { protanopia: 'Protanopia', deuteranopia: 'Deuteranopia', tritanopia: 'Tritanopia' };

/* Daltonisation matrices (sRGB): move the colour information a type of colour blindness
   loses into channels that are still seen. They are approximations and help some people
   more than others. */
const VISION_MATRICES = {
  protanopia: '1 0 0 0 0 -0.255 1.255 0 0 0 0.303 -0.545 1.242 0 0 0 0 0 1 0',
  deuteranopia: '1 0 0 0 0 -0.438 1.438 0 0 0 0.262 -0.562 1.3 0 0 0 0 0 1 0',
  tritanopia: '1.05 -0.382 0.332 0 0 0 1.234 -0.234 0 0 0 0 1 0 0 0 0 0 1 0',
};

const ADJUSTMENTS_CSS = 'blocks/accessibility-button/a11y-adjustments.css';
const PANEL_ID = 'accessibility-button-panel';
const MOBILE = window.matchMedia('(max-width: 599px)');

const iconUrl = (name) => `${window.hlx.codeBasePath}/icons/${name}.svg`;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === false || value == null) return;
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : value);
  });
  node.append(...children.filter(Boolean));
  return node;
}

function icon(name, size = 20) {
  return el('img', {
    src: iconUrl(name), alt: '', width: size, height: size, loading: 'lazy', 'aria-hidden': 'true',
  });
}

function addVisionFilters() {
  if (document.getElementById('a11y-vision-filters')) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.id = 'a11y-vision-filters';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  Object.entries(VISION_MATRICES).forEach(([type, values]) => {
    const filter = document.createElementNS(ns, 'filter');
    filter.id = `a11y-${type}`;
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const matrix = document.createElementNS(ns, 'feColorMatrix');
    matrix.setAttribute('type', 'matrix');
    matrix.setAttribute('values', values);
    filter.append(matrix);
    svg.append(filter);
  });
  document.body.append(svg);
  document.documentElement.setAttribute('data-a11y-ready', '');
}

function tile({
  id, label, icon: iconName, wide,
}, kind) {
  const steps = kind === 'setting' && SETTINGS[id].values.length > 1
    && !SETTING_TILES.find((t) => t.id === id).values;
  return el(
    'button',
    {
      type: 'button',
      class: `accessibility-button-tile${wide ? ' is-wide' : ''}`,
      [`data-${kind}`]: id,
      'aria-pressed': 'false',
    },
    icon(iconName),
    el('span', { class: 'accessibility-button-tile-label' }, label),
    steps && el('span', { class: 'accessibility-button-tile-steps', 'aria-hidden': 'true' }, ...SETTINGS[id].values.map(() => el('i'))),
    el('span', { class: 'accessibility-button-visually-hidden accessibility-button-tile-state' }),
  );
}

function buildPanel() {
  const titleId = `${PANEL_ID}-title`;
  const listId = `${PANEL_ID}-profiles`;
  const vision = el(
    'fieldset',
    { class: 'accessibility-button-vision', hidden: true },
    el('legend', { class: 'accessibility-button-visually-hidden' }, LABELS.vision),
    ...VISION_TYPES.map((type) => el(
      'label',
      { class: 'accessibility-button-vision-option' },
      el('input', { type: 'radio', name: `${PANEL_ID}-vision`, value: type }),
      el('span', {}, VISION_LABELS[type]),
    )),
  );
  return el(
    'dialog',
    { class: 'accessibility-button-panel', id: PANEL_ID, 'aria-labelledby': titleId },
    el(
      'div',
      { class: 'accessibility-button-panel-header' },
      el('h2', { id: titleId, class: 'accessibility-button-title' }, LABELS.title),
      el('button', { type: 'button', class: 'accessibility-button-close', 'aria-label': LABELS.close }, icon('a11y-close')),
    ),
    el(
      'div',
      { class: 'accessibility-button-panel-body' },
      el(
        'div',
        { class: 'accessibility-button-profiles' },
        el(
          'div',
          { class: 'accessibility-button-profiles-head' },
          el(
            'h3',
            { class: 'accessibility-button-profiles-title' },
            el(
              'button',
              {
                type: 'button', class: 'accessibility-button-profiles-toggle', 'aria-expanded': 'true', 'aria-controls': listId,
              },
              LABELS.profiles,
              Object.assign(icon('a11y-chevron', 14), { className: 'accessibility-button-chevron' }),
            ),
          ),
          el('button', { type: 'button', class: 'accessibility-button-reset' }, LABELS.reset),
        ),
        el(
          'div',
          { class: 'accessibility-button-profiles-list', id: listId },
          el(
            'div',
            { class: 'accessibility-button-grid', role: 'group', 'aria-label': LABELS.profilesGroup },
            ...PROFILE_TILES.map((t) => tile(t, 'profile')),
          ),
          vision,
        ),
      ),
      el(
        'div',
        { class: 'accessibility-button-grid is-settings', role: 'group', 'aria-label': LABELS.settingsGroup },
        ...SETTING_TILES.map((t) => tile(t, 'setting')),
      ),
    ),
    el('p', { class: 'accessibility-button-visually-hidden', role: 'status', 'aria-live': 'polite' }),
  );
}

/** Describes a setting's level for the tile and for announcements. */
function describe(id, level) {
  const { values } = SETTING_TILES.find((t) => t.id === id);
  const max = SETTINGS[id].values.length;
  if (!level) return LABELS.off;
  if (values) return values[level - 1];
  return max > 1 ? LABELS.level(level, max) : LABELS.on;
}

function render(panel, state) {
  const levels = resolve(state);
  panel.querySelectorAll('[data-setting]').forEach((button) => {
    const id = button.dataset.setting;
    const level = levels[id];
    const config = SETTING_TILES.find((t) => t.id === id);
    button.setAttribute('aria-pressed', level > 0 ? 'true' : 'false');
    button.dataset.level = level;
    button.querySelector('.accessibility-button-tile-label').textContent = config.values && level
      ? config.values[level - 1] : config.label;
    button.querySelector('.accessibility-button-tile-state').textContent = !config.values && SETTINGS[id].values.length > 1 && level
      ? `, ${describe(id, level)}` : '';
  });
  panel.querySelectorAll('[data-profile]').forEach((button) => {
    button.setAttribute('aria-pressed', state.profiles.includes(button.dataset.profile) ? 'true' : 'false');
  });
  const vision = panel.querySelector('.accessibility-button-vision');
  vision.hidden = !state.profiles.includes('color-blind');
  vision.querySelectorAll('input').forEach((input) => { input.checked = input.value === state.vision; });
  const toggle = panel.querySelector('.accessibility-button-profiles-toggle');
  toggle.setAttribute('aria-expanded', state.collapsed ? 'false' : 'true');
  panel.querySelector('.accessibility-button-profiles-list').hidden = state.collapsed;
}

/** Places the panel just below the header, on the launcher's side, inside the viewport. */
function positionPanel(panel, side) {
  const header = document.querySelector('header');
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const gap = MOBILE.matches ? 47 : 12;
  const top = Math.max(8, Math.min(headerBottom + gap, window.innerHeight * 0.25));
  panel.style.setProperty('--accessibility-panel-top', `${Math.round(top)}px`);
  panel.classList.toggle('is-right', side === 'right');
}

function setupPanel(launcher, side) {
  const panel = buildPanel();
  document.body.append(panel);
  const status = panel.querySelector('[role="status"]');
  let state = loadState();

  const announce = (message) => {
    status.textContent = '';
    // a fresh text node makes screen readers announce repeated messages too
    requestAnimationFrame(() => { status.textContent = message; });
  };

  const commit = (next, message) => {
    state = next;
    const applied = applyState(state);
    if (Object.keys(applied).length) loadCSS(`${window.hlx.codeBasePath}/${ADJUSTMENTS_CSS}`);
    saveState(state, applied);
    render(panel, state);
    if (message) announce(message);
  };

  const open = () => {
    positionPanel(panel, side);
    if (typeof panel.showModal === 'function') panel.showModal();
    else panel.setAttribute('open', '');
    launcher.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    if (typeof panel.close === 'function') panel.close();
    else {
      panel.removeAttribute('open');
      panel.dispatchEvent(new Event('close'));
    }
  };

  launcher.addEventListener('click', () => (panel.open ? close() : open()));
  panel.addEventListener('close', () => {
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  });
  panel.addEventListener('keydown', (event) => {
    // the native dialog handles Escape; this covers browsers without showModal
    if (event.key === 'Escape' && typeof panel.showModal !== 'function') close();
  });
  // a click on the backdrop (outside the panel box) closes the panel
  panel.addEventListener('click', (event) => {
    if (event.target !== panel) return;
    const box = panel.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right
      && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) close();
  });

  panel.querySelector('.accessibility-button-close').addEventListener('click', close);
  panel.querySelector('.accessibility-button-reset').addEventListener('click', () => {
    commit(resetState(state), LABELS.resetDone);
  });
  panel.querySelector('.accessibility-button-profiles-toggle').addEventListener('click', () => {
    commit({ ...state, collapsed: !state.collapsed });
  });
  panel.querySelectorAll('[data-setting]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.setting;
      const next = cycleSetting(state, id);
      const { label } = SETTING_TILES.find((t) => t.id === id);
      commit(next, `${label}: ${describe(id, resolve(next)[id])}`);
    });
  });
  panel.querySelectorAll('[data-profile]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.profile;
      const next = toggleProfile(state, id);
      const { label } = PROFILE_TILES.find((t) => t.id === id);
      commit(next, `${label} ${LABELS.profile} ${next.profiles.includes(id) ? LABELS.on : LABELS.off}`);
    });
  });
  panel.querySelector('.accessibility-button-vision').addEventListener('change', (event) => {
    commit(setVision(state, event.target.value), `${LABELS.vision}: ${VISION_LABELS[event.target.value]}`);
  });

  // keep other open tabs of the site in step
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      state = loadState();
      const applied = applyState(state);
      if (Object.keys(applied).length) loadCSS(`${window.hlx.codeBasePath}/${ADJUSTMENTS_CSS}`);
      render(panel, state);
    }
  });

  addVisionFilters();
  commit(state);
}

export default async function decorate(block) {
  // one tool per page: an authored block wins over the one the site adds automatically
  if (document.querySelector('.accessibility-button-control')) {
    block.replaceChildren();
    return;
  }
  const rows = [...block.children];
  const image = block.querySelector('picture img, img');
  const label = rows
    .filter((row) => !row.querySelector('picture, img') && row.textContent.trim())
    .map((row) => row.textContent.trim())
    .pop() || image?.alt || LABELS.launcher;
  const side = block.classList.contains('position-right') ? 'right' : 'left';

  const launcher = el('button', {
    type: 'button',
    class: `accessibility-button-control position-${side}`,
    'aria-label': label,
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    'aria-controls': PANEL_ID,
  });
  const launcherIcon = image || el('img', { src: iconUrl('accessibility-button') });
  launcherIcon.alt = '';
  launcherIcon.setAttribute('aria-hidden', 'true');
  launcherIcon.width = 28;
  launcherIcon.height = 28;
  launcher.append(launcherIcon);
  block.replaceChildren(launcher);
  if (!block.classList.contains('position-left') && !block.classList.contains('position-right')) {
    block.classList.add(`position-${side}`);
  }

  setupPanel(launcher, side);
}
