const indexPromises = new Map();

function articlePath(path, origin, fallbackCategory = '') {
  try {
    const url = new URL(path, origin);
    if (url.origin !== origin) return null;
    const pathname = url.pathname.replace(/\/$/, '').replace(/\.html$/, '');
    const segments = pathname.split('/').filter(Boolean);
    if (!segments.length) return null;
    const parentCategory = segments.length >= 2 ? segments[segments.length - 2].toLowerCase() : '';
    const category = (fallbackCategory || parentCategory).trim().toLowerCase();
    const key = segments.length >= 2
      ? `/${segments.slice(-2).join('/')}`.toLowerCase()
      : pathname.toLowerCase();
    return { path: pathname, key, category };
  } catch {
    return null;
  }
}

export function getAdjacentArticles(rows, currentPath, origin, { allowUntitled = false } = {}) {
  const current = articlePath(currentPath, origin);
  if (!current || !Array.isArray(rows)) return {};
  const preferInEn = current.path.startsWith('/in/en/');
  const currentRow = rows.find((row) => {
    if (!row || typeof row.path !== 'string') return false;
    const parsed = articlePath(row.path, origin);
    return parsed && parsed.key === current.key;
  });
  const targetCategory = (currentRow?.category || current.category).trim().toLowerCase();
  const seen = new Map();
  rows.forEach((row) => {
    if (!row || typeof row.path !== 'string' || /noindex/i.test(row.robots || '')
      || (row.type && row.type.toLowerCase() !== 'blog')) return;
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    if (!allowUntitled && !title) return;
    const article = articlePath(row.path, origin, row.category);
    if (!article || article.category !== targetCategory) return;
    const existing = seen.get(article.key);
    const isBetterPrefix = existing
      && existing.path.startsWith('/in/en/') !== preferInEn
      && article.path.startsWith('/in/en/') === preferInEn;
    if (existing && !isBetterPrefix) return;
    seen.set(article.key, {
      ...article,
      title,
      modified: Number(row.lastModified) || 0,
    });
  });
  const articles = [...seen.values()].sort((first, second) => second.modified - first.modified
    || first.key.localeCompare(second.key));
  const position = articles.findIndex((article) => article.key === current.key);
  if (position === -1) return {};
  return { previous: articles[position - 1], next: articles[position + 1] };
}

async function fetchIndex(indexPath) {
  const rows = [];
  const limit = 500;
  for (let offset = 0; offset < 50000; offset += limit) {
    const url = new URL(indexPath, window.location.origin);
    url.searchParams.set('limit', limit);
    url.searchParams.set('offset', offset);
    // eslint-disable-next-line no-await-in-loop
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Blog index ${indexPath} returned ${response.status}`);
    // eslint-disable-next-line no-await-in-loop
    const json = await response.json();
    if (!Array.isArray(json.data)) throw new Error(`Invalid blog index response from ${indexPath}`);
    rows.push(...json.data);
    const hasTotal = json.total !== undefined && json.total !== null && json.total !== ''
      && Number.isFinite(Number(json.total));
    if ((hasTotal && offset + limit >= Number(json.total))
      || (!hasTotal && json.data.length < limit)) return rows;
    if (!json.data.length) throw new Error(`Incomplete blog index response from ${indexPath}`);
  }
  throw new Error(`Blog index ${indexPath} exceeded pagination limit`);
}

function getIndex(indexPath) {
  if (!indexPromises.has(indexPath)) {
    indexPromises.set(
      indexPath,
      fetchIndex(indexPath).catch((error) => {
        indexPromises.delete(indexPath);
        throw error;
      }),
    );
  }
  return indexPromises.get(indexPath);
}

function slugToTitle(path) {
  const slug = path.split('/').filter(Boolean).pop() || '';
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function resolveArticleTitle(article) {
  if (!article || article.title) return article;
  try {
    const response = await fetch(article.path);
    if (response.ok) {
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const metaTitle = doc.querySelector('meta[property="og:title"], meta[name="og:title"]')?.content?.trim();
      const docTitle = doc.querySelector('title')?.textContent?.trim();
      const heading = doc.querySelector('h1')?.textContent?.trim();
      const title = metaTitle || docTitle || heading;
      if (title) return { ...article, title };
    }
  } catch {
    // Fall back to formatted slug when page fetch fails
  }
  return { ...article, title: slugToTitle(article.path) };
}

function buildLink(article, direction) {
  const link = document.createElement(article ? 'a' : 'button');
  link.className = `blog-article-link blog-article-${direction}`;
  if (article) {
    link.href = article.path;
    link.rel = direction === 'previous' ? 'prev' : 'next';
  } else {
    link.type = 'button';
    link.disabled = true;
    link.setAttribute('aria-disabled', 'true');
  }
  const arrow = document.createElement('span');
  arrow.className = 'blog-article-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'blog-article-label';
  label.textContent = direction === 'previous' ? 'Previous' : 'Next';
  const title = document.createElement('span');
  title.className = 'blog-article-title';
  title.textContent = article?.title || '';
  const copy = document.createElement('span');
  copy.className = 'blog-article-copy';
  copy.append(label, title);
  link.append(arrow, copy);
  return link;
}

function extractManualLink(row) {
  if (!row) return null;
  const link = row.querySelector('a');
  if (link && (link.getAttribute('href') || link.href)) {
    const href = link.getAttribute('href') || link.href;
    const title = link.textContent.trim() || slugToTitle(href);
    return { path: href, title };
  }
  const text = row.textContent.trim();
  if (text && !/^(auto|none|default)$/i.test(text)) {
    return { path: text, title: slugToTitle(text) };
  }
  return null;
}

export default async function decorate(block) {
  const rows = [...block.children];
  const manualPrevious = extractManualLink(rows[0]);
  const manualNext = extractManualLink(rows[1]);

  block.classList.add('blog-article-navigation');
  block.setAttribute('role', 'navigation');
  block.setAttribute('aria-label', 'Article navigation');

  if (manualPrevious && manualNext) {
    block.replaceChildren(
      buildLink(manualPrevious, 'previous'),
      buildLink(manualNext, 'next'),
    );
    return;
  }

  block.setAttribute('aria-busy', 'true');
  block.replaceChildren(
    buildLink(manualPrevious, 'previous'),
    buildLink(manualNext, 'next'),
  );

  try {
    const { pathname, origin } = window.location;
    let autoPrevious;
    let autoNext;

    try {
      const insuranceRows = await getIndex('/query-insurance-index.json');
      ({ previous: autoPrevious, next: autoNext } = getAdjacentArticles(
        insuranceRows,
        pathname,
        origin,
      ));
    } catch (insuranceError) {
      // eslint-disable-next-line no-console
      console.warn('Unable to load /query-insurance-index.json', insuranceError);
    }

    if (!autoPrevious && !autoNext) {
      const pageRows = await getIndex('/query-index.json');
      ({ previous: autoPrevious, next: autoNext } = getAdjacentArticles(
        pageRows,
        pathname,
        origin,
        { allowUntitled: true },
      ));
    }

    const previousToUse = manualPrevious || autoPrevious;
    const nextToUse = manualNext || autoNext;

    const [resolvedPrevious, resolvedNext] = await Promise.all([
      resolveArticleTitle(previousToUse),
      resolveArticleTitle(nextToUse),
    ]);

    block.replaceChildren(
      buildLink(resolvedPrevious, 'previous'),
      buildLink(resolvedNext, 'next'),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Unable to load article navigation', error);
  } finally {
    block.removeAttribute('aria-busy');
  }
}
