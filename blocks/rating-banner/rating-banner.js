import { moveInstrumentation } from '../../scripts/scripts.js';
import { decorateIcons } from '../../scripts/aem.js';

const STAR_COUNT = 5;
const DEFAULT_RATED_BY = 130843;

/**
 * Formats a number using Indian digit grouping, e.g. 130843 -> "1,30,843".
 * @param {number} num
 * @returns {string}
 */
function formatIndianNumber(num) {
  const str = Math.trunc(num).toString();
  if (str.length <= 3) return str;
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/**
 * Builds a row of star icons.
 * @param {HTMLElement} container
 * @param {number} filled Number of stars rendered as solid/filled
 * @param {boolean} interactive Whether the stars are clickable buttons
 * @param {number} [count=STAR_COUNT] Total number of stars to render
 * @returns {HTMLElement[]} the created star elements
 */
function buildStars(container, filled, interactive, count = STAR_COUNT) {
  const stars = [];
  for (let i = 1; i <= count; i += 1) {
    const star = document.createElement(interactive ? 'button' : 'span');
    star.className = 'rating-banner-star';
    if (interactive) {
      star.type = 'button';
      star.setAttribute('aria-label', `Rate ${i} star${i > 1 ? 's' : ''}`);
      star.setAttribute('aria-pressed', 'false');
    }
    const icon = document.createElement('span');
    icon.className = `icon icon-rating-star-${i <= filled ? 'solid' : 'outline'}`;
    star.append(icon);
    container.append(star);
    stars.push(star);
  }
  return stars;
}

/** Swaps decorated icon's image to a different icon name without re-fetching via decorateIcons. */
function swapIcon(iconSpan, iconName) {
  const img = iconSpan.querySelector('img');
  if (!img) return;
  const base = window.hlx?.codeBasePath || '';
  img.dataset.iconName = iconName;
  img.src = `${base}/icons/${iconName}.svg`;
}

/**
 * Splits a richtext field authored as value + label (two paragraphs, or one
 * paragraph with a <br>) into its two parts.
 * @param {HTMLElement} row
 * @param {{ value: string, label: string }} defaults fallback used when authoring is empty
 * @returns {{ value: string, label: string }}
 */
function parseValueAndLabel(row, defaults) {
  const paragraphs = [...(row?.querySelectorAll('p') || [])].filter((p) => p.textContent.trim());
  if (paragraphs.length >= 2) {
    return {
      value: paragraphs[0].textContent.trim(),
      label: paragraphs.slice(1).map((p) => p.textContent.trim()).join(' '),
    };
  }
  const text = (paragraphs[0] || row)?.innerHTML || '';
  const [value, label] = text.split(/<br\s*\/?>/i).map((part) => part.replace(/<[^>]+>/g, '').trim());
  return { value: value || defaults.value, label: label || defaults.label };
}

export default function decorate(block) {
  const [iconRow, ratedByLabelRow, overallRatingRow, feedbackRow] = [...block.children];

  const picture = iconRow?.querySelector('picture');
  const ratedByLabelText = ratedByLabelRow?.textContent.trim() || 'Rated by customers';
  const { value: ratingValueText, label: overallLabelText } = parseValueAndLabel(
    overallRatingRow,
    { value: '4.7', label: 'Overall ratings' },
  );
  const ctaLink = feedbackRow?.querySelector('a');
  const ctaParagraph = ctaLink?.closest('p');
  const questionText = [...(feedbackRow?.querySelectorAll('p') || [])]
    .filter((p) => p !== ctaParagraph && p.textContent.trim())
    .map((p) => p.textContent.trim())
    .join(' ') || 'Was this helpful?';
  const ctaLabel = ctaLink?.textContent.trim() || 'Submit Rating';

  const inner = document.createElement('div');
  inner.className = 'rating-banner-inner';

  // Aggregate: icon + rated-by count + overall rating
  const aggregate = document.createElement('div');
  aggregate.className = 'rating-banner-aggregate';

  const count = document.createElement('div');
  count.className = 'rating-banner-count';
  const countIcon = document.createElement('span');
  countIcon.className = 'rating-banner-count-icon';
  if (picture) {
    moveInstrumentation(iconRow, countIcon);
    countIcon.append(picture);
  }
  const countText = document.createElement('div');
  countText.className = 'rating-banner-count-text';
  const countValue = document.createElement('p');
  countValue.className = 'rating-banner-count-value';
  countValue.dataset.ratingCount = String(DEFAULT_RATED_BY);
  countValue.textContent = formatIndianNumber(DEFAULT_RATED_BY);
  const countLabel = document.createElement('p');
  countLabel.className = 'rating-banner-count-label';
  if (ratedByLabelRow) moveInstrumentation(ratedByLabelRow, countLabel);
  countLabel.textContent = ratedByLabelText;
  countText.append(countValue, countLabel);
  count.append(countIcon, countText);

  const divider = document.createElement('span');
  divider.className = 'rating-banner-divider';
  divider.setAttribute('aria-hidden', 'true');

  const overall = document.createElement('div');
  overall.className = 'rating-banner-overall';
  if (overallRatingRow) moveInstrumentation(overallRatingRow, overall);
  const overallValue = document.createElement('p');
  overallValue.className = 'rating-banner-overall-value';
  const overallIcon = document.createElement('span');
  overallIcon.className = 'icon icon-rating-star-solid';
  const overallSuffix = document.createElement('span');
  overallSuffix.className = 'rating-banner-overall-suffix';
  overallSuffix.textContent = '/ 5';
  const cleanRatingValue = ratingValueText.replace(/\s*\/\s*5\s*$/, '').trim();
  overallValue.append(overallIcon, document.createTextNode(` ${cleanRatingValue} `), overallSuffix);
  const overallLabel = document.createElement('p');
  overallLabel.className = 'rating-banner-overall-label';
  overallLabel.textContent = overallLabelText;
  overall.append(overallValue, overallLabel);

  aggregate.append(count, divider, overall);

  // Feedback: question + stars, swapping to a thank-you message on submit
  const feedback = document.createElement('div');
  feedback.className = 'rating-banner-feedback';
  feedback.setAttribute('aria-live', 'polite');

  const prompt = document.createElement('div');
  prompt.className = 'rating-banner-prompt';
  if (feedbackRow) moveInstrumentation(feedbackRow, feedback);
  const question = document.createElement('p');
  question.className = 'rating-banner-question';
  question.textContent = questionText;
  const starsRow = document.createElement('div');
  starsRow.className = 'rating-banner-stars';
  starsRow.setAttribute('role', 'radiogroup');
  starsRow.setAttribute('aria-label', 'Rate this page');
  const starButtons = buildStars(starsRow, 0, true);
  prompt.append(question, starsRow);

  const thanks = document.createElement('div');
  thanks.className = 'rating-banner-thanks';
  thanks.hidden = true;
  const thanksStars = document.createElement('div');
  thanksStars.className = 'rating-banner-stars is-static';
  thanksStars.setAttribute('aria-hidden', 'true');
  const thanksText = document.createElement('p');
  thanksText.className = 'rating-banner-thanks-text';
  thanksText.textContent = 'Thank you for rating us!';
  thanks.append(thanksStars, thanksText);

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'rating-banner-cta is-disabled';
  cta.disabled = true;
  cta.setAttribute('aria-disabled', 'true');
  const ctaLabelSpan = document.createElement('span');
  ctaLabelSpan.className = 'rating-banner-cta-label';
  ctaLabelSpan.textContent = ctaLabel;
  const ctaIconWrap = document.createElement('span');
  ctaIconWrap.className = 'rating-banner-cta-icon';
  const ctaIcon = document.createElement('span');
  ctaIcon.className = 'icon icon-rating-arrow-right';
  ctaIconWrap.append(ctaIcon);
  cta.append(ctaLabelSpan, ctaIconWrap);

  feedback.append(prompt, thanks, cta);

  inner.append(aggregate, feedback);
  block.innerHTML = '';
  block.append(inner);

  decorateIcons(inner);

  let selected = 0;
  starButtons.forEach((star, idx) => {
    star.addEventListener('click', () => {
      selected = idx + 1;
      starButtons.forEach((btn, btnIdx) => {
        swapIcon(btn.querySelector('.icon'), `rating-star-${btnIdx < selected ? 'solid' : 'outline'}`);
        btn.setAttribute('aria-pressed', btnIdx < selected ? 'true' : 'false');
      });
      cta.disabled = false;
      cta.setAttribute('aria-disabled', 'false');
      cta.classList.remove('is-disabled');
    });
  });

  cta.addEventListener('click', (event) => {
    event.preventDefault();
    if (selected === 0 || cta.disabled || cta.getAttribute('aria-disabled') === 'true') {
      starButtons[0]?.focus();
      return;
    }

    thanksStars.replaceChildren();
    buildStars(thanksStars, selected, false, STAR_COUNT);
    thanksStars.setAttribute('aria-label', `${selected} star${selected > 1 ? 's' : ''}`);
    decorateIcons(thanksStars);

    prompt.hidden = true;
    cta.hidden = true;
    thanks.hidden = false;

    const current = Number(countValue.dataset.ratingCount) || DEFAULT_RATED_BY;
    const next = current + 1;
    countValue.dataset.ratingCount = String(next);
    countValue.textContent = formatIndianNumber(next);
  });
}
