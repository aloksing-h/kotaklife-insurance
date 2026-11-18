import { loadCSS } from '../../scripts/aem.js';
import decorateInsuranceGuide from './banner-v2-insurance-guide.js';

/*
 * Banner V2, style "Life Advisor Banner" (life-advisor-banner):
 * Figma Life advisor, Inner page banners 11291:43984 (desktop) / 11291:44012 (mobile).
 * The red inner page banner of the Insurance Guide style (as the Claim Banner), with
 * short stats between white dividers (one paragraph per stat, "Be your<br>own boss"),
 * a Join Us CTA and the rocket illustration placed as in Figma.
 * Loaded by banner-v2.js only for this style; its CSS is scoped to the class.
 */
export default async function decorate(block) {
  const shared = !block.classList.contains('insurance-guide-banner');
  // the shared inner page banner; not decorated twice when both styles are picked
  if (shared) block.classList.add('insurance-guide-banner');
  await Promise.all([
    shared ? decorateInsuranceGuide(block) : null,
    loadCSS(`${window.hlx.codeBasePath}/blocks/banner-v2/banner-v2-life-advisor.css`),
  ]);
}
