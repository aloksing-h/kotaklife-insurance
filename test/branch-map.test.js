/* eslint-disable max-classes-per-file, class-methods-use-this */
// Lightweight DOM and map-library stubs exercise both providers without network requests.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

class Element {
  constructor() {
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.style = {};
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, active) => {
        if (active) this.classes.add(name);
        else this.classes.delete(name);
      },
    };
  }

  append(...children) { this.children.push(...children); }

  replaceChildren(...children) { this.children = children; }

  setAttribute() {}

  getAttribute() { return ''; }

  addEventListener(name, callback) {
    const callbacks = this.listeners.get(name) || [];
    this.listeners.set(name, [...callbacks, callback]);
  }

  emit(name, event = {}) {
    (this.listeners.get(name) || []).forEach((callback) => callback({
      preventDefault() {}, stopPropagation() {}, ...event,
    }));
  }

  getBoundingClientRect() {
    return {
      left: 0, top: 0, right: 500, bottom: 500,
    };
  }

  remove() {}
}

class MapStub {
  constructor() {
    this.listeners = new Map();
    this.zoom = 14;
  }

  on(name, callback) { this.listeners.set(name, callback); return this; }

  addListener(name, callback) { return this.on(name, callback); }

  once() {}

  getZoom() { return this.zoom; }

  setZoom(zoom) { this.zoom = zoom; }

  setView() {}

  panTo() {}

  panBy() {}

  fitBounds() {}

  setCenter() {}

  project() { return { x: 0, y: 0 }; }

  unproject(point) { return point; }

  hasLayer(popup) { return !popup.element.hidden; }

  closePopup(popup) { popup.element.hidden = true; }
}

const branches = [
  {
    id: 'first', name: 'First', latitude: 19, longitude: 72,
  },
  {
    id: 'second', name: 'Second', latitude: 20, longitude: 73,
  },
  {
    id: 'third', name: 'Third', latitude: 21, longitude: 74,
  },
];

async function setup(provider) {
  const map = new MapStub();
  const pins = [];
  const frames = [];
  const timers = new Set();
  const panes = { overlayMouseTarget: new Element(), floatPane: new Element() };
  const container = new Element();
  let popup;
  let options;
  const leaflet = {
    map: () => map,
    control: {
      attribution: () => ({ addAttribution: () => ({ addTo() {} }) }),
    },
    tileLayer: () => ({ addTo() {} }),
    layerGroup: () => ({ addTo: () => ({ clearLayers: () => { pins.length = 0; } }) }),
    divIcon: () => ({}),
    point: (x, y) => ({ x, y }),
    latLngBounds: () => ({ extend() {} }),
    DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {} },
    popup: (config) => {
      options = config;
      popup = new Element();
      popup.hidden = true;
      const instance = {
        element: popup,
        setLatLng: () => instance,
        setContent: (content) => { popup.content = content; return instance; },
        getElement: () => popup,
        openOn: () => {
          popup.hidden = false;
          map.listeners.get('popupopen')?.();
        },
      };
      return instance;
    },
    marker: () => {
      const pin = new Element();
      pin.on = (name, callback) => { pin.addEventListener(name, callback); return pin; };
      pin.getElement = () => pin;
      pin.getLatLng = () => ({ lat: 19, lng: 72 });
      pin.setIcon = () => {};
      pin.addTo = () => { pins.push(pin); pin.emit('add'); };
      return pin;
    },
  };
  class Overlay {
    static preventMapHitsAndGesturesFrom() {}

    setMap(value) {
      if (value) this.onAdd();
      else this.onRemove();
    }

    getPanes() { return panes; }

    getProjection() {
      return { fromLatLngToDivPixel: () => ({ x: 0, y: 0 }) };
    }
  }
  const google = {
    Map: function MapFactory() { return map; },
    OverlayView: Overlay,
    LatLng: class {},
    LatLngBounds: class { extend() {} },
    event: { addListenerOnce() {}, clearInstanceListeners() {} },
  };
  const context = createContext({
    testLibrary: provider === 'leaflet' ? leaflet : google,
    window: { matchMedia: () => ({ matches: true }) },
    document: {
      createElement: () => new Element(),
      documentElement: new Element(),
    },
    ResizeObserver: class { observe() {} },
    requestAnimationFrame: (callback) => frames.push(callback),
    setTimeout: (callback) => { timers.add(callback); return callback; },
    clearTimeout: (callback) => timers.delete(callback),
  });
  const source = await readFile(
    new URL(`../blocks/branch-locator/branch-map-${provider}.js`, import.meta.url),
    'utf8',
  );
  const module = new SourceTextModule(
    `${source}\nlibrary = Promise.resolve(testLibrary);`,
    { context },
  );
  await module.link(() => new SyntheticModule(
    ['loadCSS', 'loadScript'],
    function initialize() {
      this.setExport('loadCSS', () => {});
      this.setExport('loadScript', () => {});
    },
    { context },
  ));
  await module.evaluate();
  const selected = [];
  const api = await module.namespace.default(container, {
    settings: {
      center: [19, 72], zoom: 5, google: {}, fitMaxZoom: 13,
    },
    renderPopup: (branch) => branch.id,
    onSelect: (branch) => selected.push(branch.id),
  });
  if (provider === 'google') {
    [popup] = panes.floatPane.children;
  }
  const flush = () => {
    const pending = [...timers];
    timers.clear();
    pending.forEach((callback) => callback());
    frames.splice(0).forEach((callback) => callback());
  };
  return {
    api,
    map,
    selected,
    popup,
    options,
    flush,
    displayed: () => (provider === 'leaflet' ? popup.content : popup.children[0].children[0]),
    marker: (index) => (provider === 'leaflet'
      ? pins[index] : panes.overlayMouseTarget.children[0].children[index]),
    enter: provider === 'leaflet' ? 'mouseover' : 'mouseenter',
    leave: provider === 'leaflet' ? 'mouseout' : 'mouseleave',
  };
}

['leaflet', 'google'].forEach((provider) => {
  test(`${provider}: default popup, hover previews and persistent card/marker selection`, async () => {
    const view = await setup(provider);
    view.api.showBranches(branches);
    view.flush();
    assert.equal(view.displayed(), 'first');
    assert.equal(view.popup.hidden, false);

    view.marker(1).emit(view.enter);
    assert.equal(view.displayed(), 'second');
    view.marker(1).emit(view.leave);
    view.popup.emit('mouseenter');
    view.flush();
    assert.equal(view.displayed(), 'second');
    view.popup.emit('mouseleave');
    view.flush();
    assert.equal(view.displayed(), 'first');

    view.marker(2).emit(view.enter);
    view.popup.emit('click', { target: { closest: () => null } });
    view.popup.emit('mouseleave');
    view.flush();
    assert.equal(view.displayed(), 'third');

    view.marker(0).emit(view.enter);
    view.popup.emit('click', { target: { closest: () => ({}) } });
    view.popup.emit('mouseleave');
    view.flush();
    assert.equal(view.displayed(), 'third');

    view.marker(1).emit('click');
    view.marker(1).emit(view.leave);
    view.flush();
    assert.equal(view.displayed(), 'second');
    assert.deepEqual(view.selected, ['second']);

    view.api.focusBranch(branches[2]);
    assert.equal(view.displayed(), 'third');
    view.api.blurBranch();
    view.flush();
    assert.equal(view.displayed(), 'second');

    view.api.focusBranch(branches[2], { select: true });
    view.api.blurBranch();
    view.flush();
    assert.equal(view.displayed(), 'third');
    assert.equal(view.map.listeners.has('click'), false);
    if (provider === 'leaflet') assert.equal(view.options.closeOnClick, false);

    view.marker(0).emit(view.enter);
    view.marker(0).emit(view.leave);
    view.marker(1).emit('click');
    view.flush();
    assert.equal(view.displayed(), 'second');
    assert.equal(view.popup.hidden, false);

    view.api.showBranches([branches[0]]);
    view.flush();
    assert.equal(view.displayed(), 'first');
    view.api.reset();
    view.flush();
    assert.equal(view.popup.hidden, true);
    view.api.showBranches([]);
    view.flush();
    assert.equal(view.popup.hidden, true);
  });
});
