import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  getMetadata,
  loadSections,
  loadCSS,
  buildBlock,
  decorateBlock,
  loadBlock,
} from './aem.js';

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */

//  tablist start
function buildTabs(main) {
  function getTabLabel(section) {
    return section?.dataset?.tabLabel || null;
    // const metadataBlock = section.querySelector('.section-metadata');
    // const metadata = metadataBlock ? readBlockConfig(metadataBlock) : {};
    // return metadata['tab-label'];
  }

  for (let i = 0; i < main.children.length; i += 1) {
    const section = main.children[i];
    const tabLabel = getTabLabel(section);
    const previousSection = i > 0 ? main.children[i - 1] : null;
    const previousTabLabel = previousSection
      ? getTabLabel(previousSection)
      : null;

    if (tabLabel && !previousTabLabel) {
      // found first tab panel of a list of consecutive tab panels
      // create a tab list block if non exists as last child
      let previousBlock = previousSection?.lastElementChild;
      if (previousBlock?.matches('.section-metadata')) { previousBlock = previousBlock.previousElementSibling; }
      if (!previousBlock?.matches('.tab-list')) {
        const tabListBlock = document.createElement('div');
        tabListBlock.className = 'tab-list block';
        const newSection = document.createElement('div');
        newSection.className = 'section';
        newSection.appendChild(tabListBlock);
        section.before(newSection);
      }
    }
  }
}
//  tablist end
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

function buildBreadcrumbBlock(main) {
  if (main !== document.querySelector('main')) return;
  if (
    (window.location.pathname !== '/'
      && window.isErrorPage !== true
      && getMetadata('breadcrumbs_show').includes('true'))
    || getMetadata('breadcrumb').includes('true')
  ) {
    const sections = document.createElement('div');
    sections.append(buildBlock('breadcrumb', { elems: [] }));
    main.prepend(sections);
  }
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildFragmentBlocks(main) {
  main.querySelectorAll(':scope > div > p').forEach((paragraph) => {
    const links = paragraph.querySelectorAll('a[href]');
    if (links.length !== 1 || paragraph.querySelector('img, picture')) return;
    const [link] = links;
    if (paragraph.textContent.trim() !== link.textContent.trim()) return;
    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    const fragmentPath = url.pathname
      .replace(/^\/content\/kotaklife-eds\/in\/en(?=\/)/, '')
      .replace(/\/(?:$)/, '')
      .replace(/\.(?:plain\.html|html)$/, '');
    if (!/^\/fragments?\/.+/.test(fragmentPath)) return;
    link.href = fragmentPath;
    paragraph.replaceWith(buildBlock('fragment', { elems: [link] }));
  });
}

function buildAutoBlocks(main) {
  try {
    // TODO: add auto block, if needed
    buildFragmentBlocks(main);
    buildTabs(main);
    if (!document.querySelector('main .breadcrumb-container, main .breadcrumb')) {
      buildBreadcrumbBlock(main);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
export function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Decorates hero-banner sections: wraps the meta icon + trailing text into a
 * `.hero-badge` pill and wires up the "Get Lumpsum Return" style dropdown lists.
 * @param {Element} main The main element
 */
function decorateHeroBanner(main) {
  main.querySelectorAll('.section.hero-banner').forEach((section) => {
    const wrapper = section.querySelector(':scope > .default-content-wrapper') || section;

    // 1. Badge Pill Handling
    const metaIcon = wrapper.querySelector(':scope > p > .icon');
    if (metaIcon) {
      const p = metaIcon.closest('p');
      const badge = document.createElement('span');
      badge.className = 'hero-badge';
      while (metaIcon.nextSibling) badge.append(metaIcon.nextSibling);
      badge.prepend(metaIcon);
      p.append(badge);
    }

    // 2. Dropdown Lists Handling
    const dropdowns = [...wrapper.querySelectorAll(':scope > ul > li')]
      .filter((li) => li.querySelector(':scope > ul'));
    if (!dropdowns.length) return;

    const closeAll = (except) => {
      dropdowns.forEach((li) => {
        if (li === except) return;
        li.classList.remove('is-open');
        const trigger = li.querySelector('.hero-dropdown-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
    };

    dropdowns.forEach((li) => {
      const panel = li.querySelector(':scope > ul');
      if (!panel) return;

      li.classList.add('hero-dropdown');
      panel.classList.add('hero-dropdown-panel');

      // Find the trigger content (link or paragraph)
      const existingTriggerNode = li.querySelector(':scope > a, :scope > p');
      const triggerP = document.createElement('p');
      triggerP.className = 'hero-dropdown-trigger';
      triggerP.setAttribute('role', 'button');
      triggerP.setAttribute('tabindex', '0');
      triggerP.setAttribute('aria-expanded', 'false');

      // Preserve label text
      const labelText = existingTriggerNode
        ? existingTriggerNode.textContent.trim()
        : li.firstChild.textContent.trim();
      triggerP.textContent = labelText;

      // Add Chevron Icon Span
      const chevronIcon = document.createElement('span');
      chevronIcon.className = 'icon icon-chevron-down';
      triggerP.appendChild(chevronIcon);

      // Replace old trigger element with new interactive trigger paragraph
      if (existingTriggerNode) {
        existingTriggerNode.replaceWith(triggerP);
      } else {
        li.insertBefore(triggerP, panel);
      }

      // 3. Decorate Sub-Menu Items with Icons
      [...panel.querySelectorAll(':scope > li')].forEach((subLi, index) => {
        const link = subLi.querySelector('a');
        if (link) {
          const text = link.textContent.trim();
          const { href } = link;
          const iconName = index === 0 ? 'economic-crisis' : `economic-crisis${index}`;
          subLi.innerHTML = `<a href="${href}"><span class="icon icon-${iconName}"></span>${text}</a>`;
        }
      });

      // 4. Interaction Logic
      const toggle = () => {
        const isOpen = !li.classList.contains('is-open');
        closeAll(li);
        li.classList.toggle('is-open', isOpen);
        triggerP.setAttribute('aria-expanded', String(isOpen));
      };

      triggerP.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
      });

      triggerP.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        } else if (e.key === 'Escape') {
          closeAll();
        }
      });
    });

    // Close when clicking outside section
    document.addEventListener('click', (e) => {
      if (!section.contains(e.target)) closeAll();
    });

    // Render icon SVG graphics dynamically
    decorateIcons(section);
  });
}

function relocateMobileBookmarks(main, sidebar) {
  const grid = sidebar.closest('.blog-grid');
  if (!grid || !main.contains(grid)) return;

  const disclaimer = [...main.children].find((section) => section.matches('.section')
    && section.querySelector('.accordion.faq-v2.product-disclaimer'));
  if (!disclaimer) return;

  const bookmarks = [...sidebar.children].filter((wrapper) => !wrapper.matches('.form-wrapper')
    && !wrapper.querySelector('.form, .category-links.table-content'));
  if (!bookmarks.length) return;

  const destination = document.createElement('div');
  destination.className = 'section mobile-bookmarks';
  destination.dataset.sectionStatus = 'initialized';
  disclaimer.before(destination);

  const positions = bookmarks.map((wrapper) => {
    const placeholder = document.createComment('bookmark position');
    wrapper.before(placeholder);
    return { wrapper, placeholder };
  });
  const mobileQuery = window.matchMedia('(max-width: 899px)');
  const updateBookmarks = () => {
    positions.forEach(({ wrapper, placeholder }) => {
      if (mobileQuery.matches) destination.append(wrapper);
      else placeholder.after(wrapper);
    });
  };
  updateBookmarks();
  mobileQuery.addEventListener('change', updateBookmarks);
}

function setupStickyBlogGrid(grid, gridMain, sidebar) {
  const desktopQuery = window.matchMedia('(min-width: 900px)');
  let rafId = 0;

  const update = () => {
    rafId = 0;
    const sidebarStyle = window.getComputedStyle(sidebar);
    const isStickyEnabled = desktopQuery.matches && sidebarStyle.position === 'sticky';

    if (!isStickyEnabled) {
      grid.classList.remove('blog-grid-sticky-sync');
      grid.style.removeProperty('min-height');
      gridMain.style.removeProperty('--blog-main-sticky-top');
      return;
    }

    const stickyTop = parseFloat(sidebarStyle.top) || 96;
    const bottomGap = 32;
    const viewportH = window.innerHeight;
    const leftH = Math.ceil(gridMain.getBoundingClientRect().height);
    const rightH = Math.ceil(sidebar.getBoundingClientRect().height);

    if (!leftH || !rightH) return;

    const availableLeft = viewportH - stickyTop - bottomGap;
    const leftStickyTop = leftH <= availableLeft
      ? stickyTop
      : viewportH - bottomGap - leftH;
    const leftScrollDist = Math.max(0, stickyTop - leftStickyTop);
    const targetGridHeight = Math.max(leftH, leftScrollDist + rightH);

    gridMain.style.setProperty('--blog-main-sticky-top', `${leftStickyTop}px`);
    grid.style.minHeight = `${targetGridHeight}px`;
    grid.classList.add('blog-grid-sticky-sync');
  };

  const scheduleUpdate = () => {
    if (!rafId) {
      rafId = window.requestAnimationFrame(update);
    }
  };

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(gridMain);
    observer.observe(sidebar);
  }

  desktopQuery.addEventListener('change', scheduleUpdate);
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  window.addEventListener('load', scheduleUpdate, { once: true });
  document.fonts?.ready?.then(scheduleUpdate);
  scheduleUpdate();
}

/**
 * Groups the blog article's left-column (body/FAQ/author) and sidebar
 * (bookmark-section) sections into a shared `.blog-grid` wrapper so CSS Grid
 * can lay them out side by side. This has to happen at runtime, not at import
 * time: AEM/EDS always keeps authored sections as flat `main` children, so a
 * wrapper div authored in the source doc gets flattened away by the
 * section-splitting pipeline (and stray section breaks around it just leave
 * behind empty ghost sections).
 *
 * The left-column sections are nested in a single `.blog-grid-main` item
 * (rather than left as separate grid items) so the grid has exactly one row:
 * spanning `.bookmark-section` across several auto-placed left-column rows
 * makes browsers dump all the extra height into one of those rows, leaving a
 * large gap under its (shorter) content.
 * @param {Element} main The main element
 */
function wrapBlogGrid(main) {
  if (window.location.hostname.startsWith('author-p')) return;
  const sections = [...main.children].filter((el) => el.classList.contains('section'));
  if (!sections.some((section) => section.classList.contains('column-left-section'))
    || !sections.some((section) => section.classList.contains('bookmark-section'))) return;

  // Drop empty "ghost" sections left behind by stray section breaks
  sections.forEach((section) => {
    // if (!section.children.length) section.remove();
    if (!section.children.length && !section.hasAttribute('data-aue-resource')) section.remove();
  });

  const gridCandidates = sections.filter((section) => section.isConnected);
  const end = gridCandidates.findIndex((section) => section.classList.contains('bookmark-section'));
  if (end === -1) return;

  let start = gridCandidates.findIndex((section) => section.classList.contains('column-left-section'));
  if (start === -1) {
    start = 0;
    gridCandidates.slice(0, end).forEach((section, index) => {
      if (section.matches('.hero-banner, .blog-banner, .insu-banner-container, .breadcrumb-container')) {
        start = index + 1;
      }
    });
  }
  if (end < start) return;

  const sidebar = gridCandidates[end];

  // Adopt any orphan bookmark blocks authored in separate sections into the sidebar
  sections.slice(end + 1).forEach((section) => {
    if (section.matches('.popular-search, .visual-pulse')
      || section.querySelector('.accordion.faq-v2.product-disclaimer')) return;
    const bookmarkWrappers = [...section.children].filter((child) => (
      child.matches('.category-links:not(.table-content)')
      || child.querySelector('.category-links:not(.table-content)')
    ));
    if (bookmarkWrappers.length) {
      bookmarkWrappers.forEach((w) => sidebar.append(w));
      if (!section.children.length && !section.hasAttribute('data-aue-resource')) {
        section.remove();
      }
    }
  });

  const grid = document.createElement('div');
  grid.className = 'blog-grid';
  const gridMain = document.createElement('div');
  gridMain.className = 'blog-grid-main';

  gridCandidates[start].before(grid);
  grid.append(gridMain);
  gridCandidates.slice(start, end).forEach((section) => gridMain.append(section));
  grid.append(sidebar);
  const navWrapper = main.querySelector('.blog-navigation-wrapper');
  if (navWrapper && !gridMain.contains(navWrapper)) {
    gridMain.append(navWrapper.closest('.section') || navWrapper);
  }
  relocateMobileBookmarks(main, sidebar);
  setupStickyBlogGrid(grid, gridMain, sidebar);
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  wrapBlogGrid(main);
  decorateBlocks(main);
  decorateButtons(main);
  decorateHeroBanner(main);
}

/**
 * Uses SVG filenames as fallback alt text when the authored alt attribute is empty.
 */
function decorateSvgAltText(container) {
  container.querySelectorAll('img').forEach((img) => {
    // if (img.src.includes('svg') && img.getAttribute('alt') === '') {
    if (img.src.includes('svg') && img.getAttribute('alt') === ''
      && !img.closest('[aria-hidden="true"]')) {
      // img.alt = img.src.split('/').pop().split('.svg')[0];
      [img.alt] = img.src.split('/').pop().split('.svg');
    }
  });
}

/**
 * Re-applies the visitor's saved accessibility settings before the first paint, so pages don't
 * flash without them. The settings' styles are only loaded when a setting is on.
 */
function applySavedAccessibility() {
  try {
    const { applied } = JSON.parse(localStorage.getItem('kotak-a11y')) || {};
    const entries = Object.entries(applied || {})
      .filter(([key, value]) => /^[a-z-]+$/.test(key) && /^[a-z0-9-]+$/.test(value));
    if (!entries.length) return;
    entries.forEach(([key, value]) => document.documentElement.setAttribute(`data-a11y-${key}`, value));
    loadCSS(`${window.hlx.codeBasePath}/blocks/accessibility-button/a11y-adjustments.css`);
  } catch (e) {
    // storage unavailable: the tool applies the settings when it loads
  }
}

/**
 * Adds the accessibility tool to every page. A page that has an authored Accessibility Button
 * block keeps it (it sets the launcher icon, side and label).
 * @param {Element} main The main element
 */
async function loadAccessibilityTool(main) {
  if (main?.querySelector('.accessibility-button')) return;
  const block = buildBlock('accessibility-button', []);
  const wrapper = document.createElement('div');
  wrapper.append(block);
  document.body.append(wrapper);
  decorateBlock(block);
  await loadBlock(block);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  applySavedAccessibility();
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') doc.documentElement.setAttribute('data-keyboard-navigation', '');
  }, { capture: true });
  doc.addEventListener('pointerdown', () => {
    doc.documentElement.removeAttribute('data-keyboard-navigation');
  }, { capture: true, passive: true });
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    if (!main.querySelector('.blog-grid')) document.body.classList.add('appear');
    // if (window.location.pathname.includes(('/financial-tools-calculators/'))) {
    //   await loadSection(main.querySelector('.retirement-calculator'));
    // }
    await loadSection(main.querySelector('.section'), waitForFirstImage);
    const blogBanner = main.querySelector('.blog-grid') && main.querySelector('.insu-banner-container');
    if (blogBanner) await loadSection(blogBanner, waitForFirstImage);
    const mobileSidebar = window.matchMedia('(max-width: 899px)').matches
      && main.querySelector('.blog-grid > .bookmark-section');
    if (mobileSidebar) await loadSection(mobileSidebar);
    document.body.classList.add('appear');
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  // eslint-disable-next-line import/no-cycle
  const { initializeModalHandlers } = await import('../blocks/modal/modal.js');
  initializeModalHandlers();
  // loadHeader(doc.querySelector('header'));
  loadHeader(doc.querySelector('header')).then(() => decorateSvgAltText(doc));

  const main = doc.querySelector('main');
  await loadSections(main);
  decorateSvgAltText(doc);
  loadAccessibilityTool(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  // loadFooter(doc.querySelector('footer'));
  loadFooter(doc.querySelector('footer')).then(() => decorateSvgAltText(doc));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  // eslint-disable-next-line import/no-cycle
  // const { initializeModalHandlers } = await import('../blocks/modal/modal.js');
  // initializeModalHandlers();

  // Open links with the target=blank query parameter in a new tab.
  const processAnchor = (el) => {
    const href = el.getAttribute('href');
    if (!href) return;

    const url = new URL(href, document.baseURI);
    if (url.searchParams.get('target') !== 'blank') return;

    url.searchParams.delete('target');
    el.setAttribute('href', url.href);
    el.setAttribute('target', '_blank');
    el.relList.add('noopener', 'noreferrer');
  };

  doc.querySelectorAll('a').forEach(processAnchor);
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadAutoForm(doc) {
  const anchors = [...doc.querySelectorAll('a')];
  anchors.forEach(async (anchor) => {
    if (anchor?.href?.includes('/forms/')) {
      loadCSS(
        `${window.hlx.codeBasePath}/blocks/form/form.css`,
      );
      const form = await import(
        `${window.hlx.codeBasePath}/blocks/form/form.js`
      );

      const wrapper = document.createElement('div');
      const anchorParent = anchor.parentElement;
      wrapper.classList.add('form', 'block');
      const submit = document.createElement('a');
      // EDS-019: derive submit URL from page metadata instead of hard-coding Singapore path
      const formSubmitUrl = `${window.template}/in/en/api.json`;
      submit.href = formSubmitUrl;
      wrapper.append(anchor);
      wrapper.append(submit);
      anchorParent.replaceWith(wrapper);
      await form.default(wrapper);
    }
  });
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  await loadAutoForm(document);
  loadDelayed();
}

loadPage();
