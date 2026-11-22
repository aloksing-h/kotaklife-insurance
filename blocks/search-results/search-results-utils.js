/*
 * Search Results: the search logic, with no page or DOM access (so it can be unit tested,
 * see test/search-results.test.js). Used by search-results.js.
 */

export const SORTS = ['newest', 'oldest', 'relevance'];
// pages that are never results (also excluded by the index)
export const NOT_RESULTS = /(^|\/)(nav|footer)$|\/(fragments|modals|drafts)\//;

export const normalise = (value) => (value || '').replace(/\s+/g, ' ').trim();
export const fold = (value) => normalise(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

/** Fills {name} placeholders; the values are text, never HTML. */
export const format = (template, values) => template.replace(/\{(\w+)\}/g, (all, key) => (key in values ? values[key] : all));

/** "how-do-i" -> "How do I" (used when a page has no category in the index). */
export function categoryFromPath(path) {
  const parts = path.split('/').filter(Boolean);
  const start = parts[0] === 'in' && parts.length > 2 ? 2 : 0;
  const section = parts.length - start > 1 ? parts[start] : '';
  const words = section.replace(/[-_]+/g, ' ').trim();
  if (!words) return '';
  return (words[0].toUpperCase() + words.slice(1)).replace(/\bi\b/g, 'I');
}

/** Index rows -> results; drops pages that should not be found. */
export function toResults(rows) {
  return rows.map((row) => {
    const path = row.path || '';
    const modified = Number(row.lastModified);
    let time = 0;
    // the index stores seconds; milliseconds and date strings are accepted too
    if (Number.isFinite(modified) && modified > 0) {
      time = modified < 1e12 ? modified * 1000 : modified;
    }
    if (!time && row.lastModified) time = Date.parse(row.lastModified) || 0;
    const image = row.image && !/default-meta-image/.test(row.image) ? row.image : '';
    return {
      path,
      title: normalise(row.title),
      description: normalise(row.description),
      category: normalise(row.category) || categoryFromPath(path),
      image,
      time,
      robots: (row.robots || '').toLowerCase(),
    };
  }).filter((result) => result.path && result.title && !NOT_RESULTS.test(result.path)
    && !result.robots.includes('noindex'));
}

/** The searched words: letters and digits, so quotes, &, ? and the like are ignored. */
export const toTerms = (query) => [...new Set(fold(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean))];

/** Every term must be found; matches in the title count most. */
export function search(results, query) {
  const terms = toTerms(query);
  const phrase = terms.join(' ');
  if (!terms.length) return [];
  return results.map((result) => {
    const title = fold(result.title);
    const description = fold(result.description);
    const category = fold(result.category);
    const path = fold(result.path.replace(/[-/]+/g, ' '));
    let score = 0;
    const found = terms.every((term) => {
      let hit = false;
      if (title.includes(term)) { score += 10; hit = true; }
      if (description.includes(term)) { score += 3; hit = true; }
      if (category.includes(term)) { score += 2; hit = true; }
      if (path.includes(term)) { score += 1; hit = true; }
      return hit;
    });
    if (!found) return null;
    if (terms.length > 1 && title.includes(phrase)) score += 20;
    return { ...result, score };
  }).filter(Boolean);
}

export const SORTERS = {
  newest: (a, b) => b.time - a.time || b.score - a.score,
  oldest: (a, b) => a.time - b.time || b.score - a.score,
  relevance: (a, b) => b.score - a.score || b.time - a.time,
};

export function parseSortOptions(value) {
  const options = (value || '').split(',').map((pair) => {
    const [label, key] = pair.split('=').map((part) => part.trim());
    return { label, value: (key || '').toLowerCase() };
  }).filter((option) => option.label && SORTS.includes(option.value));
  return options.length ? options : [{ label: 'Newest', value: 'newest' }];
}
