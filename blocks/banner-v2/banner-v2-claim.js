import { loadCSS } from '../../scripts/aem.js';
import decorateInsuranceGuide from './banner-v2-insurance-guide.js';

/*
 * Banner V2, style "Claim Banner" (claim-banner):
 * Figma Claims, Inner page banners 11104:14501 (desktop) / 11104:14630 (mobile).
 * The same red inner page banner as the Insurance Guide style (its styles and the mobile
 * "Read more"), with the File a Claim CTA and the claim illustration placed as in Figma.
 * Loaded by banner-v2.js only for this style; its CSS is scoped to the class.
 */
export default async function decorate(block) {
  const shared = !block.classList.contains('insurance-guide-banner');
  // the shared inner page banner; not decorated twice when both styles are picked
  if (shared) block.classList.add('insurance-guide-banner');
  await Promise.all([
    shared ? decorateInsuranceGuide(block) : null,
    loadCSS(`${window.hlx.codeBasePath}/blocks/banner-v2/banner-v2-claim.css`),
  ]);
}
