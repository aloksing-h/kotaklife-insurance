import { decorateIcons, loadCSS } from '../../scripts/aem.js';

/*
 * Banner V2, style "Error Banner" (error-banner): the 404 page banner.
 * Figma 404 - D 12130:7946 (desktop) / 404 - M 12130:7972 (mobile).
 * The illustration (plugs, ray lines and the 404 numerals) is authored as the desktop
 * and mobile images, exported on a canvas centred on the page (1416 x 328 desktop,
 * 618 x 321 mobile), so the cables run off both sides. The text is a heading with the
 * message and the Back to Home button.
 * Loaded by banner-v2.js only for this style; its CSS is scoped to the class.
 */

// the default CTA icons are red; on the red button the arrow sits in a white circle
const DEFAULT_ICONS = ['right-red-filled', 'right-black-filled'];

export default async function decorate(block) {
  block.querySelector('.banner-v2-visual')?.setAttribute('aria-hidden', 'true');

  const icons = [...block.querySelectorAll('.banner-v2-cta-icon .icon')]
    .filter((icon) => DEFAULT_ICONS.some((name) => icon.classList.contains(`icon-${name}`)));
  icons.forEach((icon) => {
    const white = document.createElement('span');
    white.className = 'icon icon-right-white-filled';
    icon.replaceWith(white);
  });
  if (icons.length) decorateIcons(block);

  await loadCSS(`${window.hlx.codeBasePath}/blocks/banner-v2/banner-v2-error.css`);
}
