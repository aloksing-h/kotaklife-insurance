import { loadCSS } from '../../scripts/aem.js';
import decorateInsuranceGuide from './banner-v2-insurance-guide.js';

/*
 * Banner V2, style "Leadership Banner" (leadership-banner):
 * Figma Leadership, Inner page banners 2:1057 (desktop) / 2:1011 (mobile).
 * The red inner page banner of the Insurance Guide style (as the Claim Banner), with the
 * chess illustration placed as in Figma.
 * Loaded by banner-v2.js only for this style; its CSS is scoped to the class.
 */
export default async function decorate(block) {
  const shared = !block.classList.contains('insurance-guide-banner');
  // the shared inner page banner; not decorated twice when both styles are picked
  if (shared) block.classList.add('insurance-guide-banner');
  await Promise.all([
    shared ? decorateInsuranceGuide(block) : null,
    loadCSS(`${window.hlx.codeBasePath}/blocks/banner-v2/banner-v2-leadership.css`),
  ]);
}
