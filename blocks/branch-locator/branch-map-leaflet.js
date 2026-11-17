/*
 * Branch Locator map: OpenStreetMap through Leaflet (scripts/thirdparty/leaflet, 1.9.4,
 * BSD-2-Clause). Loaded by branch-map.js only when a branch locator is on the page.
 *
 * Figma: pins for the results, zoom in / out and expand buttons at the bottom right, and a
 * branch card over the map when a pin is hovered, focused or tapped. The first result is
 * selected by default; hovering previews a branch and clicking persists the selection.
 * On touch screens the
 * map does not capture one-finger scrolling until it is expanded.
 */

import { loadCSS, loadScript } from '../../scripts/aem.js';

const LIBRARY = '/scripts/thirdparty/leaflet';
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

/** Loads Leaflet once per page. */
function loadLeaflet() {
  if (!library) {
    const base = `${window.hlx?.codeBasePath || ''}${LIBRARY}`;
    library = Promise.all([
      loadCSS(`${base}/leaflet.css`),
      loadScript(`${base}/leaflet.min.js`),
    ]).then(() => {
      if (!window.L) throw new Error('branch-locator: Leaflet did not load');
      return window.L;
    });
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
 * @param {{ onSelect?: Function, renderPopup?: Function, settings: object }} options
 */
export default async function createLeafletMap(container, { onSelect, renderPopup, settings }) {
  const L = await loadLeaflet();
  const coarse = window.matchMedia('(pointer: coarse)');
  const hover = window.matchMedia('(hover: hover)');

  const canvas = document.createElement('div');
  canvas.className = 'branch-locator-map-canvas';
  canvas.setAttribute('role', 'region');
  canvas.setAttribute('aria-label', LABELS.region);
  container.append(canvas);

  const map = L.map(canvas, {
    center: settings.center,
    zoom: settings.zoom,
    zoomSnap: 0.1,
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: false,
    dragging: !coarse.matches,
    keyboard: true,
  });
  L.control.attribution({ prefix: false, position: 'bottomleft' }).addAttribution(settings.attribution).addTo(map);
  L.tileLayer(settings.tiles, { maxZoom: settings.maxZoom }).addTo(map);
  container.classList.add('branch-locator-map-ready');

  // expand and zoom, as in Figma (bottom right)
  const controls = document.createElement('div');
  controls.className = 'branch-locator-map-controls';
  const zoom = document.createElement('div');
  zoom.className = 'branch-locator-map-zoom';
  zoom.append(
    controlButton('branch-locator-map-zoom-in', LABELS.zoomIn, () => map.zoomIn()),
    controlButton('branch-locator-map-zoom-out', LABELS.zoomOut, () => map.zoomOut()),
  );
  const isExpanded = () => container.classList.contains('branch-locator-map-expanded');
  let expand;
  const setExpanded = (expanded) => {
    container.classList.toggle('branch-locator-map-expanded', expanded);
    document.documentElement.classList.toggle('branch-locator-map-open', expanded);
    expand.setAttribute('aria-pressed', String(expanded));
    expand.setAttribute('aria-label', expanded ? LABELS.collapse : LABELS.expand);
    expand.title = expand.getAttribute('aria-label');
    if (coarse.matches) {
      if (expanded) map.dragging.enable(); else map.dragging.disable();
    }
    setTimeout(() => map.invalidateSize(), 50);
    expand.focus();
  };
  expand = controlButton('branch-locator-map-expand', LABELS.expand, () => setExpanded(!isExpanded()));
  expand.setAttribute('aria-pressed', 'false');
  controls.append(expand, zoom);
  container.append(controls);
  // the controls stay usable over the map: clicks and scrolls do not reach it
  L.DomEvent.disableClickPropagation(controls);
  L.DomEvent.disableScrollPropagation(controls);
  // Escape leaves the expanded map or closes the popup
  container.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (isExpanded()) setExpanded(false);
      else if (map.hasLayer(popup)) close(); // eslint-disable-line no-use-before-define
    }
  });

  // pins and the branch card
  const pins = L.layerGroup().addTo(map);
  const markers = new Map();
  let userMarker = null;
  let hideTimer;
  let current = null;
  let selected = null;

  const FOCUS_ZOOM = 14;

  const pinIcon = (active) => L.divIcon({
    className: `branch-locator-pin${active ? ' branch-locator-pin-active' : ''}`,
    html: '<span class="branch-locator-pin-shape" aria-hidden="true"></span>',
    iconSize: [28, 36],
    iconAnchor: [14, 35],
    popupAnchor: [0, -36],
  });

  const popup = L.popup({
    className: 'branch-locator-popup',
    closeButton: false,
    closeOnClick: false,
    autoPan: false,
    offset: [0, -28],
    maxWidth: window.matchMedia('(max-width: 599px)').matches ? 320 : 360,
    minWidth: window.matchMedia('(max-width: 599px)').matches ? 0 : 320,
  });

  // keeps the open popup inside the map canvas so it is never clipped
  const keepInView = () => {
    if (!map.hasLayer(popup)) return;
    const el = popup.getElement();
    if (!el) return;
    const mapBox = container.getBoundingClientRect();
    const cardBox = el.getBoundingClientRect();
    const pad = 16;
    let dx = 0;
    let dy = 0;
    if (cardBox.left < mapBox.left + pad) {
      dx = cardBox.left - (mapBox.left + pad);
    } else if (cardBox.right > mapBox.right - pad) {
      dx = cardBox.right - (mapBox.right - pad);
    }
    if (cardBox.top < mapBox.top + pad) {
      dy = cardBox.top - (mapBox.top + pad);
    } else if (cardBox.bottom > mapBox.bottom - pad) {
      dy = cardBox.bottom - (mapBox.bottom - pad);
    }
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      map.panBy([dx, dy], { animate: true });
    }
  };

  const getFocusCenter = (latlng, targetZoom) => {
    const el = popup.getElement();
    const cardHeight = (el && el.offsetHeight) || 200;
    const point = map.project(latlng, targetZoom);
    // Shift center upwards by half the popup height so both popup and marker are fully visible
    const targetPoint = L.point(point.x, point.y - Math.round(cardHeight / 2));
    return map.unproject(targetPoint, targetZoom);
  };

  const cancelHide = () => clearTimeout(hideTimer);
  const highlight = (branch) => {
    markers.forEach((marker, id) => marker.setIcon(pinIcon(id === branch?.id)));
  };
  const open = (branch, { shouldZoom = true, select = false } = {}) => {
    const marker = markers.get(branch.id);
    if (!marker) return;
    if (select) selected = branch;
    cancelHide();
    if (current?.id === branch.id && map.hasLayer(popup)) {
      return;
    }
    current = branch;
    popup.setLatLng(marker.getLatLng())
      .setContent(renderPopup ? renderPopup(branch) : branch.name);
    popup.openOn(map);
    highlight(branch);

    if (shouldZoom) {
      const currentZoom = map.getZoom();
      const targetZoom = Math.max(currentZoom, FOCUS_ZOOM);
      const targetCenter = getFocusCenter(marker.getLatLng(), targetZoom);
      map.once('moveend', () => {
        requestAnimationFrame(keepInView);
      });
      if (currentZoom < FOCUS_ZOOM) {
        map.setView(targetCenter, targetZoom, { animate: true });
      } else {
        map.panTo(targetCenter, { animate: true });
      }
    } else {
      requestAnimationFrame(keepInView);
    }
  };
  const close = () => {
    cancelHide();
    map.closePopup(popup);
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
  map.on('popupopen', () => {
    const el = popup.getElement();
    if (!el || el.dataset.bound) return;
    el.dataset.bound = 'true';
    L.DomEvent.disableClickPropagation(el);
    el.addEventListener('click', (event) => {
      if (event.target.closest('a, button, .branch-locator-share-wrapper')) return;
      selected = current;
      cancelHide();
    });
    el.addEventListener('mouseenter', cancelHide);
    el.addEventListener('mouseleave', () => { if (hover.matches) scheduleClose(); });
  });
  map.on('resize', keepInView);

  const api = {
    showBranches(branches, { withUser = false } = {}) {
      close();
      if (!withUser) {
        userMarker?.remove();
        userMarker = null;
      }
      pins.clearLayers();
      markers.clear();
      const placed = branches
        .filter((branch) => branch.latitude !== null && branch.longitude !== null);
      placed.forEach((branch) => {
        const marker = L.marker([branch.latitude, branch.longitude], {
          icon: pinIcon(false), keyboard: true, title: branch.name, riseOnHover: true,
        });
        marker.on('mouseover', () => { if (hover.matches) open(branch); });
        marker.on('mouseout', () => { if (hover.matches) scheduleClose(); });
        marker.on('click', () => {
          open(branch, { select: true });
          onSelect?.(branch);
        });
        marker.on('add', () => {
          const el = marker.getElement();
          el?.setAttribute('aria-label', [branch.name, branch.address].filter(Boolean).join(', '));
          // keyboard focus shows the card; a tap or click opens it on click instead, so the
          // map does not pan under the finger before the tap ends
          el?.addEventListener('focus', () => {
            if (el.matches(':focus-visible')) open(branch);
          });
          // Enter or Space on a focused pin selects it, as a button does
          el?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            open(branch, { select: true });
            onSelect?.(branch);
          });
        });
        marker.addTo(pins);
        markers.set(branch.id, marker);
      });
      if (!placed.length) {
        map.setView(settings.center, settings.zoom);
        return;
      }
      const bounds = L.latLngBounds(placed.map((branch) => [branch.latitude, branch.longitude]));
      if (userMarker) bounds.extend(userMarker.getLatLng());
      // the pins stand above their point: more room at the top
      map.fitBounds(bounds, {
        paddingTopLeft: [40, 56], paddingBottomRight: [64, 32], maxZoom: settings.fitMaxZoom,
      });
      open(placed[0], { shouldZoom: false, select: true });
    },
    focusBranch(branch, options) {
      if (markers.has(branch.id)) open(branch, options);
    },
    blurBranch() {
      if (hover.matches) scheduleClose();
    },
    showUser({ latitude, longitude }) {
      userMarker?.remove();
      userMarker = L.circleMarker([latitude, longitude], {
        radius: 8, weight: 3, color: '#fff', fillColor: '#1e4679', fillOpacity: 1,
      }).bindTooltip(LABELS.you).addTo(map);
    },
    reset() {
      close();
      pins.clearLayers();
      markers.clear();
      userMarker?.remove();
      userMarker = null;
      map.setView(settings.center, settings.zoom);
    },
    invalidate() {
      map.invalidateSize();
    },
  };

  // the map area changes size with the layout (and when the panel grows)
  new ResizeObserver(() => map.invalidateSize()).observe(container);
  return api;
}
