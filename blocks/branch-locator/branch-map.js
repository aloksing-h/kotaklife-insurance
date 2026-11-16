/*
 * Branch Locator map adapter
 * The block talks to the map only through this module. The map is Google Maps
 * (branch-map-google.js), loaded as on kotaklife.com with the site's browser key. When Google
 * cannot load or refuses the key (the key only allows the domains set by the client), the
 * map is OpenStreetMap through Leaflet (branch-map-leaflet.js) instead, and with no map at
 * all the authored map image stays. Providers are loaded only when a branch locator is on
 * the page. Another provider can replace them without changing the block:
 *
 *   import { registerMapProvider } from '../blocks/branch-locator/branch-map.js';
 *   registerMapProvider(async (container, { onSelect, renderPopup, onFail, settings }) => {
 *     // load the provider library, create the map ...
 *     return {
 *       showBranches(branches, { withUser }) {}, // pins for these branches, zoomed to fit
 *                                  // (withUser: keep the visitor's location in view)
 *       focusBranch(branch, { select = false } = {}) {}, // preview or persist a branch popup
 *       showUser(location) {},     // the visitor's location (Near Me)
 *       reset() {},                // back to the initial view
 *       destroy() {},              // optional: removes the map (before a fallback)
 *     };
 *   });
 * A provider that rejects is skipped; one that calls onFail later is replaced by the next.
 */

const settings = {
  // Google Maps, as on kotaklife.com: the site's browser key (restricted by Google to the
  // domains the client allows), region and language; an empty key skips Google
  google: {
    key: 'AIzaSyBKslFz9Bwv_TlsQGDiA1yBbHNLBLZJzus',
    region: 'IN',
    language: '',
    // the first view; Google zooms in whole steps
    zoom: 5,
  },
  // fallback map tiles; the OpenStreetMap tile servers are for light use, see
  // https://operations.osmfoundation.org/policies/tiles/ before going live
  tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 18,
  // the first view: India, as in Figma
  center: [21.5, 80],
  zoom: 4.6,
  // when fitting the pins of the results
  fitMaxZoom: 13,
};

/**
 * Changes the map settings (Google key, tiles, attribution, first view).
 * @param {object} config
 */
export function configureMap(config = {}) {
  Object.assign(settings, config, {
    google: { ...settings.google, ...(config.google || {}) },
  });
}

const google = async (container, options) => {
  if (!settings.google?.key) throw new Error('branch-locator: no Google Maps key');
  const { default: create } = await import('./branch-map-google.js');
  return create(container, options);
};
const leaflet = async (container, options) => {
  const { default: create } = await import('./branch-map-leaflet.js');
  return create(container, options);
};
let providers = [google, leaflet];

/**
 * Registers the map provider used by branch locators decorated after this call.
 * @param {(container: HTMLElement, options: object) => Promise<object>|object} factory
 */
export function registerMapProvider(factory) {
  providers = [factory];
}

/**
 * Builds the map of a branch locator: the first provider that loads, then the next one if
 * it fails later. What the block has shown (pins, the visitor's location) is shown again on
 * the provider that takes over.
 * @param {HTMLElement} container
 * @param {{ image?: Element, onSelect?: Function, renderPopup?: Function }} options
 * @returns {Promise<{ interactive: boolean, showBranches: Function, focusBranch: Function,
 *   showUser: Function, reset: Function }>}
 */
export async function createMap(container, options = {}) {
  if (options.image && !container.contains(options.image)) container.append(options.image);
  const shown = { branches: null, options: undefined, user: null };
  let map = null;
  const call = (method, ...args) => map?.[method]?.(...args);
  const api = {
    interactive: false,
    showBranches(branches, branchOptions) {
      shown.branches = branches;
      shown.options = branchOptions;
      call('showBranches', branches, branchOptions);
    },
    focusBranch: (branch, focusOptions) => call('focusBranch', branch, focusOptions),
    blurBranch: (branch) => call('blurBranch', branch),
    showUser(location) {
      shown.user = location;
      call('showUser', location);
    },
    reset() {
      shown.branches = null;
      shown.user = null;
      call('reset');
    },
    invalidate: () => call('invalidate'),
  };

  // removes what a failed provider left in the map area
  const before = new Set(container.children);
  const clean = () => {
    [...container.children].forEach((child) => { if (!before.has(child)) child.remove(); });
    container.classList.remove('branch-locator-map-ready', 'branch-locator-map-expanded');
    document.documentElement.classList.remove('branch-locator-map-open');
  };
  // tries the providers in order, from the given one
  const start = async (index) => {
    map = null;
    if (index >= providers.length) {
      // no map could load: the authored map image stays
      api.interactive = false;
      container.classList.add('branch-locator-map-failed');
      container.classList.remove('branch-locator-map-interactive');
      return false;
    }
    try {
      map = await providers[index](container, {
        ...options,
        settings,
        // a provider that stops working later hands over to the next one
        onFail: () => {
          clean();
          start(index + 1);
        },
      });
    } catch {
      clean();
      return start(index + 1);
    }
    api.interactive = true;
    container.classList.add('branch-locator-map-interactive');
    if (shown.user) call('showUser', shown.user);
    if (shown.branches) call('showBranches', shown.branches, shown.options);
    return true;
  };
  await start(0);
  return api;
}
