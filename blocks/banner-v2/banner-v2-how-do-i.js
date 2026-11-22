import { loadCSS } from '../../scripts/aem.js';
import decorateInsuranceGuide from './banner-v2-insurance-guide.js';

/*
 * Banner V2, style "How Do I Banner" (how-do-i-banner):
 * Figma How do I, Inner page banners: Pay premium 1:3274 / 1:3496, Customer grievances
 * 1:3742, Download center 1:3958, Policy FAQs 1:3830, Know your Life Advisor 1:4170.
 * The red inner page banner of the Insurance Guide style (as the Claim Banner), with one
 * illustration box for every How do I page: the illustration is exported on the same
 * 1280 x 792 canvas (the banner area right of the text), so each page only swaps the image.
 * Loaded by banner-v2.js only for this style; its CSS is scoped to the class.
 */
export default async function decorate(block) {
  const shared = !block.classList.contains('insurance-guide-banner');
  // the shared inner page banner; not decorated twice when both styles are picked
  if (shared) block.classList.add('insurance-guide-banner');
  await Promise.all([
    shared ? decorateInsuranceGuide(block) : null,
    loadCSS(`${window.hlx.codeBasePath}/blocks/banner-v2/banner-v2-how-do-i.css`),
  ]);
}
