import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { EASE } from '../blocks/infinity-intro/infinity-timeline.js';

async function setup() {
  const frames = [];
  const timers = [];
  const context = createContext({
    window: { matchMedia: () => ({ matches: true }) },
    requestAnimationFrame: (callback) => frames.push(callback),
    setTimeout: (callback) => timers.push(callback),
  });
  const source = await readFile(
    new URL('../blocks/infinity-intro/infinity-intro.js', import.meta.url),
    'utf8',
  );
  // Expose the private helper only in the isolated test module.
  const module = new SourceTextModule(
    `${source}\nexport { painted, frameRect, animateShutter, SHUTTER_MS, SHUTTER_EASE };`,
    { context },
  );
  await module.link((specifier) => {
    const exports = specifier.endsWith('/scripts.js')
      ? { moveInstrumentation: () => {} }
      : { default: () => {}, EASE, elementTarget: () => {} };
    return new SyntheticModule(Object.keys(exports), function initialize() {
      Object.entries(exports).forEach(([name, value]) => this.setExport(name, value));
    }, { context });
  });
  await module.evaluate();

  const video = new EventTarget();
  video.readyState = 0;
  video.paused = false;
  video.error = null;
  let present = null;
  video.requestVideoFrameCallback = (callback) => {
    present = callback;
    return 1;
  };
  video.cancelVideoFrameCallback = () => { present = null; };
  return {
    painted: module.namespace.painted,
    frameRect: module.namespace.frameRect,
    animateShutter: module.namespace.animateShutter,
    shutter: { duration: module.namespace.SHUTTER_MS, ease: module.namespace.SHUTTER_EASE },
    video,
    frames,
    timers,
    present: () => present?.(),
  };
}

test('tablet video and mask geometry stays bottom-aligned and horizontally centered', async () => {
  const { frameRect } = await setup();
  const aspect = 720 / 1270;
  [
    {
      left: 0, top: 0, width: 721, height: 900,
    },
    {
      left: 0, top: 0, width: 721, height: 784,
    },
  ].forEach((box) => {
    const bottom = frameRect(box, aspect, 'cover-bottom');
    const centered = frameRect(box, aspect, 'cover');
    assert.equal(bottom.left + bottom.width / 2, box.left + box.width / 2);
    assert.equal(bottom.top + bottom.height, box.top + box.height);
    assert.equal(bottom.width, centered.width);
    assert.equal(bottom.height, centered.height);
    assert.ok(bottom.top < centered.top);
  });
});

test('shutter matches the prototype duration and cubic ease-in-out travel', async () => {
  const { shutter } = await setup();
  assert.equal(shutter.duration, 1500);
  assert.equal(shutter.ease, 'power2.inOut');
  const ease = EASE[shutter.ease];
  const positions = [0, 0.25, 0.5, 0.75, 1].map(ease);
  assert.deepEqual(positions, [0, 0.0625, 0.5, 0.9375, 1]);
});

test('shutter waits for layout, then both halves animate together until finished', async () => {
  const { animateShutter, frames } = await setup();
  const calls = [];
  const finishes = [];
  let removed = false;
  let height = 0;
  const shutter = {
    getBoundingClientRect: () => ({ height }),
    style: { setProperty() {} },
    children: [0, 1].map(() => ({
      animate(keyframes, options) {
        calls.push({ keyframes, options });
        return { finished: new Promise((resolve) => { finishes.push(resolve); }) };
      },
    })),
    remove() { removed = true; },
  };
  const finished = animateShutter(shutter);
  assert.equal(calls.length, 0);
  assert.equal(frames.length, 1);
  height = 203;
  frames.shift()();
  assert.equal(calls.length, 2);
  calls.forEach(({ keyframes, options }, index) => {
    assert.equal(options.duration, 1500);
    assert.equal(options.fill, 'forwards');
    assert.equal(keyframes[0].transform, 'translate3d(0, 0px, 0)');
    assert.equal(keyframes[30].transform, `translate3d(0, ${index === 0 ? -50 : 50}px, 0)`);
    assert.equal(keyframes[60].transform, `translate3d(0, ${index === 0 ? -100 : 100}px, 0)`);
  });
  finishes[0]();
  await Promise.resolve();
  assert.equal(removed, false);
  finishes[1]();
  await finished;
  assert.equal(removed, true);
});

test('slow videos cannot reveal the stage before a decoded frame is presented', async () => {
  const {
    painted, video, timers, present,
  } = await setup();
  let resolved = false;
  const ready = painted(video).then((value) => {
    resolved = true;
    return value;
  });
  timers.forEach((callback) => callback());
  await Promise.resolve();
  assert.equal(resolved, false);
  video.readyState = 3;
  video.dispatchEvent(new Event('playing'));
  await Promise.resolve();
  assert.equal(resolved, false);
  present();
  assert.equal(await ready, true);
});

test('an already playing video still waits for its next presented frame', async () => {
  const { painted, video, present } = await setup();
  video.readyState = 4;
  let resolved = false;
  const ready = painted(video).then((value) => {
    resolved = true;
    return value;
  });
  await Promise.resolve();
  assert.equal(resolved, false);
  present();
  assert.equal(await ready, true);
});

test('paused videos and browsers without video callbacks use a decoded frame', async () => {
  const { painted, video, frames } = await setup();
  video.paused = true;
  const ready = painted(video);
  video.readyState = 2;
  video.dispatchEvent(new Event('loadeddata'));
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(await ready, true);

  video.paused = false;
  video.requestVideoFrameCallback = undefined;
  const fallback = painted(video);
  frames.shift()();
  assert.equal(await fallback, true);
});

test('video failures resolve explicitly and cancel a pending frame callback', async () => {
  const { painted, video, present } = await setup();
  video.readyState = 4;
  const ready = painted(video);
  video.error = { code: 3 };
  video.dispatchEvent(new Event('error'));
  assert.equal(await ready, false);
  present();
  assert.equal(await painted(video), false);
});
