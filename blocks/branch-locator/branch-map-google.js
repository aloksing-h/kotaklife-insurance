/*
 * Branch Locator map: Google Maps, loaded as on kotaklife.com (Maps JavaScript API with the
 * site's browser key and a callback). Loaded by branch-map.js only when a branch locator is
 * on the page and a key is configured.
 *
 * Figma: no Google buttons; the block's zoom in / out and expand buttons at the bottom right,
 * the red pins, and a branch card over the map when a pin is hovered, focused or tapped.
 * The first result is selected by default; hovering previews a branch and clicking
 * persists the selection.
 * On touch screens one finger scrolls the page until the map is expanded.
 *
 * When Google refuses the key (for example on a domain the key does not allow), options.onFail
 * is called and branch-map.js shows the next map provider instead.
 */

const API = 'https://maps.googleapis.com/maps/api/js';
const LOAD_TIMEOUT = 10000;
const HIDE_DELAY = 250;
const LABELS = {
  region: 'Map of branches',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  expand: 'Expand map',
  collapse: 'Exit full screen map',
  you: 'Your location',
};

let library;
const failures = new Set();
// Google reports a refused key once per page; maps created later must know it too
let refused = false;

/** Loads the Maps JavaScript API once per page. */
function loadGoogle({ key, region, language }) {
  if (!library) {
    library = new Promise((resolve, reject) => {
      const callback = 'branchLocatorGoogleMapsReady';
      const timer = setTimeout(() => reject(new Error('branch-locator: Google Maps timed out')), LOAD_TIMEOUT);
      window[callback] = () => {
        clearTimeout(timer);
        delete window[callback];
        resolve(window.google.maps);
      };
      // Google calls this when the key is refused (wrong domain, billing, quota)
      const previous = window.gm_authFailure;
      window.gm_authFailure = () => {
        refused = true;
        failures.forEach((fail) => fail());
        if (typeof previous === 'function') previous();
      };
      const params = new URLSearchParams({ key, callback, loading: 'async' });
      if (region) params.set('region', region);
      if (language) params.set('language', language);
      const script = document.createElement('script');
      script.src = `${API}?${params}`;
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error('branch-locator: Google Maps did not load'));
      };
      document.head.append(script);
    }).then(async (maps) => {
      await maps.importLibrary('maps');
      return maps;
    });
    library.catch(() => { library = null; });
  }
  return library;
}

function controlButton(className, label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `branch-locator-map-control ${className}`;
  button.setAttribute('aria-label', label);
  button.title = label;
  const iconEl = document.createElement('span');
  iconEl.className = 'branch-locator-map-control-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  button.append(iconEl);
  button.addEventListener('click', onClick);
  return button;
}

/**
 * @param {HTMLElement} container the map area of the block
 * @param {{ onSelect?: Function, renderPopup?: Function, onFail?: Function, settings: object }}
 *   options
 */
export default async function createGoogleMap(container, {
  onSelect, renderPopup, onFail, settings,
}) {
  const google = settings.google || {};
  // a key refused while loading makes this provider fail; branch-map.js tries the next one
  let failed = false;
  let fail = () => { failed = true; };
  const onRefused = () => fail();
  failures.add(onRefused);
  let maps;
  try {
    maps = await loadGoogle(google);
  } catch (error) {
    failures.delete(onRefused);
    throw error;
  }
  if (failed || refused) {
    failures.delete(onRefused);
    throw new Error('branch-locator: Google Maps refused the key');
  }

  const hover = window.matchMedia('(hover: hover)');
  const [lat, lng] = settings.center;

  const canvas = document.createElement('div');
  canvas.className = 'branch-locator-map-canvas branch-locator-map-google';
  canvas.setAttribute('role', 'region');
  canvas.setAttribute('aria-label', LABELS.region);
  container.append(canvas);

  const map = new maps.Map(canvas, {
    center: { lat, lng },
    zoom: google.zoom ?? Math.round(settings.zoom),
    maxZoom: settings.maxZoom,
    // Figma: only the block's own buttons
    disableDefaultUI: true,
    clickableIcons: false,
    keyboardShortcuts: true,
    // drag with the mouse; on touch, two fingers move the map and one scrolls the page
    gestureHandling: 'cooperative',
  });
  container.classList.add('branch-locator-map-ready');

  // expand and zoom, as in Figma (bottom right)
  const controls = document.createElement('div');
  controls.className = 'branch-locator-map-controls';
  const zoom = document.createElement('div');
  zoom.className = 'branch-locator-map-zoom';
  zoom.append(
    controlButton('branch-locator-map-zoom-in', LABELS.zoomIn, () => map.setZoom(map.getZoom() + 1)),
    controlButton('branch-locator-map-zoom-out', LABELS.zoomOut, () => map.setZoom(map.getZoom() - 1)),
  );
  const isExpanded = () => container.classList.contains('branch-locator-map-expanded');
  let expand;
  const setExpanded = (expanded) => {
    container.classList.toggle('branch-locator-map-expanded', expanded);
    document.documentElement.classList.toggle('branch-locator-map-open', expanded);
    expand.setAttribute('aria-pressed', String(expanded));
    expand.setAttribute('aria-label', expanded ? LABELS.collapse : LABELS.expand);
    expand.title = expand.getAttribute('aria-label');
    // the expanded map takes every gesture
    map.setOptions({ gestureHandling: expanded ? 'greedy' : 'cooperative' });
    expand.focus();
  };
  expand = controlButton('branch-locator-map-expand', LABELS.expand, () => setExpanded(!isExpanded()));
  expand.setAttribute('aria-pressed', 'false');
  controls.append(expand, zoom);
  container.append(controls);
  // Escape leaves the expanded map or closes the popup
  container.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (isExpanded()) setExpanded(false);
      else if (!popup.hidden) close(); // eslint-disable-line no-use-before-define
    }
  });

  // pins, the visitor's location and the branch card, drawn as one overlay
  const layer = document.createElement('div');
  layer.className = 'branch-locator-map-layer';
  const popup = document.createElement('div');
  popup.className = 'branch-locator-gpopup';
  popup.hidden = true;
  maps.OverlayView.preventMapHitsAndGesturesFrom(popup);
  const popupBody = document.createElement('div');
  popupBody.className = 'branch-locator-gpopup-body';
  const tip = document.createElement('span');
  tip.className = 'branch-locator-gpopup-tip';
  tip.setAttribute('aria-hidden', 'true');
  popup.append(popupBody, tip);

  const items = new Map();
  let userDot = null;
  let popupAt = null;
  let current = null;
  let selected = null;
  let hideTimer;

  const Overlay = class extends maps.OverlayView {
    constructor() {
      super();
      this.elements = [layer, popup];
    }

    onAdd() {
      this.getPanes().overlayMouseTarget.append(layer);
      this.getPanes().floatPane.append(popup);
      maps.OverlayView.preventMapHitsAndGesturesFrom(popup);
    }

    draw() {
      const projection = this.getProjection();
      if (!projection) return;
      const place = (el, position) => {
        const point = projection.fromLatLngToDivPixel(position);
        el.style.left = `${point.x}px`;
        el.style.top = `${point.y}px`;
      };
      items.forEach(({ el, position }) => place(el, position));
      if (userDot) place(userDot.el, userDot.position);
      if (popupAt) place(popup, popupAt);
    }

    onRemove() {
      this.elements.forEach((el) => el.remove());
    }
  };
  const overlay = new Overlay();
  overlay.setMap(map);

  const cancelHide = () => clearTimeout(hideTimer);
  const highlight = (branch) => {
    items.forEach(({ el }, id) => {
      el.classList.toggle('branch-locator-pin-active', id === branch?.id);
    });
  };
  const FOCUS_ZOOM = 14;

  // keeps the open card inside the map, like Leaflet's auto pan
  const keepInView = () => {
    if (popup.hidden) return;
    const box = canvas.getBoundingClientRect();
    const card = popup.getBoundingClientRect();
    const pad = 16;
    let dx = 0;
    let dy = 0;
    if (card.left < box.left + pad) dx = card.left - (box.left + pad);
    else if (card.right > box.right - pad) dx = card.right - (box.right - pad);
    if (card.top < box.top + pad) dy = card.top - (box.top + pad);
    else if (card.bottom > box.bottom - pad) dy = card.bottom - (box.bottom - pad);
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) map.panBy(dx, dy);
  };
  const open = (branch, { shouldZoom = true, select = false } = {}) => {
    const item = items.get(branch.id);
    if (!item) return;
    if (select) selected = branch;
    cancelHide();
    if (current?.id === branch.id && !popup.hidden) return;

    const card = renderPopup ? renderPopup(branch) : document.createTextNode(branch.name);
    popupBody.replaceChildren(card);
    popupAt = item.position;
    popup.hidden = false;
    current = branch;
    overlay.draw();
    highlight(branch);

    if (shouldZoom) {
      const currentZoom = map.getZoom();
      if (currentZoom < FOCUS_ZOOM) {
        map.setZoom(FOCUS_ZOOM);
      }
      map.panTo(item.position);
    }
    requestAnimationFrame(keepInView);
    maps.event.addListenerOnce(map, 'idle', keepInView);
  };
  const close = () => {
    cancelHide();
    popup.hidden = true;
    popupAt = null;
    current = null;
    selected = null;
    highlight(null);
  };
  const scheduleClose = () => {
    cancelHide();
    hideTimer = setTimeout(() => {
      if (selected) open(selected, { shouldZoom: false });
    }, HIDE_DELAY);
  };
  popup.addEventListener('mouseenter', cancelHide);
  popup.addEventListener('click', (event) => {
    if (event.target.closest('a, button, .branch-locator-share-wrapper')) return;
    selected = current;
    cancelHide();
  });
  popup.addEventListener('mouseleave', () => { if (hover.matches) scheduleClose(); });

  const clearPins = () => {
    items.forEach(({ el }) => el.remove());
    items.clear();
  };
  const removeUser = () => {
    userDot?.el.remove();
    userDot = null;
  };

  const api = {
    showBranches(branches, { withUser = false } = {}) {
      close();
      clearPins();
      if (!withUser) removeUser();
      const placed = branches
        .filter((branch) => branch.latitude !== null && branch.longitude !== null);
      placed.forEach((branch) => {
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'branch-locator-pin branch-locator-gpin';
        pin.setAttribute('aria-label', [branch.name, branch.address].filter(Boolean).join(', '));
        pin.title = branch.name;
        const shape = document.createElement('span');
        shape.className = 'branch-locator-pin-shape';
        shape.setAttribute('aria-hidden', 'true');
        pin.append(shape);
        pin.addEventListener('mouseenter', () => { if (hover.matches) open(branch); });
        pin.addEventListener('mouseleave', () => { if (hover.matches) scheduleClose(); });
        // keyboard focus shows the card; a tap or click opens it and selects the branch
        pin.addEventListener('focus', () => { if (pin.matches(':focus-visible')) open(branch); });
        pin.addEventListener('click', (event) => {
          event.stopPropagation();
          open(branch, { select: true });
          onSelect?.(branch);
        });
        pin.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open(branch, { select: true });
            onSelect?.(branch);
          }
        });
        maps.OverlayView.preventMapHitsAndGesturesFrom(pin);
        layer.append(pin);
        const position = new maps.LatLng(branch.latitude, branch.longitude);
        items.set(branch.id, { el: pin, position });
      });
      overlay.draw();
      if (!placed.length) {
        map.setCenter({ lat, lng });
        map.setZoom(google.zoom ?? Math.round(settings.zoom));
        return;
      }
      const bounds = new maps.LatLngBounds();
      items.forEach(({ position }) => bounds.extend(position));
      if (userDot) bounds.extend(userDot.position);
      // the pins stand above their point: more room at the top
      map.fitBounds(bounds, {
        top: 56, left: 40, bottom: 32, right: 64,
      });
      maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > settings.fitMaxZoom) map.setZoom(settings.fitMaxZoom);
      });
      open(placed[0], { shouldZoom: false, select: true });
    },
    focusBranch(branch, options) {
      if (items.has(branch.id)) open(branch, options);
    },
    blurBranch() {
      if (hover.matches) scheduleClose();
    },
    showUser({ latitude, longitude }) {
      removeUser();
      const el = document.createElement('span');
      el.className = 'branch-locator-guser';
      el.title = LABELS.you;
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', LABELS.you);
      layer.append(el);
      userDot = { el, position: new maps.LatLng(latitude, longitude) };
      overlay.draw();
    },
    reset() {
      close();
      clearPins();
      removeUser();
      map.setCenter({ lat, lng });
      map.setZoom(google.zoom ?? Math.round(settings.zoom));
    },
    invalidate() {
      overlay.draw();
    },
    destroy() {
      failures.delete(onRefused);
      if (isExpanded()) setExpanded(false);
      overlay.setMap(null);
      maps.event.clearInstanceListeners(map);
      canvas.remove();
      controls.remove();
      container.classList.remove('branch-locator-map-ready');
    },
  };
  // a key refused after the map was drawn: clean up, then the next provider takes over
  fail = () => {
    if (failed) return;
    failed = true;
    api.destroy();
    onFail?.();
  };
  return api;
}
