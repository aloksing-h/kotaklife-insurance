import { getMetadata } from '../../scripts/aem.js';
// eslint-disable-next-line import/no-cycle
import { loadFragment } from '../fragment/fragment.js';
// import { dataMapKotakObj } from '../../scripts/constant.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

function setNavDropExpanded(navDrop, expanded) {
  const isExpanded = expanded === true || expanded === 'true';
  navDrop.querySelectorAll('.header-content').forEach((eachHeaderContent) => eachHeaderContent.classList.add('dsp-none'));
  navDrop.removeAttribute('aria-expanded');
  navDrop.removeAttribute('aria-busy');
  navDrop.removeAttribute('data-aria-expanded');
  navDrop.classList.toggle('active', isExpanded);
  navDrop.querySelector(':scope > button')?.setAttribute('aria-expanded', String(isExpanded));
  // const rawText = navDrop.querySelector('button').textContent;
  // const targetId = rawText
  //   .toLowerCase()
  //   .replace(/[^a-z0-9\s-]/g, '')
  //   .trim()
  //   .replace(/\s+/g, '-');
  // navDrop.querySelectorAll('.header-content').forEach((eachContent) => {
  //   if (eachContent.getAttribute('id') == navDrop.querySelector(`#${targetId}`)
  // .getAttribute('id')) {
  //     eachContent.classList.toggle('dsp-none', !isExpanded);
  //   };
  // });
}

/**
 * Locks body scroll while a nav menu is open, releases it otherwise.
 * Desktop: a menu is open when any .nav-drop is expanded (the <nav> itself
 * stays aria-expanded="true" on desktop, so it cannot be used as the signal).
 * Mobile: a menu is open when the hamburger has expanded the <nav>.
 * @param {Element} [navEl] The nav element, when not yet attached to the document
 */
function updateBodyScrollLock(navEl) {
  const nav = navEl || document.getElementById('nav');
  if (!nav) return;
  const navSections = nav.querySelector('.nav-sections');
  const menuOpen = isDesktop.matches
    ? !!navSections && !!navSections.querySelector('.nav-drop.active')
    : nav.getAttribute('aria-expanded') === 'true';
  document.body.style.overflow = menuOpen ? 'hidden' : '';
  document.body.classList.toggle('no-scroll', menuOpen);
}

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;

    const navSectionExpanded = navSections.querySelector('.nav-drop.active');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      (navSectionExpanded.querySelector(':scope > button') || navSectionExpanded).focus();
      updateBodyScrollLock();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;

    const navSectionExpanded = navSections.querySelector('.nav-drop.active');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
      updateBodyScrollLock();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

// function openOnKeydown(e) {
//   const focused = document.activeElement;
//   const isNavDrop = focused.className === 'nav-drop';
//   if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
//     e.preventDefault(); // Prevent default scroll on Space (WCAG 2.2 - 2.1.1 Keyboard)
//     const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
//     // eslint-disable-next-line no-use-before-define
//     toggleAllNavSections(focused.closest('.nav-sections'));
//     focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
//   }
// }

// function focusNavSection() {
//   document.activeElement.addEventListener('keydown', openOnKeydown);
// }

/**
 * Closes all nested .list-inner items - sets aria-expanded to false for all .list-inner elements
 * @param {Element} navSections The nav sections container
 */
function closeAllListInnerItems(navSections) {
  if (!navSections) return;
  // Set all .list-inner elements to aria-expanded="false"
  navSections.querySelectorAll('.list-inner').forEach((listInner) => {
    if (listInner.classList.contains('nav-drop')) {
      setNavDropExpanded(listInner, false);
    } else {
      listInner.setAttribute('aria-expanded', 'false');
    }
  });
}

/**
 * Resets all tabs inside a nav-drop to their initial closed state
 * @param {Element} navDrop The nav-drop element
 */
function resetTabsInNavDrop(navDrop) {
  if (!navDrop) return;

  // Find all tabs inside this nav-drop
  const tabs = navDrop.querySelectorAll('[role="tab"]');
  tabs.forEach((tab) => {
    // Reset tab state
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('aria-expanded', 'false');

    // Hide all associated panels
    const panelIds = (tab.getAttribute('aria-controls') || '').split(' ').filter(Boolean);
    panelIds.forEach((panelId) => {
      const panel = document.querySelector(`#${CSS.escape(panelId)}`);
      if (panel) {
        panel.setAttribute('hidden', '');
        panel.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
      }
    });
  });
}

/**
 * Shows the first tab inside a nav-drop (for desktop)
 * @param {Element} navDrop The nav-drop element
 */
function showFirstTabInNavDrop(navDrop) {
  if (!navDrop) return;

  // Find all tabs inside this nav-drop
  const rawText = navDrop.querySelector('button').textContent;
  const targetId = rawText
    .toLowerCase() // Convert to lowercase -> "how do i ?"
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters like "?" -> "how do i "
    .trim() // Remove leading/trailing spaces -> "how do i"
    .replace(/\s+/g, '-');

  // const tabs = navDrop.querySelectorAll('[role="tab"]');
  const tabs = navDrop.querySelectorAll(`#${targetId} [role="tab"]`);
  if (tabs.length === 0) return;

  // Reset all tabs first
  tabs.forEach((tab) => {
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('aria-expanded', 'false');

    // Hide all associated panels
    const panelIds = (tab.getAttribute('aria-controls') || '').split(' ').filter(Boolean);
    panelIds.forEach((panelId) => {
      const panel = document.querySelector(`#${CSS.escape(panelId)}`);
      if (panel) {
        panel.setAttribute('hidden', '');
        panel.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
      }
    });
  });

  // Now show the first tab
  const firstTab = tabs[0];
  firstTab.setAttribute('aria-selected', 'true');
  firstTab.setAttribute('aria-expanded', 'true');
  firstTab.setAttribute('aria-current', 'true');

  // Show the first tab's associated panels
  const panelIds = (firstTab.getAttribute('aria-controls') || '').split(' ').filter(Boolean);
  panelIds.forEach((panelId) => {
    const panel = document.querySelector(`#${CSS.escape(panelId)}`);
    if (panel) {
      panel.removeAttribute('hidden');
      panel.classList.remove('hidden');
      panel.setAttribute('aria-hidden', 'false');
    }
  });
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections.querySelectorAll(':scope > .default-content-wrapper > .list-item-1 > .nav-drop').forEach((section) => {
    setNavDropExpanded(section, expanded);
  });
  updateBodyScrollLock();
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const nextExpanded = !expanded;
  const button = nav.querySelector('.nav-hamburger button');
  // document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  // document.body.style.overflow = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', nextExpanded.toString());
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  // Lock scroll whenever a nav menu is open, on desktop and mobile
  updateBodyScrollLock(nav);

  // On mobile, when opening hamburger (expanded = false means about to open),
  // close all .list-inner items
  if (!isDesktop.matches && !expanded) {
    closeAllListInnerItems(navSections);
  }

  // Update button aria-label for screen readers (WCAG 2.2 - 1.3.1 Info and Relationships)
  button.setAttribute('aria-label', expanded ? 'Open navigation menu' : 'Close navigation menu');
  button.setAttribute('aria-pressed', expanded ? 'false' : 'true');

  // enable nav dropdown keyboard accessibility
  // if (navSections) {
  //   const navDrops = navSections.querySelectorAll('.nav-drop');
  //   if (isDesktop.matches) {
  //     navDrops.forEach((drop) => {
  //       drop.querySelector(':scope > button')?.addEventListener('focus', focusNavSection);
  //     });
  //   }
  // }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost (ONLY ON DESKTOP, not on mobile)
    if (isDesktop.matches) {
      nav.addEventListener('focusout', closeOnFocusLost);
    }
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    if (isDesktop.matches) {
      nav.removeEventListener('focusout', closeOnFocusLost);
    }
  }
}

function isFragmentPath(path) {
  if (!path) return false;
  // Check for fragment paths in any structure (e.g., /in/en/fragment/nav/*, /fragment/*, etc.)
  return path.includes('/fragment/');
}

/**
 * Adds layer classes recursively to elements
 * @param {Element} element The element to add classes to
 * @param {Object} classNameMap Class name mapping for each depth level
 * @param {Number} depth The current depth level (internal use)
 */
function addLayerClasses(element, classNameMap, depth = 1) {
  if (!element || !element.children) return;
  const className = classNameMap[depth] || `level-${depth}`;
  Array.from(element.children).forEach((child, index) => {
    child.classList.add(className);
    child.classList.add(`${className}-${index + 1}`);
    addLayerClasses(child, classNameMap, depth + 1);
  });
}

/**
 * Maps sections with tab classes to their corresponding tab panels
 * @param {Element} container The fragment container element
 */
// function mapTabSectionsToTabPanels(container) {
//   if (!container) return;

//   // Find the tabs block within the container
//   const tabsBlock = container.querySelector('.tabs.block');
//   if (!tabsBlock) return;

//   // Get all tab panels
//   const tabPanels = Array.from(tabsBlock.querySelectorAll('.tabs-panel'));
//   if (tabPanels.length === 0) return;

//   // Define mapping patterns:
//   // tab-one -> first panel, tab-two -> second panel, etc.
//   const tabClassPatterns = [
//     'tab-one', 'tab-two', 'tab-three', 'tab-four', 'tab-five',
//     'tab-six', 'tab-seven', 'tab-eight', 'tab-nine', 'tab-ten'
//   ];

//   tabClassPatterns.forEach((tabClass, index) => {
//     // Find sections with this tab class
//     const tabSections = container.querySelectorAll(`.${tabClass}.section`);

//     if (tabSections.length > 0 && tabPanels[index]) {
//       tabSections.forEach((section) => {
//         // Clone or move the section content into the corresponding tab panel
//         // We'll append the section's children to maintain the content structure
//         const wrapper = section.querySelector('.columns-wrapper, .default-content-wrapper');
//         if (wrapper) {
//           // Append the wrapper content to the tab panel
//           tabPanels[index].appendChild(wrapper.cloneNode(true));
//           // Optionally remove the original section to avoid duplication
//           section.remove();
//         }
//       });
//     }
//   });
// }

/**
 * Inject focus styling for nav-drop and list-inner elements via JavaScript
 * Uses :focus-visible to show outline ONLY on keyboard Tab, NOT on mouse clicks
 * This ensures Figma design is preserved while maintaining WCAG 2.2 accessibility
 */
function injectNavDropFocusStyles() {
  // Check if style already injected to avoid duplicates
  if (document.getElementById('nav-drop-focus-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'nav-drop-focus-styles';
  style.textContent = `
    /* WCAG 2.2: Keyboard focus outline - ONLY shows on Tab, NOT on mouse click */
    
    /* Nav-drop elements (navigation items with submenus) */
    header nav .nav-sections .nav-drop:focus-visible {
      outline: 2px solid;
      outline-offset: 2px;
    }

    /* All list-inner elements (header-top dropdowns and other interactive items) */
    header nav .list-inner:focus-visible {
      outline: 2px solid;
      outline-offset: 2px;
    }

    /* Header-top elements: Language, Call, Login dropdowns */
    .nav-header-top li.list-inner-1:focus-visible,
    .nav-header-top li.list-inner-2:focus-visible,
    .nav-header-top li.list-inner-4:focus-visible {
      outline: 2px solid;
      outline-offset: 2px;
    }

    /* WhatsApp button focus styling - keyboard only */
    .nav-header-top ul.list-item-2 li.list-inner-2 .inner-child-2 .inner-item-1:focus-visible {
      outline: 2px solid;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // Inject focus styles for all keyboard-accessible elements
  injectNavDropFocusStyles();

  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const navTheme = document.querySelector('main > .section[data-nav-theme]')?.dataset.navTheme;
  if (navTheme) nav.classList.add(`${navTheme}-nav`);

  const classes = ['header-top', 'brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  // Move white/grey color class from first section to nav
  // const firstSection = nav.children[0];
  // if (firstSection) {
  //   const colorClass = Array.from(firstSection.classList).find(
  //     (cls) => cls === 'white-nav' || cls === 'grey-nav',
  //   );
  //   if (colorClass) {
  //     nav.classList.add(colorClass);
  //     firstSection.classList.remove(colorClass);
  //   }
  // }

  if (navTheme) {
    nav.classList.remove('white-nav');

    let activeNavTheme = navTheme;
    const updateNavColor = () => {
      // const isWhite = nav.hasAttribute('data-infinity-white-nav') || window.scrollY >= 30;
      const isWhite = window.scrollY >= 30;
      nav.classList.toggle('white-nav', isWhite);
      // if (navTheme !== 'white') nav.classList.toggle(`${navTheme}-nav`, !isWhite);
      if (activeNavTheme !== 'white') nav.classList.toggle(`${activeNavTheme}-nav`, !isWhite);
    };
    window.addEventListener('scroll', updateNavColor, { passive: true });
    // nav.addEventListener('nav-theme-change', updateNavColor);
    nav.addEventListener('banner-nav-theme-change', (event) => {
      nav.classList.remove(`${activeNavTheme}-nav`);
      activeNavTheme = ['light', 'dark'].includes(event.detail?.theme) ? event.detail.theme : navTheme;
      updateNavColor();
    });
    updateNavColor();
  }
  // else if (nav.classList.contains('dark-nav')) {
  //   const updateNavColor = () => {
  //     const isScrolled = window.scrollY >= 80;
  //     nav.classList.toggle('white-nav', isScrolled);
  //     nav.classList.toggle('dark-nav', !isScrolled);
  //   };

  //   window.addEventListener('scroll', updateNavColor, { passive: true });
  //   updateNavColor();
  // }

  // Apply layer classes to topHeader
  const topHeader = nav.querySelector('.nav-header-top .default-content-wrapper');
  if (topHeader) {
    addLayerClasses(topHeader, {
      1: 'list-item',
      2: 'list-inner',
      3: 'inner-child',
      4: 'inner-item',
      5: 'item',
      6: 'item-child',
    });
    topHeader.querySelectorAll(':scope > ul.list-item-1, :scope > ul.list-item-2').forEach((headerList) => {
      [headerList, ...headerList.querySelectorAll(':scope > li.list-inner')].forEach((element) => {
        const replacement = document.createElement('div');
        Array.from(element.attributes).forEach(({ name, value }) => {
          replacement.setAttribute(name, value);
        });
        replacement.append(...element.childNodes);
        element.replaceWith(replacement);
      });
    });
    const headerButtonLabels = {
      'list-inner-1': 'Global search',
      'list-inner-2': 'Contact us by phone',
      'list-inner-4': 'Login',
    };
    Object.entries(headerButtonLabels).forEach(([itemClass, label]) => {
      const paragraph = topHeader.querySelector(`.list-item-2 > .${itemClass} > p.inner-child-1`);
      if (!paragraph) return;

      const button = document.createElement('button');
      Array.from(paragraph.attributes).forEach(({ name, value }) => {
        button.setAttribute(name, value);
      });
      button.type = 'button';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-haspopup', 'true');
      button.setAttribute('aria-label', label);
      button.append(...paragraph.childNodes);
      /*
      if (itemClass === 'list-inner-4') {
        button.querySelectorAll('span').forEach((iconSpan) => {
          iconSpan.setAttribute('aria-hidden', 'true');
        });
        button.querySelectorAll('img').forEach((image) => {
          image.setAttribute('alt', '');
        });
      }
      */
      paragraph.replaceWith(button);
    });

    topHeader.querySelectorAll('.list-item-2 > .list-inner-4 span, .list-item-2 > .list-inner-4 img').forEach((element) => {
      element.setAttribute('aria-hidden', 'true');
      if (element.tagName === 'IMG') element.setAttribute('alt', '');
    });

    topHeader.querySelectorAll('.list-item-2 > .list-inner-4 ul a[href]').forEach((link) => {
      const text = link.textContent.replace(/\s+/g, ' ').trim();
      let customerLabel = text;
      if (/group[\s-]+customer/i.test(text)) customerLabel = 'Group customer';
      if (/individual[\s-]+customer/i.test(text)) customerLabel = 'Individual customer';
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      link.setAttribute('aria-label', `${customerLabel}, opens in new tab`);
    });

    topHeader.querySelectorAll('.list-item-2 > .list-inner-2, .list-item-2 > .list-inner-4').forEach((dropdown) => {
      const button = dropdown.querySelector(':scope > button.inner-child-1');
      const options = dropdown.querySelector(':scope > ul.inner-child-2');
      if (!button || !options) return;

      const setExpanded = (expanded) => {
        button.classList.toggle('active', expanded);
        button.setAttribute('aria-expanded', String(expanded));
        options.classList.toggle('active', expanded);
      };

      button.addEventListener('click', () => {
        setExpanded(!button.classList.contains('active'));
      });

      document.addEventListener('click', (event) => {
        if (!dropdown.contains(event.target)) setExpanded(false);
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setExpanded(false);
      });
    });

    const languageLabel = topHeader.querySelector('.list-item-1 > .list-inner-1 > p.inner-child-1');
    if (languageLabel) {
      const languageButton = document.createElement('button');
      Array.from(languageLabel.attributes).forEach(({ name, value }) => {
        languageButton.setAttribute(name, value);
      });
      languageButton.type = 'button';
      languageButton.classList.add('language-selector-btn');
      languageButton.setAttribute('aria-expanded', 'false');
      // languageButton.setAttribute('aria-haspopup', 'true');
      // languageButton.setAttribute('aria-label', 'Select Language, currently English');
      languageButton.setAttribute('aria-label', `Select language, currently ${languageLabel.textContent.trim()}`);
      languageButton.append(...languageLabel.childNodes);
      languageButton.querySelectorAll('span img').forEach((image) => {
        image.closest('span').setAttribute('aria-hidden', 'true');
        image.setAttribute('alt', '');
      });
      languageLabel.replaceWith(languageButton);

      const languageSelector = languageButton.parentElement;
      // const languageOptions = languageSelector.querySelector(':scope > .inner-child-2');
      let languageOptions = languageSelector.querySelector(':scope > .inner-child-2');
      if (languageOptions?.tagName === 'UL') {
        const optionsContainer = document.createElement('div');
        Array.from(languageOptions.attributes).forEach(({ name, value }) => {
          optionsContainer.setAttribute(name, value);
        });
        optionsContainer.append(...languageOptions.childNodes);
        languageOptions.replaceWith(optionsContainer);
        languageOptions = optionsContainer;
      }
      if (languageOptions) {
        languageOptions.id ||= 'nav-language-options';
        languageOptions.setAttribute('role', 'group');
        languageOptions.setAttribute('aria-label', 'Language selection');
        languageButton.setAttribute('aria-controls', languageOptions.id);
        languageOptions.hidden = true;
        const languageCode = (text) => (/hindi|\u0939\u093f\u0902\u0926\u0940|^hi(?:-|$)/i.test(text.trim()) ? 'hi' : 'en');
        const currentLanguage = languageCode(languageButton.textContent);
        languageOptions.querySelectorAll(':scope > li').forEach((option) => {
          const optionButton = document.createElement('button');
          Array.from(option.attributes).forEach(({ name, value }) => {
            optionButton.setAttribute(name, value);
          });
          optionButton.type = 'button';
          const optionLanguage = languageCode(option.textContent);
          const languageName = optionLanguage === 'hi' ? 'Hindi' : 'English';
          const selected = optionLanguage === currentLanguage;
          optionButton.lang = optionLanguage;
          optionButton.classList.toggle('active', selected);
          optionButton.setAttribute('aria-pressed', String(selected));
          optionButton.setAttribute('aria-label', selected
            ? `${languageName}, currently selected`
            : `Change language to ${languageName}`);
          const link = option.querySelector('a[href]');
          const href = link?.href;
          option.querySelectorAll('a').forEach((anchor) => {
            anchor.replaceWith(...anchor.childNodes);
          });
          optionButton.append(...option.childNodes);
          option.replaceWith(optionButton);
          optionButton.addEventListener('click', () => {
            // const selectedText = optionButton.textContent.trim();
            const selectedText = optionButton.lang.toUpperCase();
            const walker = document.createTreeWalker(languageButton, NodeFilter.SHOW_TEXT);
            const textNodes = [];
            while (walker.nextNode()) {
              if (walker.currentNode.textContent.trim()
                && !walker.currentNode.parentElement.closest('.icon')) {
                textNodes.push(walker.currentNode);
              }
            }
            if (textNodes.length) {
              textNodes.forEach((textNode, index) => {
                textNode.textContent = index === 0 ? selectedText : '';
              });
            } else {
              languageButton.prepend(document.createTextNode(selectedText));
            }
            languageButton.setAttribute('aria-label', `Select language, currently ${languageName}`);
            languageOptions.querySelectorAll(':scope > button').forEach((languageOption) => {
              const isSelected = languageOption === optionButton;
              const name = languageOption.lang === 'hi' ? 'Hindi' : 'English';
              languageOption.classList.toggle('active', isSelected);
              languageOption.setAttribute('aria-pressed', String(isSelected));
              languageOption.setAttribute('aria-label', isSelected
                ? `${name}, currently selected`
                : `Change language to ${name}`);
            });
            languageButton.classList.remove('active');
            languageButton.setAttribute('aria-expanded', 'false');
            languageOptions.classList.remove('active');
            languageOptions.hidden = true;
            languageButton.focus();
            if (href) window.location.assign(href);
          });
        });
      }
      const setLanguageExpanded = (expanded) => {
        languageButton.classList.toggle('active', expanded);
        languageButton.setAttribute('aria-expanded', String(expanded));
        languageOptions?.classList.toggle('active', expanded);
        if (languageOptions) languageOptions.hidden = !expanded;
      };

      languageButton.addEventListener('click', () => {
        setLanguageExpanded(!languageButton.classList.contains('active'));
      });

      document.addEventListener('click', (event) => {
        if (!languageSelector.contains(event.target)) setLanguageExpanded(false);
      });

      document.addEventListener('keydown', (event) => {
        // if (event.key === 'Escape') setLanguageExpanded(false);
        if (event.key === 'Escape' && languageButton.getAttribute('aria-expanded') === 'true') {
          const focusInside = languageSelector.contains(document.activeElement);
          setLanguageExpanded(false);
          if (focusInside) languageButton.focus();
        }
      });
    }
  }

  // Apply layer classes to topHeader
  const brandNav = nav.querySelector('.nav-brand .default-content-wrapper');
  if (brandNav) {
    addLayerClasses(brandNav, {
      1: 'brand-item',
      2: 'brand-inner',
      3: 'brand-child',
    });
  }

  // Apply layer classes to topHeader
  const navSection = nav.querySelector('.nav-sections .default-content-wrapper');
  if (navSection) {
    addLayerClasses(navSection, {
      1: 'list-item',
      2: 'list-inner',
      3: 'inner-child',
      4: 'inner-item',
      5: 'item',
      6: 'item-child',
    });
    const sectionList = navSection.querySelector(':scope > ul.list-item-1');
    if (sectionList) {
      [sectionList, ...sectionList.querySelectorAll(':scope > li')].forEach((element) => {
        const replacement = document.createElement('div');
        Array.from(element.attributes).forEach(({ name, value }) => {
          replacement.setAttribute(name, value);
        });
        replacement.append(...element.childNodes);
        element.replaceWith(replacement);
      });
    }
  }

  // Apply layer classes to topHeader
  const toolsNav = nav.querySelector('.nav-tools .default-content-wrapper');
  if (toolsNav) {
    addLayerClasses(toolsNav, {
      1: 'tool-item',
      2: 'tool-inner',
      3: 'tool-child',
    });
  }

  // WCAG 2.2: Initialize all .list-inner elements with aria-expanded and role
  // const allListInner = nav.querySelectorAll('.nav-sections .list-inner');
  // allListInner.forEach((listInner) => {
  //   if (listInner.querySelector(':scope > .language-selector-btn')) return;
  //   listInner.setAttribute('aria-expanded', 'false');
  //   // Make all list-inner elements keyboard accessible
  //   if (!listInner.hasAttribute('tabindex')) {
  //     listInner.setAttribute('tabindex', '0');
  //   }
  //   // Only add role if not already present
  //   if (!listInner.hasAttribute('role')) {
  //     listInner.setAttribute('role', 'button');
  //   }
  // });

  // Handle header-top list-inner click functionality (both mobile and desktop)
  // Only target specific list-inner items: list-inner-1, list-inner-2, and list-inner-4
  const headerTopListInners = nav.querySelectorAll(
    '.nav-header-top .list-item-2 > .list-inner-2, '
    + '.nav-header-top .list-item-2 > .list-inner-4',
  );
  if (headerTopListInners.length > 0) {
    // Add click listeners to these specific list-inner items
    // headerTopListInners.forEach((listInner) => {
    //   const toggleControl = listInner
    // .querySelector(':scope > .language-selector-btn') || listInner;
    //   const handleListInnerToggle = (e) => {
    //     e.stopPropagation();
    //     // Check if the clicked item already has the active class
    //     const isAlreadyActive = listInner.classList.contains('active');
    //     // Remove active class from all these specific list-inner items
    //     headerTopListInners.forEach((item) => {
    //       item.classList.remove('active');
    //       // WCAG 2.2: Update aria-expanded for accessibility
    //       (item.querySelector(':scope > .language-selector-btn') || item)
    // .setAttribute('aria-expanded', 'false');
    //     });
    //     // If it wasn't active, add active class to clicked item (toggle behavior)
    //     if (!isAlreadyActive) {
    //       listInner.classList.add('active');
    //       // WCAG 2.2: Update aria-expanded state
    //       // toggleControl.setAttribute('aria-expanded', 'true');
    //     }
    //   };

    //   // WCAG 2.2: Set proper ARIA attributes and keyboard accessibility
    //   toggleControl.setAttribute('aria-expanded', 'false');
    //   if (toggleControl === listInner) {
    //     listInner.setAttribute('role', 'button');
    //     listInner.setAttribute('tabindex', '0');
    //   }

    //   // Mouse click
    //   toggleControl.addEventListener('click', handleListInnerToggle);

    //   // WCAG 2.2: Keyboard accessibility (Enter and Space)
    //   toggleControl.addEventListener('keydown', (e) => {
    //     if (toggleControl === listInner && (e.code === 'Enter' || e.code === 'Space')) {
    //       e.preventDefault();
    //       handleListInnerToggle(e);
    //     }
    //   });
    // });

    // Add click listener on document to remove active class when clicking outside
    // document.addEventListener('click', (e) => {
    //   // Check if click is outside all these specific header-top list-inner items
    //   const isClickInsideListInner = Array.from(headerTopListInners).some(
    //     (item) => item.contains(e.target),
    //   );
    //   if (!isClickInsideListInner) {
    //     // Remove active class from all these items
    //     headerTopListInners.forEach((item) => {
    //       item.classList.remove('active');
    //       // WCAG 2.2: Update aria-expanded state
    //       (item.querySelector(':scope > .language-selector-btn') || item)
    // .setAttribute('aria-expanded', 'false');
    //     });
    //   }
    // });

    // WCAG 2.2: Close menu when Escape key is pressed
    // document.addEventListener('keydown', (e) => {
    //   if (e.code === 'Escape') {
    //     headerTopListInners.forEach((item) => {
    //       item.classList.remove('active');
    //       (item.querySelector(':scope > .language-selector-btn') || item)
    // .setAttribute('aria-expanded', 'false');
    //     });
    //   }
    // });
  }

  // Handle WhatsApp click for list-inner-2 WhatsApp item
  const whatsappItem = nav.querySelector(
    '.nav-header-top .list-item-2 > .list-inner-2 .inner-child-2 > .inner-item-1',
  );
  if (whatsappItem) {
    const whatsappDisplayNumber = whatsappItem.querySelector('.item-1')
      ?.textContent.match(/\d[\d\s]+\d/)[0];
    const whatsappDigits = whatsappDisplayNumber.replace(/\s/g, '');
    const whatsappNumber = whatsappDigits.length === 10 ? `91${whatsappDigits}` : whatsappDigits;
    // const whatsappMessage = whatsappItem.querySelector('.item-1 strong')?.textContent.trim();
    const whatsappMessage = whatsappItem.querySelector('.item-1 strong')?.textContent
      .trim().replace(/^'([\s\S]*)'$/, '$1');
    // WCAG 2.2 Accessibility: Add proper semantic role and labels
    whatsappItem.setAttribute('role', 'button');
    whatsappItem.setAttribute('tabindex', '0');
    whatsappItem.setAttribute('aria-label', `Send WhatsApp message to ${whatsappDisplayNumber}`);
    whatsappItem.setAttribute('aria-pressed', 'false');

    const handleWhatsappClick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // const whatsappNumber = '919321003007'; // +91 country code + 9321003007
      // const message = 'Hi';

      if (isDesktop.matches) {
        // Desktop: Open web.whatsapp.com
        window.open('https://web.whatsapp.com', '_blank');
      } else {
        // Mobile: Open WhatsApp with pre-filled message
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, '_blank');
      }
    };

    // Mouse and touch events
    whatsappItem.addEventListener('click', handleWhatsappClick);

    // WCAG 2.2: Keyboard accessibility (Enter and Space)
    whatsappItem.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        handleWhatsappClick(e);
      }
    });
  }

  const navBrand = nav.querySelector('.nav-brand');
  if (navBrand) {
    navBrand.querySelectorAll('.brand-item picture').forEach((picture) => {
      if (picture.closest('a')) return;

      const homeLink = document.createElement('a');
      homeLink.className = 'brand-home-link';
      homeLink.href = 'https://dev.kotaklife.com/';
      homeLink.setAttribute('aria-label', 'Kotak Life Insurance home');
      picture.before(homeLink);
      homeLink.append(picture);
    });

    // --- Section 1: Data Indexing and Button Cleanup (from your snippet) ---

    // Set up the class prefixes for your dataMapKotakObj utility.
    // if (typeof dataMapKotakObj !== 'undefined' && dataMapKotakObj.addIndexed) {
    //   dataMapKotakObj.CLASS_PREFIXES = [
    //     'navbrand-cont',
    //     'navbrand-sec',
    //     'navbrand-sub',
    //     'navbrand-inner-net',
    //     'navbrand-list',
    //     'navbrand-list-content',
    //   ];
    //   dataMapKotakObj.addIndexed(navBrand);
    // }
    const brandLink = navBrand.querySelector('.button');
    if (brandLink) {
      brandLink.className = '';
      brandLink.closest('.button-container').className = '';
      // Ensure brand link has alt text if it's an image (WCAG 2.2 - 1.1.1 Non-text Content)
      const brandImg = brandLink.querySelector('img');
      if (brandImg && !brandImg.getAttribute('alt')) {
        brandImg.setAttribute('alt', 'Company Logo');
      }
    }
  }

  const navSections = nav.querySelector('.nav-sections');
  let leaveTimer = null; // Timer for delayed menu closing

  if (navSections) {
    // WCAG 2.2: Add proper ARIA attributes to nav-sections (4.1.2 Name, Role, Value)
    navSections.setAttribute('role', 'menubar');
    navSections.setAttribute('aria-label', 'Main navigation menu');

    // Get the last li from nav-sections once and extract its text
    // const navSectionsUl = navSections.querySelector('.default-content-wrapper > .list-item-1');
    // let categoryText = '';
    // if (navSectionsUl) {
    //   const allLis = Array.from(navSectionsUl.children);
    //   const lastLi = allLis[allLis.length - 1];
    //   if (lastLi) {
    //     categoryText = lastLi.textContent.trim();
    //     lastLi.remove();
    //   }
    // }

    // Add data indexing for nav-sections
    // if (typeof dataMapKotakObj !== 'undefined' && dataMapKotakObj.addIndexed) {
    //   dataMapKotakObj.CLASS_PREFIXES = [
    //     'nav-sec',
    //     'nav-sub',
    //     'nav-inner',
    //     'nav-list',
    //     'nav-content',
    //   ];
    //   dataMapKotakObj.addIndexed(navSections);
    // }

    const navDrops = [...navSections.querySelectorAll(
      ':scope .default-content-wrapper > .list-item-1 > .list-inner',
    )];
    await Promise.all(navDrops.map(async (navDrop) => {
      const fragmentLink = [...navDrop.querySelectorAll('a[href]')]
        .find((anchor) => isFragmentPath(anchor.getAttribute('href')));
      const link = navDrop.querySelector(':scope > a[href]');
      if (link && !fragmentLink && !navDrop.querySelector(':scope > ul')) {
        const label = link.textContent.replace(/\s+/g, ' ').trim();
        if (label && !link.hasAttribute('aria-label') && !link.hasAttribute('aria-labelledby')) {
          link.setAttribute('aria-label', label);
        }
        if (link.getAttribute('role') === 'button') link.removeAttribute('role');
        ['aria-expanded', 'aria-haspopup', 'aria-controls'].forEach((attribute) => {
          link.removeAttribute(attribute);
        });
        return;
      }

      if (navDrop.querySelector(':scope > strong')) {
        navDrop.classList.add('nav-drop');

        const label = navDrop.querySelector(':scope > strong');
        if (label) {
          const button = document.createElement('button');
          Array.from(label.attributes).forEach(({ name, value }) => {
            button.setAttribute(name, value);
          });
          button.type = 'button';
          button.setAttribute('aria-expanded', 'true');
          button.setAttribute('data-keydown-bound', 'true');
          button.append(...label.childNodes);
          label.replaceWith(button);
        }

        // WCAG 2.2: Make nav-drop focusable with default browser focus outline
        // Set tabindex="0" and role="button" so it's keyboard accessible like header-top elements
        // navDrop.setAttribute('tabindex', '0');
        // navDrop.setAttribute('role', 'button');
        // navDrop.setAttribute('aria-expanded', 'false');

        const dropButton = navDrop.querySelector(':scope > button, :scope > a');
        if (dropButton) {
          dropButton.setAttribute('aria-haspopup', 'true');
          if (!dropButton.hasAttribute('aria-expanded')) {
            dropButton.setAttribute('aria-expanded', 'false');
          }
          dropButton.setAttribute('aria-controls', `navdrop-${Math.random().toString(36).substr(2, 9)}`);
        }
        setNavDropExpanded(navDrop, false);
      }
      // Check if this nav-drop has a fragment link
      const fragmentHref = fragmentLink
        ? new URL(fragmentLink.getAttribute('href'), window.location.href).pathname
        : null;

      // Load fragment on initialization if it's a fragment path
      if (fragmentLink) {
        const fragmentContent = await loadFragment(fragmentHref);

        if (fragmentContent) {
          // Create fragment container with proper ARIA attributes
          const fragmentContainer = document.createElement('div');
          fragmentContainer.className = 'nav-fragment-container';
          fragmentContainer.setAttribute('data-fragment-path', fragmentHref);
          fragmentContainer.setAttribute('role', 'region');
          fragmentContainer.setAttribute('aria-label', 'Submenu content');

          // Add fragment content
          while (fragmentContent.firstChild) {
            fragmentContainer.appendChild(fragmentContent.firstChild);
          }

          // Replace the fragment link without depending on a surrounding list item.
          fragmentLink.replaceWith(fragmentContainer);

          // Append the content into header-content for single fragment
          // fragmentContainer.querySelector('.header-content')
          // .nextElementSibling.className.includes('tab-list-container')
          fragmentContainer.querySelectorAll('.header-content').forEach((each) => {
            const sibling = each.nextElementSibling;
            if (each.nextElementSibling?.className.includes('tab-list-container')) {
              each.append(sibling);
            }
            each.classList.add('dsp-none');
          });

          // Handle nav-redirection click logic
          const navRedirectionBlocks = fragmentContainer.querySelectorAll('.nav-redirection');
          if (navRedirectionBlocks.length > 0) {
            navRedirectionBlocks.forEach((eachChild) => {
              // Get all direct child divs (each item)
              const items = Array.from(eachChild.children);

              items.forEach((item) => {
                // Each item has 3 child divs: image, text, link
                const childDivs = Array.from(item.children);

                if (childDivs.length >= 3) {
                  // Get the divs
                  const imgDiv = childDivs[0]; // Picture div
                  const textDiv = childDivs[1]; // h3, p text div
                  const linkDiv = childDivs[2]; // Link div (contains <a>)

                  // Get the link element from last div
                  const linkk = linkDiv.querySelector('a');

                  if (linkk) {
                    linkk.innerHTML = '';
                    const href = linkk.getAttribute('href');

                    // Add suitable classes to the link
                    linkk.classList.add('nav-redirection-link');

                    // Remove the third div (linkDiv)
                    linkDiv.remove();

                    // Append first two divs INSIDE the anchor
                    linkk.appendChild(imgDiv);
                    linkk.appendChild(textDiv);

                    // Now append the anchor to the item
                    item.appendChild(linkk);

                    // Make the entire item clickable
                    item.classList.add('nav-link-wrap');
                    item.style.cursor = 'pointer';
                    item.setAttribute('role', 'button');
                    item.setAttribute('tabindex', '0');
                    item.setAttribute('aria-label', `Navigate to ${href}`);

                    // Click handler - redirect on click
                    item.addEventListener('click', (e) => {
                      e.stopPropagation(); // Prevent nav-drop toggle
                      window.location.href = href;
                    });

                    // WCAG 2.2: Keyboard accessibility (Enter and Space)
                    item.addEventListener('keydown', (e) => {
                      if (e.code === 'Enter' || e.code === 'Space') {
                        e.preventDefault();
                        window.location.href = href;
                      }
                    });
                  }
                }
              });
            });
          }

          // Handle tab list wrapper creation so that each tablist-wrapper gets category heading
          const tabListWrapper = fragmentContainer.querySelectorAll('.tablist-wrapper');
          const categoryCode = navDrop?.parentElement?.querySelector('code');
          const categoryText = categoryCode?.textContent.trim();
          if (tabListWrapper) {
            tabListWrapper.forEach((eachWrapper) => {
              const ulElement = eachWrapper.querySelector('ul');
              if (ulElement) {
                // Create wrapper div
                const tabWrapper = document.createElement('div');
                tabWrapper.className = 'tab-wrapper';

                if (categoryText) {
                  const heading = document.createElement('h4');
                  heading.textContent = categoryText;
                  tabWrapper.appendChild(heading);
                }

                // Move ul into wrapper
                tabWrapper.appendChild(ulElement);

                // Prepend wrapper into tablist-wrapper
                eachWrapper.prepend(tabWrapper);
              }
            });
          }
          const categoryItem = categoryCode?.closest('.list-inner');
          if (categoryItem && categoryItem !== navDrop) categoryItem.remove();

          // Prevent clicks inside fragment from bubbling up
          fragmentContainer.addEventListener('click', (e) => {
            e.stopPropagation();
          });

          // DESKTOP: Attach hover listeners directly to this fragment container
          // This ensures menu stays open when user moves to fragment content
          if (isDesktop.matches) {
            fragmentContainer.addEventListener('mouseenter', () => {
              clearTimeout(leaveTimer);
            });

            fragmentContainer.addEventListener('mouseleave', () => {
              leaveTimer = setTimeout(() => {
                toggleAllNavSections(navSections, false);
                updateBodyScrollLock();
              }, 300);
            });
          }
          // // Map tab sections to their corresponding tab panels
          // mapTabSectionsToTabPanels(fragmentContainer);
        } else {
          // eslint-disable-next-line no-console
          console.error(`Unable to load navigation fragment: ${fragmentHref}`, navDrop);
        }
      }
    }));

    navDrops.forEach((navDrop) => {
      const navButton = navDrop.querySelector(':scope > button');
      if (!navButton) return;

      const rawText = navButton.textContent;
      const targetId = rawText
        .toLowerCase() // Convert to lowercase -> "how do i ?"
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters like "?" -> "how do i "
        .trim() // Remove leading/trailing spaces -> "how do i"
        .replace(/\s+/g, '-');
      const sourceContent = [...navSections.querySelectorAll(
        '.nav-fragment-container .header-content',
      )].find((content) => content.id === targetId);
      if (!sourceContent) {
        // eslint-disable-next-line no-console
        console.error(`Navigation fragment content not found for: ${targetId}`, navDrop);
        return;
      }
      sourceContent.classList.remove('dsp-none');
      navDrop.appendChild(sourceContent);

      // --- Desktop Hover Logic ---
      navButton.addEventListener('mouseenter', () => {
        if (isDesktop.matches) {
          // Cancel any pending timer to close a menu
          clearTimeout(leaveTimer);
          if (navDrop.classList.contains('active')) return; // button event will work on nav-drop also

          // Close all other menus first
          toggleAllNavSections(navSections, false);

          // Open current menu
          // const navFragmentContainer = navDrop.parentElement
          // .querySelector('.nav-fragment-container');
          if (navDrop.contains(sourceContent)) {
            // const rawText = navDrop.querySelector('button').textContent; // "How do I ?"
            // const targetId = rawText
            //   .toLowerCase() // Convert to lowercase -> "how do i ?"
            //   .replace(/[^a-z0-9\s-]/g, '') // Remove special characters like "?" -> "how do i "
            //   .trim() // Remove leading/trailing spaces -> "how do i"
            //   .replace(/\s+/g, '-');
            // const clonedNode = navFragmentContainer
            // .querySelector(`#${targetId}`).cloneNode(true);
            // clonedNode.classList.remove('dsp-none');
            // navDrop.appendChild(clonedNode);

            // Hide all header-content except which matches
            // to navButton on which event has triggered
            // navDrop.querySelectorAll('.header-content').forEach((eachContent) => {
            //   if (eachContent.getAttribute('id') == navDrop
            // .querySelector(`#${targetId}`).getAttribute('id')) {
            //     eachContent.classList.remove('dsp-none');
            //   };
            // });

            // Check if tabs exist (fragment must be loaded)
            // const tabs = navDrop.querySelectorAll('[role="tab"]');
            const tabs = navDrop.querySelectorAll(`#${targetId} [role="tab"]`);
            if (tabs.length > 0) {
              // Show first tab in tab-list on desktop only if tabs exist
              showFirstTabInNavDrop(navDrop);
            }
            setNavDropExpanded(navDrop, true);
            // WCAG 2.2: Update aria-haspopup button
            const dropButton = navButton;
            if (dropButton) {
              dropButton.setAttribute('aria-expanded', 'true');
              // Add aria-busy to indicate content is loading
              dropButton.setAttribute('aria-busy', 'false');
            }
          }
          // Lock scroll only once the menu is actually expanded
          updateBodyScrollLock();
        }
      });

      // --- Desktop Mouse Leave Logic ---
      navButton.addEventListener('mouseleave', (e) => {
        if (isDesktop.matches) {
          // button event will work on nav-drop also
          if (e.relatedTarget && navDrop.contains(e.relatedTarget)) return;
          clearTimeout(leaveTimer); // button event will work on nav-drop also
          // Set a timer to close the menu after a delay
          leaveTimer = setTimeout(() => {
            setNavDropExpanded(navDrop, false);
            // WCAG 2.2: Update aria-haspopup button
            const dropButton = navButton;
            if (dropButton) {
              dropButton.setAttribute('aria-expanded', 'false');
              dropButton.setAttribute('aria-busy', 'false');
            }
            updateBodyScrollLock();
          }, 300); // 300ms delay before closing
        }
      });

      // Additionally button event will work on nav-drop also start
      navDrop.addEventListener('mouseenter', () => {
        if (isDesktop.matches) {
          navButton.dispatchEvent(new MouseEvent('mouseenter'));
        }
      });

      navDrop.addEventListener('mouseleave', (e) => {
        if (isDesktop.matches) {
          navButton.dispatchEvent(new MouseEvent('mouseleave', {
            relatedTarget: e.relatedTarget,
          }));
        }
      });
      // Additionally button event will work on nav-drop also End

      // WCAG 2.2: Desktop keyboard support (Arrow keys for navigation + Enter to open)
      navButton.addEventListener('keydown', (e) => {
        if (isDesktop.matches) {
          const allButtons = Array.from(navSections.querySelectorAll('.nav-drop > button'));
          const currentIndex = allButtons.indexOf(navButton);

          if (e.code === 'ArrowRight' && currentIndex < allButtons.length - 1) {
            e.preventDefault();
            allButtons[currentIndex + 1].focus();
            allButtons[currentIndex + 1].dispatchEvent(new MouseEvent('mouseenter'));
          } else if (e.code === 'ArrowLeft' && currentIndex > 0) {
            e.preventDefault();
            allButtons[currentIndex - 1].focus();
            allButtons[currentIndex - 1].dispatchEvent(new MouseEvent('mouseenter'));
          }
        }
      });

      // --- Mobile Click Logic ---
      navButton.addEventListener('click', (e) => {
        if (isDesktop.matches) {
          navButton.dispatchEvent(new MouseEvent('mouseenter'));
        }
        if (!isDesktop.matches) {
          // Allow tab-list interactions without toggling nav-drop
          const clickedInsideTabList = e.target.closest('[role="tab"], [role="tablist"], .tablist-wrapper');
          if (clickedInsideTabList) {
            e.stopPropagation(); // Prevent hamburger from closing
            return; // Let tab handle the interaction
          }

          // Stop propagation to prevent hamburger from closing
          e.stopPropagation();

          // Toggle nav-drop for any other click inside it
          const expanded = navDrop.classList.contains('active');
          toggleAllNavSections(navSections);
          setNavDropExpanded(navDrop, !expanded);
          // Reset tabs when opening nav-drop
          if (!expanded) {
            resetTabsInNavDrop(navDrop);
          }
          // Update aria-haspopup button
          const dropButton = navButton;
          if (dropButton) {
            dropButton.setAttribute('aria-expanded', expanded ? 'false' : 'true');
          }
          // WCAG 2.2: Announce state change to screen readers
          dropButton?.setAttribute('aria-busy', 'false');
        }
      });
    });

    navSections.querySelectorAll('.nav-fragment-container').forEach((container) => container.remove());
    navSections.querySelectorAll('.list-inner').forEach((listInner) => {
      if (!listInner.childElementCount && !listInner.textContent.trim()) listInner.remove();
    });

    // Close all menus when mouse leaves the entire nav sections area
    // navSections.addEventListener('mouseleave', () => {
    //   if (isDesktop.matches) {
    //     leaveTimer = setTimeout(() => {
    //       toggleAllNavSections(navSections, false);
    //       document.body.classList.remove('no-scroll');
    //     }, 300);
    //   }
    // });

    // Cancel timer when mouse re-enters nav sections
    navSections.addEventListener('mouseenter', () => {
      if (isDesktop.matches) {
        clearTimeout(leaveTimer);
      }
    });
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation menu" aria-pressed="false">
      <span class="nav-hamburger-icon" aria-hidden="true"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}

export async function modalHeaderBreadCrumb() {
  // Handle desktop hamburger icon click to apply desk-hamburger class to modal
  // Support both black and white desktop hamburger variants using CSS comma-separated selector
  const desktopHamburger = document.querySelector('.icon-hamburger-black-desktop, .icon-hamburger-white-desktop');
  if (desktopHamburger) {
    const hamburgLink = desktopHamburger.closest('a');
    if (hamburgLink) {
      const modal = document.querySelector('.modal.block');
      if (modal) {
        modal.classList.add('desk-hamburger');

        // Get the section inside modal
        const modalSection = modal.querySelector('.section');
        if (modalSection) {
          // IMPORTANT: Store and clear initial content to prevent visual jerk
          const initialContent = modalSection.querySelector('.default-content-wrapper');
          const storedInitialContent = initialContent ? initialContent.cloneNode(true) : null;

          // Clear the section to remove initial authored content (prevents flashing)
          modalSection.innerHTML = '';

          // Remove any existing nav-wrapper to avoid duplicate/stale data
          const existingNavWrapper = modalSection.querySelector('.nav-wrapper');
          if (existingNavWrapper) {
            existingNavWrapper.remove();
          }

          // Create nav-wrapper div
          const newNavWrapper = document.createElement('div');
          newNavWrapper.className = 'nav-wrapper';

          // Create nav-content div
          const navContent = document.createElement('div');
          navContent.className = 'nav-content';

          // Get all nav-drop items from nav-sections
          const allNavDrops = Array.from(document.querySelectorAll('.nav-drop'));

          // Skip first 4 and get last 4
          const last4NavDrops = allNavDrops.slice(3);

          const wrapper = document.createElement('div');
          wrapper.className = 'list-inner-wrapper';

          last4NavDrops.slice(0, 4).forEach((navDrop, index) => {
            const listInner = document.createElement('div');
            listInner.className = 'list-inner';
            const navDropButtonText = navDrop.querySelector('button').textContent;
            const headingTxt = document.createElement('h3');
            headingTxt.className = 'list-heading';
            headingTxt.textContent = navDropButtonText;
            const navDropContent = navDrop.querySelector('.header-content').cloneNode(true);
            navDropContent.classList.remove('dsp-none');
            listInner.append(headingTxt, navDropContent);
            const parent = index < 2 ? navContent : wrapper;
            parent.appendChild(listInner);
          });

          if (wrapper.childElementCount > 0) {
            navContent.appendChild(wrapper);
          }

          // Append nav-content to nav-wrapper
          newNavWrapper.appendChild(navContent);

          // Prepend nav-wrapper to section
          modalSection.prepend(newNavWrapper);

          // Append the stored initial content back after the nav-wrapper
          // (for "Talk To An Expert" section)
          if (storedInitialContent) {
            modalSection.appendChild(storedInitialContent);
          }

          // Now show the modal with all content in place
          // Import the helper function to show modal with proper timing
          const { setupDeskhHamburgerModal } = await import('../modal/modal.js');
          const modalHelper = setupDeskhHamburgerModal(modal);
          if (modalHelper && modalHelper.clearAndShow) {
            modalHelper.clearAndShow();
          }
        }
      }
    }
  }
}
