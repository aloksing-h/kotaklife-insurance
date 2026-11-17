/**
 * A small scrubbable timeline for the infinity intro: tweens of numeric
 * values laid out in seconds, rendered for any progress 0..1. The eases are
 * the GSAP curves the prototype uses, so timings and feel match it exactly.
 */

const BACK_OVERSHOOT = 1.6;

export const EASE = {
  none: (p) => p,
  'sine.out': (p) => Math.sin((p * Math.PI) / 2),
  'sine.inOut': (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  'power1.inOut': (p) => (p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2),
  'power2.out': (p) => 1 - (1 - p) ** 3,
  'power2.inOut': (p) => (p < 0.5 ? 4 * p ** 3 : 1 - ((-2 * p + 2) ** 3) / 2),
  'back.out': (p) => {
    const q = p - 1;
    return q * q * ((BACK_OVERSHOOT + 1) * q + BACK_OVERSHOOT) + 1;
  },
};

/**
 * Applies opacity and a translate / scale transform to an element.
 * Translations are multiplied by `unit()` (design px to screen px).
 * @param {HTMLElement} el
 * @param {Function} [unit] returns the current px per design px
 * @returns {{ apply: Function }}
 */
export function elementTarget(el, unit = () => 1) {
  return {
    apply({
      opacity, x = 0, y = 0, scale = 1,
    }) {
      if (opacity !== undefined) el.style.opacity = opacity;
      const u = unit();
      el.style.transform = `translate(${x * u}px, ${y * u}px) scale(${scale})`;
    },
  };
}

/**
 * Builds a timeline from tweens: { target, at, dur, ease, props: { key: [from, to] } }.
 * Before a value's first tween it holds that tween's start value; a later
 * tween of the same value takes over from its own start time.
 * @param {object[]} tweens
 * @returns {{ duration: number, render: Function }}
 */
export default function createTimeline(tweens) {
  const duration = Math.max(...tweens.map((tween) => tween.at + tween.dur));
  const sorted = [...tweens].sort((a, b) => a.at - b.at);
  const initial = new Map();
  sorted.forEach(({ target, props }) => {
    if (!initial.has(target)) initial.set(target, {});
    const values = initial.get(target);
    Object.entries(props).forEach(([key, [from]]) => {
      if (!(key in values)) values[key] = from;
    });
  });

  return {
    duration,
    render(progress) {
      const time = progress * duration;
      const values = new Map([...initial].map(([target, start]) => [target, { ...start }]));
      sorted.forEach(({
        target, at, dur, ease, props,
      }) => {
        if (time < at) return;
        const local = dur ? Math.min(1, (time - at) / dur) : 1;
        const eased = (EASE[ease] || EASE.none)(local);
        const current = values.get(target);
        Object.entries(props).forEach(([key, [from, to]]) => {
          current[key] = from + (to - from) * eased;
        });
      });
      values.forEach((current, target) => target.apply(current));
    },
  };
}
