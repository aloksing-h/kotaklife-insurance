import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

test('only the latest Share popup opens, including pending hover and click frames', async () => {
  const frames = [];
  function element() {
    const classes = new Set();
    return {
      hidden: false,
      children: [],
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
      },
      append(...children) { this.children.push(...children); },
      setAttribute(name, value) { this[name] = value; },
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect: () => ({ top: 100, bottom: 124 }),
      focus() {},
    };
  }
  const context = createContext({
    document: { createElement: element },
    window: { innerHeight: 600 },
    requestAnimationFrame: (callback) => frames.push(callback),
  });
  const source = await readFile(
    new URL('../blocks/branch-locator/branch-locator.js', import.meta.url),
    'utf8',
  );
  const module = new SourceTextModule(`${source}\nexport { buildSharePopup };`, { context });
  await module.link((specifier) => {
    const exports = specifier.endsWith('/branch-map.js')
      ? { createMap: () => {} }
      : { createBranchSource: () => {}, directionsUrl: () => '' };
    return new SyntheticModule(Object.keys(exports), function initialize() {
      Object.entries(exports).forEach(([name, value]) => this.setExport(name, value));
    }, { context });
  });
  await module.evaluate();
  const firstButton = element();
  const secondButton = element();
  const first = module.namespace.buildSharePopup({}, firstButton, element());
  const second = module.namespace.buildSharePopup({}, secondButton, element());
  const flush = () => frames.splice(0).forEach((callback) => callback());

  first.openPopup({ focus: false });
  flush();
  assert.equal(first.popup.hidden, false);
  second.openPopup({ focus: false });
  assert.equal(first.popup.hidden, true);
  assert.equal(firstButton['aria-expanded'], 'false');
  flush();
  assert.equal(second.popup.hidden, false);
  assert.equal(secondButton['aria-expanded'], 'true');
  assert.equal(first.popup.classList.contains('branch-locator-share-popup-open'), false);

  first.openPopup({ focus: false });
  second.openPopup({ focus: false });
  flush();
  assert.equal(first.popup.hidden, true);
  assert.equal(first.popup.classList.contains('branch-locator-share-popup-open'), false);
  assert.equal(second.popup.classList.contains('branch-locator-share-popup-open'), true);

  first.closePopup();
  second.openPopup({ focus: false });
  flush();
  assert.equal(second.popup.hidden, false);
  second.closePopup();
  second.openPopup({ focus: false });
  flush();
  assert.equal(second.popup.classList.contains('branch-locator-share-popup-open'), true);
});
