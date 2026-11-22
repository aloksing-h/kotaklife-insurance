import { loadCSS } from '../../scripts/aem.js';

/*
 * Banner V2, style "Search Banner" (search-banner), picked together with "Retire Calc
 * Banner" (the light inner page banner) on the search results page:
 * Figma Search page, Inner page banners 1:1996 (desktop) / 1:1932 (mobile).
 * Only the illustration, the banner height and the background position change.
 * Loaded by banner-v2.js only for this style; its CSS is scoped to the class.
 */
export default async function decorate() {
  await loadCSS(`${window.hlx.codeBasePath}/blocks/banner-v2/banner-v2-search.css`);
}
