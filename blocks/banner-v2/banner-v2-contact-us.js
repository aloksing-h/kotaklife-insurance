import { loadCSS } from '../../scripts/aem.js';

/*
 * Banner V2, style "Contact Us Banner" (contact-us-banner):
 * Figma Contact us, Inner page banners 2:1660 (desktop) / 2:1708 (mobile).
 * Loaded by banner-v2.js only for this style; its CSS is scoped to the class.
 * No extra behaviour: the description is shown in full on every screen.
 */
export default async function decorate() {
  await loadCSS(`${window.hlx.codeBasePath}/blocks/banner-v2/banner-v2-contact-us.css`);
}
