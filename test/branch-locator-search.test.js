import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

async function setup() {
  const elements = [];
  const searches = [];
  const pendingCities = [];
  function createElement(tag) {
    const classes = new Set();
    const handlers = new Map();
    const node = {
      tag,
      children: [],
      value: '',
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
        toggle: (name, enabled) => {
          if (enabled) classes.add(name);
          else classes.delete(name);
        },
      },
      append(...children) {
        children.forEach((child) => { child.parent = node; });
        node.children.push(...children);
      },
      replaceChildren(...children) {
        node.children = [];
        node.append(...children);
        if (tag === 'select') node.value = '';
      },
      get options() { return node.children; },
      get firstElementChild() { return node.children[0]; },
      setAttribute(name, value) { node[name] = value; },
      removeAttribute(name) { delete node[name]; },
      addEventListener(name, callback) {
        const callbacks = handlers.get(name) || [];
        handlers.set(name, [...callbacks, callback]);
      },
      async emit(name) {
        await Promise.all((handlers.get(name) || []).map((callback) => callback({
          preventDefault() {},
        })));
      },
      closest() { return node.parent; },
      querySelector() { return null; },
      focus() {},
      scrollIntoView() {},
    };
    elements.push(node);
    return node;
  }
  const context = createContext({
    document: { createElement },
    window: { matchMedia: () => ({ matches: true }) },
    navigator: {},
    Option: function Option(text, value) { return { text, value }; },
  });
  const source = await readFile(
    new URL('../blocks/branch-locator/branch-locator.js', import.meta.url),
    'utf8',
  );
  const module = new SourceTextModule(source, { context });
  const branchSource = {
    states: async () => ['Maharashtra', 'Tamil Nadu'],
    cities: (state) => new Promise((resolve) => {
      pendingCities.push({ state, resolve });
    }),
    byPincode: async (pin) => {
      searches.push({ pin });
      return { branches: [] };
    },
    byArea: async (state, city) => {
      searches.push({ state, city });
      return [];
    },
  };
  await module.link((specifier) => {
    const exports = specifier.endsWith('/branch-map.js')
      ? { createMap: async () => ({ showBranches() {}, reset() {} }) }
      : { createBranchSource: () => branchSource, directionsUrl: () => '' };
    return new SyntheticModule(Object.keys(exports), function initialize() {
      Object.entries(exports).forEach(([name, value]) => this.setExport(name, value));
    }, { context });
  });
  await module.evaluate();
  await module.namespace.default(createElement('div'));
  await new Promise((resolve) => { setImmediate(resolve); });
  const [state, city] = elements.filter((node) => node.tag === 'select');
  return {
    state,
    city,
    pin: elements.find((node) => node.tag === 'input'),
    form: elements.find((node) => node.tag === 'form'),
    searches,
    pendingCities,
    flush: () => new Promise((resolve) => { setImmediate(resolve); }),
  };
}

test('state and city placeholders remain labeled after loading and clearing options', async () => {
  const view = await setup();
  assert.equal(view.state.options[0].text, 'State');
  assert.equal(view.city.options[0].text, 'City');
  assert.equal(view.state.options[0].value, '');
  view.state.value = 'Maharashtra';
  const loading = view.state.emit('change');
  view.pendingCities[0].resolve(['Mumbai']);
  await loading;
  assert.equal(view.city.options[0].text, 'City');
  assert.equal(view.city.options[1].text, 'Mumbai');
  view.state.value = '';
  await view.state.emit('change');
  assert.equal(view.city.options[0].text, 'City');
  assert.equal(view.city.disabled, true);
});

test('switching methods clears alternate fields and submits only the active method', async () => {
  const view = await setup();
  view.state.value = 'Maharashtra';
  const loading = view.state.emit('change');
  view.pendingCities[0].resolve(['Mumbai']);
  await loading;
  view.city.value = 'Mumbai';
  await view.city.emit('change');
  view.pin.value = '400070';
  await view.pin.emit('input');
  assert.equal(view.state.value, '');
  assert.equal(view.city.value, '');
  assert.equal(view.city.disabled, true);
  assert.equal(view.state.parent.classList.contains('branch-locator-filled'), false);
  await view.form.emit('submit');
  await view.flush();
  assert.deepEqual(view.searches, [{ pin: '400070' }]);

  view.state.value = 'Tamil Nadu';
  const nextLoading = view.state.emit('change');
  assert.equal(view.pin.value, '');
  view.pendingCities[1].resolve(['Chennai']);
  await nextLoading;
  view.city.value = 'Chennai';
  await view.city.emit('change');
  await view.form.emit('submit');
  await view.flush();
  assert.deepEqual(view.searches[1], { state: 'Tamil Nadu', city: 'Chennai' });
});

test('pincode entry cancels pending city population and retains validation', async () => {
  const view = await setup();
  view.state.value = 'Maharashtra';
  const loading = view.state.emit('change');
  view.pin.value = '12a';
  await view.pin.emit('input');
  view.pendingCities[0].resolve(['Mumbai']);
  await loading;
  assert.equal(view.pin.value, '12');
  assert.equal(view.state.value, '');
  assert.equal(view.city.options.length, 1);
  assert.equal(view.city.disabled, true);
  await view.form.emit('submit');
  assert.equal(view.pin['aria-invalid'], 'true');
  assert.equal(view.searches.length, 0);
});
