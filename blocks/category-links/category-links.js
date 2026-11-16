let categoryLinksCount = 0;

// shown on the mobile toggle of a table of contents without an authored title
const FALLBACK_TOC_TITLE = 'Table of contents';

function toId(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Ensures the heading can be linked to and returns its id.
 * @param {Element} heading
 * @returns {string}
 */
function ensureId(heading) {
  if (!heading.id) {
    const base = toId(heading.textContent) || 'section';
    let id = base;
    let i = 1;
    while (document.getElementById(id)) {
      id = `${base}-${i}`;
      i += 1;
    }
    heading.id = id;
  }
  return heading.id;
}

/**
 * Takes the authored icon image out of a cell.
 * @param {Element} [cell]
 * @returns {Element|null} the picture (or img), or null when none is authored
 */
function takeIcon(cell) {
  const image = cell?.querySelector('picture') || cell?.querySelector('img');
  if (!image) return null;
  const wrapper = image.parentElement;
  image.remove();
  if (wrapper !== cell && !wrapper.textContent.trim() && !wrapper.children.length) wrapper.remove();
  return image;
}

/**
 * Creates a decorative icon: the authored image, or the default icon of the stylesheet.
 * @param {string} className
 * @param {Element|null} image authored picture or img
 * @param {boolean} [copy] use a copy of the image, for icons repeated on every link
 * @returns {HTMLSpanElement}
 */
function createIcon(className, image, copy = false) {
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  if (!image) {
    icon.className = `blog-icon ${className}`;
    return icon;
  }
  icon.className = `category-links-custom-icon ${className}`;
  const node = copy ? image.cloneNode(true) : image;
  if (copy) {
    // only the original stays editable in Universal Editor
    [node, ...node.querySelectorAll('*')].forEach((el) => {
      [...el.attributes]
        .filter(({ name }) => name.startsWith('data-aue-') || name.startsWith('data-richtext-'))
        .forEach(({ name }) => el.removeAttribute(name));
    });
  }
  const img = node.tagName === 'IMG' ? node : node.querySelector('img');
  if (img) img.alt = '';
  icon.append(node);
  return icon;
}

/**
 * Reads the entries from the authored links, or from the h2 headings of the article.
 * In a blog layout, queries .blog-grid-main; falls back to the block's section or document.
 * @param {Element} block
 * @param {Element} [linksRow]
 * @returns {{ text: string, id: string }[]}
 */
function getEntries(block, linksRow) {
  const links = [...(linksRow?.querySelectorAll('a[href*="#"]') || [])];
  if (links.length) {
    return links.map((a) => ({
      text: a.textContent.trim(),
      id: decodeURIComponent(new URL(a.href, window.location.href).hash.slice(1)),
    })).filter(({ id }) => id);
  }
  const blogGridMain = block.closest('.blog-grid')?.querySelector('.blog-grid-main')
    || document.querySelector('.blog-grid-main');
  const root = blogGridMain || block.closest('.section') || document;
  return [...root.querySelectorAll('h2')]
    .filter((heading) => {
      if (!heading.textContent.trim()) return false;
      if (heading.closest('.category-links, .blog-article-navigation, .popular-search')) return false;
      return true;
    })
    .map((heading) => ({ text: heading.textContent.trim(), id: ensureId(heading) }));
}

let isClickScrolling = false;
let clickedHeadingId = null;
let currentActiveId = null;

function setCurrentHeading(links, id) {
  const isChanged = id !== currentActiveId;
  currentActiveId = id;
  let activeLi = null;

  links.forEach((a) => {
    const linkId = a.dataset.id || decodeURIComponent(a.hash.slice(1));
    const isActive = Boolean(id && linkId === id);
    const li = a.closest('li');

    if (isActive) {
      a.setAttribute('aria-current', 'location');
      a.classList.add('active');
      if (li) {
        li.classList.add('active');
        activeLi = li;
      }
    } else {
      a.removeAttribute('aria-current');
      a.classList.remove('active');
      if (li) li.classList.remove('active');
    }
  });

  if (isChanged && activeLi && window.matchMedia('(min-width: 900px)').matches) {
    const list = activeLi.closest('.category-links-list');
    if (list && list.scrollHeight > list.clientHeight) {
      const listRect = list.getBoundingClientRect();
      const liRect = activeLi.getBoundingClientRect();
      if (liRect.top < listRect.top) {
        list.scrollBy({ top: liRect.top - listRect.top, behavior: 'smooth' });
      } else if (liRect.bottom > listRect.bottom) {
        list.scrollBy({ top: liRect.bottom - listRect.bottom, behavior: 'smooth' });
      }
    }
  }
}

/**
 * Highlights the entry of the heading currently read.
 * Does not activate the first heading on initial load when the user is above it.
 * Updates accurately when scrolling both down and up, maintaining a single active state.
 * @param {HTMLAnchorElement[]} links
 */
function observeHeadings(links) {
  const targets = links
    .map((a) => {
      const id = a.dataset.id || decodeURIComponent(a.hash.slice(1));
      const el = document.getElementById(id);
      return el ? { id, el } : null;
    })
    .filter(Boolean);
  if (!targets.length) return;

  let ticking = false;

  const update = () => {
    ticking = false;
    if (isClickScrolling) return;

    if (clickedHeadingId) {
      const clickedEl = document.getElementById(clickedHeadingId);
      if (clickedEl) {
        const rect = clickedEl.getBoundingClientRect();
        if (rect.top >= 0 && rect.top <= window.innerHeight * 0.75) {
          setCurrentHeading(links, clickedHeadingId);
          return;
        }
      }
      clickedHeadingId = null;
    }

    // Fixed header threshold (header height + margin)
    const headerOffset = 140;
    const firstRect = targets[0].el.getBoundingClientRect();

    // If the top of the first heading is still below the header threshold,
    // the user is reading intro/banner content: do not highlight any heading.
    if (firstRect.top > headerOffset) {
      setCurrentHeading(links, null);
      return;
    }

    // If scrolled to the bottom of the article/page, highlight the last heading
    const isAtBottom = (window.innerHeight + window.scrollY)
      >= (document.documentElement.scrollHeight - 50);
    if (isAtBottom) {
      setCurrentHeading(links, targets[targets.length - 1].id);
      return;
    }

    // Find the last heading that has crossed above the header threshold
    let activeId = targets[0].id;
    for (let i = 0; i < targets.length; i += 1) {
      const rect = targets[i].el.getBoundingClientRect();
      if (rect.top <= headerOffset) {
        activeId = targets[i].id;
      } else {
        break;
      }
    }

    setCurrentHeading(links, activeId);
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  };

  const clearClickLock = () => {
    if (isClickScrolling || clickedHeadingId) {
      isClickScrolling = false;
      clickedHeadingId = null;
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  window.addEventListener('wheel', clearClickLock, { passive: true });
  window.addEventListener('touchmove', clearClickLock, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
      clearClickLock();
    }
  }, { passive: true });

  const currentHash = decodeURIComponent(window.location.hash.slice(1));
  if (currentHash && targets.some((t) => t.id === currentHash)) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  update();
}

/**
 * Category links: the authored links, each followed by an arrow.
 * @param {HTMLUListElement} list
 * @param {Element} [linksRow]
 * @param {Element|null} linkIcon
 */
function buildCategoryList(list, linksRow, linkIcon) {
  [...(linksRow?.querySelectorAll('a[href]') || [])].forEach((a, i) => {
    const li = document.createElement('li');
    a.className = 'category-links-link';
    a.removeAttribute('title');
    const text = document.createElement('span');
    text.className = 'category-links-text';
    text.append(...a.childNodes);
    a.replaceChildren(text, createIcon('category-links-chevron', linkIcon, i > 0));
    li.append(a);
    list.append(li);
  });
}

/**
 * Table of contents: numbered links to the headings of the page.
 * Smoothly scrolls to the clicked heading, updates the URL hash, and collapses the mobile drawer.
 * Immediately activates the clicked title.
 * @param {HTMLOListElement} list
 * @param {{ text: string, id: string }[]} entries
 * @param {Element} [block]
 */
function buildContentsList(list, entries, block) {
  entries.forEach((entry, i) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'category-links-link';
    a.href = `#${encodeURIComponent(entry.id)}`;
    a.dataset.id = entry.id;
    a.innerHTML = `<span class="category-links-number" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="category-links-text"></span>`;
    a.querySelector('.category-links-text').textContent = entry.text;

    a.addEventListener('click', (e) => {
      e.preventDefault();
      const allLinks = [...list.querySelectorAll('.category-links-link')];
      setCurrentHeading(allLinks, entry.id);

      isClickScrolling = true;
      clickedHeadingId = entry.id;

      if (block?.classList.contains('category-links-open')) {
        const toggle = block.querySelector('.category-links-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
        block.classList.remove('category-links-open');
      }

      const target = document.getElementById(entry.id);
      if (target) {
        const gridMain = target.closest('.blog-grid-main');
        const grid = gridMain?.parentElement;
        const stickyShift = (gridMain && grid)
          ? Math.max(0, gridMain.getBoundingClientRect().top - grid.getBoundingClientRect().top)
          : 0;
        if (stickyShift > 0) {
          const marginTop = parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
          const top = window.scrollY + target.getBoundingClientRect().top - stickyShift - marginTop;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        } else {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }

      setTimeout(() => {
        isClickScrolling = false;
      }, 2000);
    });

    li.append(a);
    list.append(li);
  });
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const [titleRow, linksRow] = block.children;
  const headingIcon = takeIcon(titleRow);
  const linkIcon = takeIcon(linksRow);
  const isContents = block.classList.contains('table-content');
  const title = titleRow?.textContent.trim() || (isContents ? FALLBACK_TOC_TITLE : '');
  const entries = isContents ? getEntries(block, linksRow) : [];

  categoryLinksCount += 1;
  const id = `category-links-${categoryLinksCount}`;

  const nav = document.createElement('nav');
  nav.className = 'category-links-nav';

  const list = document.createElement(isContents ? 'ol' : 'ul');
  list.className = 'category-links-list';

  if (title) {
    const heading = document.createElement('h2');
    heading.className = 'blog-panel-heading category-links-heading';
    heading.id = id;
    const text = document.createElement('span');
    text.className = 'category-links-heading-text';
    text.textContent = title;
    heading.append(createIcon('category-links-icon', headingIcon), text);
    nav.setAttribute('aria-labelledby', heading.id);
    nav.append(heading);

    if (isContents) {
      // mobile: the heading opens and closes the list
      list.id = `${id}-list`;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'category-links-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', list.id);
      toggle.append(text.cloneNode(true), createIcon('category-links-toggle-icon', linkIcon));
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        block.classList.toggle('category-links-open', !expanded);
      });
      heading.append(toggle);
    }
  }

  if (isContents) buildContentsList(list, entries, block);
  else buildCategoryList(list, linksRow, linkIcon);

  nav.append(list);
  block.replaceChildren(nav);

  if (isContents) {
    const wrapper = block.parentElement;
    if (wrapper?.classList.contains('category-links-wrapper')) {
      wrapper.classList.add('category-links-table-content-wrapper');
    }
    observeHeadings([...list.querySelectorAll('a')]);
  }
}
