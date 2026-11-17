import { loadCSS } from '../../scripts/aem.js';

/**
 * Rotating hint in the search field (prototype Intro-Agent-V2): a prefix
 * ("Looking to") and bold phrases, the next one sliding up every 5 s. It pauses
 * while the pointer is over the search box, and hides while the field has
 * focus or a value. Loaded by the search block only when phrases are authored.
 */

const INTERVAL_MS = 5000;
const EXIT_MS = 500;

/**
 * @param {HTMLElement} box the search box
 * @param {HTMLInputElement} input the search field
 * @param {{ prefix: string, phrases: string[] }} hint
 */
export default async function addSearchHint(box, input, { prefix, phrases }) {
  await loadCSS(`${window.hlx.codeBasePath}/blocks/search/search-hint.css`);

  // the field and the hint share a box, the hint shows through the empty field
  const field = document.createElement('span');
  field.className = 'search-hint-field';
  input.replaceWith(field);
  field.append(input);

  const hint = document.createElement('span');
  hint.className = 'search-hint';
  hint.setAttribute('aria-hidden', 'true');
  if (prefix) {
    const lead = document.createElement('span');
    lead.className = 'search-hint-prefix';
    lead.textContent = prefix;
    hint.append(lead);
  }
  const track = document.createElement('span');
  track.className = 'search-hint-track';
  const items = phrases.map((text, i) => {
    const phrase = document.createElement('span');
    phrase.className = `search-hint-phrase${i === 0 ? ' is-active' : ''}`;
    phrase.textContent = text;
    track.append(phrase);
    return phrase;
  });
  hint.append(track);
  field.append(hint);

  // the visible hint replaces the placeholder; screen readers get the first phrase
  input.placeholder = '';
  input.setAttribute('aria-label', [prefix, phrases[0]].filter(Boolean).join(' '));

  const syncValue = () => field.classList.toggle('has-value', input.value.trim() !== '');
  input.addEventListener('input', syncValue);
  syncValue();

  if (items.length < 2) return;
  let current = 0;
  let paused = false;
  box.addEventListener('mouseenter', () => { paused = true; });
  box.addEventListener('mouseleave', () => { paused = false; });
  setInterval(() => {
    if (paused || document.hidden) return;
    const previous = items[current];
    current = (current + 1) % items.length;
    previous.classList.remove('is-active');
    previous.classList.add('is-exit');
    setTimeout(() => previous.classList.remove('is-exit'), EXIT_MS);
    items[current].classList.add('is-active');
  }, INTERVAL_MS);
}
