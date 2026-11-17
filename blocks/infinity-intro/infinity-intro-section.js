import { loadCSS } from '../../scripts/aem.js';

/**
 * Lets the infinity-intro hand over to a whole section when no banner block
 * follows it (agentic flow, prototype Intro-Agent-V2: the "Looking For"
 * section with the plan cards, search and Bestseller banner). The section's
 * blocks stay as they are: a decorative layer is added after them (soft
 * gradient; it receives the intro video at the hand-off) and
 * their wrappers fade in, rising 35 px, from 5.2 s for 1.3 s.
 */

const REVEAL = { at: 5.2, dur: 1.3, ease: 'sine.out' };

/**
 * Where the section starts once it has taken the intro's place (the intro
 * section hidden); the section then fills the screen below that point.
 * Measured at the top of the page only, with both changes undone before paint.
 * @param {Element} section
 */
function measureTop(section) {
  const intro = section.previousElementSibling;
  if (!intro || Math.abs(window.scrollY) >= 2) return;
  const saved = [intro.style.display, section.style.display];
  intro.style.display = 'none';
  section.style.display = 'block';
  const top = section.getBoundingClientRect().top + window.scrollY;
  [intro.style.display, section.style.display] = saved;
  section.style.setProperty('--infinity-section-top', `${Math.max(0, Math.round(top))}px`);
}

/**
 * Prepares the section as the intro's partner ("fade" mode).
 * @param {Element} section
 * @returns {Promise<Element>} the section, with its `infinityStage`
 */
export default async function stageSection(section) {
  await loadCSS(`${window.hlx.codeBasePath}/blocks/infinity-intro/infinity-intro-section.css`);
  const content = [...section.children];

  // added last, so the section's own wrappers keep their order
  const stage = document.createElement('div');
  stage.className = 'infinity-intro-section-stage';
  stage.setAttribute('aria-hidden', 'true');
  const art = document.createElement('div');
  art.className = 'infinity-intro-section-art';
  stage.append(art);
  section.append(stage);
  section.classList.add('infinity-intro-section');

  // its images load while the intro plays, not when it comes up
  section.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; });

  measureTop(section);
  window.addEventListener('resize', () => measureTop(section));

  section.infinityStage = {
    mode: 'fade',
    host: stage,
    tweens: () => [
      { el: art, ...REVEAL, props: { opacity: [0, 1] } },
      ...content.map((el) => ({ el, ...REVEAL, props: { opacity: [0, 1], y: [35, 0] } })),
    ],
  };
  return section;
}
