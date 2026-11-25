// import { createOptimizedPicture } from '../../scripts/aem.js';
// import { moveInstrumentation } from '../../scripts/scripts.js';

// export default function decorate(block) {
//   /* change to ul, li */
//   const ul = document.createElement('ul');
//   [...block.children].forEach((row) => {
//     const li = document.createElement('li');
//     moveInstrumentation(row, li);
//     while (row.firstElementChild) li.append(row.firstElementChild);
//     [...li.children].forEach((div) => {
//       if (div.children.length === 1 && div.querySelector('picture'))
// div.className = 'cards-card-image';
//       else div.className = 'cards-card-body';
//     });
//     ul.append(li);
//   });
//   ul.querySelectorAll('picture > img').forEach((img) => {
//     const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
//     moveInstrumentation(img, optimizedPic.querySelector('img'));
//     img.closest('picture').replaceWith(optimizedPic);
//   });
//   block.replaceChildren(ul);
// }

import { createOptimizedPicture, decorateIcons, loadCSS } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const ICON_TOKEN = /(:[a-z][a-z0-9-]*:)/;

/**
 * Turns authored `:icon-name:` tokens left as plain text into icon spans, then loads
 * all icons in the link. Icons are decorative, the link text stays the accessible name.
 * @param {Element} link The link holding the authored icon(s)
 */
function decorateLinkIcons(link) {
  const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.filter((node) => ICON_TOKEN.test(node.textContent)).forEach((node) => {
    const frag = document.createDocumentFragment();
    node.textContent.split(ICON_TOKEN).forEach((part) => {
      if (ICON_TOKEN.test(part)) {
        const span = document.createElement('span');
        span.className = `icon icon-${part.slice(1, -1)}`;
        frag.append(span);
      } else if (part) {
        frag.append(part);
      }
    });
    node.replaceWith(frag);
  });
  link.querySelectorAll('.icon').forEach((icon) => icon.setAttribute('aria-hidden', 'true'));
  decorateIcons(link);
}

/**
 * Insurance category cards: authored icons on the section CTA and on each card CTA.
 * The card CTA becomes a full-card link, so make sure its accessible name says where
 * it goes, e.g. "Know more: Savings Plans".
 * @param {Element} block The cards block element
 */
function decorateInsuranceCategoryCards(block) {
  const defaultContent = block.closest('.section')
    ?.querySelector(':scope > .default-content-wrapper');
  if (defaultContent && !defaultContent.querySelector('.insurance-header-copy')) {
    const copyEls = [...defaultContent.children].filter((el) => !el.matches('h1, h2, h3, h4, h5, h6'));
    copyEls.forEach((el) => {
      if (el.matches('p') && el.children.length === 1 && el.firstElementChild.matches('a')) {
        el.classList.add('insurance-header-cta');
      }
    });
    if (copyEls.length) {
      const copy = document.createElement('div');
      copy.className = 'insurance-header-copy';
      copy.append(...copyEls);
      defaultContent.append(copy);
    }
  }

  const sectionCta = defaultContent
    ?.querySelector('.insurance-header-cta > a, :scope > p:last-child > a:only-child');
  if (sectionCta) decorateLinkIcons(sectionCta);

  block.querySelectorAll(':scope > ul > li').forEach((li) => {
    const link = li.querySelector('.cards-card-body a[href]');
    if (!link) return;
    li.classList.add('has-link');
    decorateLinkIcons(link);
    const title = li.querySelector('.cards-card-body :is(h2, h3, h4, h5, h6)')?.textContent.trim();
    const label = link.textContent.trim();
    if (title && !label.toLowerCase().includes(title.toLowerCase())) {
      link.setAttribute('aria-label', label ? `${label}: ${title}` : title);
    }
    link.removeAttribute('title');
  });
}

/**
 * Wires up first-fold display and hide-on-footer behavior for the category sticky banner section.
 * @param {Element} block The cards block element
 */
function initCategoryStickyBanner(block) {
  const banner = block.closest('.category-sticky-banner');
  if (!banner || banner.dataset.stickyBannerInitialized) return;
  banner.dataset.stickyBannerInitialized = 'true';

  let isFooterVisible = false;

  const updateBannerVisibility = () => {
    const isPastFirstFold = window.scrollY > (window.innerHeight * 0.8);
    if (isPastFirstFold && !isFooterVisible) {
      banner.classList.remove('is-hidden');
    } else {
      banner.classList.add('is-hidden');
    }
  };

  // Initially hidden on the first fold
  banner.classList.add('is-hidden');

  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateBannerVisibility();
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  updateBannerVisibility();

  const observeFooter = (footer) => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isFooterVisible = entry.isIntersecting;
        updateBannerVisibility();
      });
    }, {
      threshold: 0,
    });

    observer.observe(footer);
  };

  const footer = document.querySelector('footer');
  if (footer) {
    observeFooter(footer);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      const delayedFooter = document.querySelector('footer');
      if (delayedFooter) observeFooter(delayedFooter);
    }, { once: true });
  }
}

/**
 * Decorates the standard AEM EDS Cards block
 * @param {Element} block The cards block element
 */
export default async function decorate(block) {
  /* Transform row structure to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);

    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) {
        div.className = 'cards-card-image';

        // Unwrap <p> wrappers created by wrapTextNodes in aem.js
        const pWrapper = div.querySelector('p');
        const picture = div.querySelector('picture');
        if (pWrapper && picture) {
          pWrapper.replaceWith(picture);
        }
      } else {
        div.className = 'cards-card-body';
      }
    });
    ul.append(li);
  });

  // Optimize pictures using AEM helper
  ul.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt || '', false, [{ width: '750' }]),
    );
  });

  block.textContent = '';
  block.append(ul);

  // Section specific enhancements for .growing-insurance-company
  const section = block.closest('.growing-insurance-company');
  if (section) {
    const isMakeDifferent = section.classList.contains('make-different');
    const rightWrapClass = isMakeDifferent ? 'make-different-right' : 'growing-insurance-right';
    // the make-different grid has a 3, 4 or 5 card layout, picked by the number of cards
    if (isMakeDifferent) {
      const count = ul.children.length;
      if (count === 3 || count === 5) block.classList.add(`make-different-cards-${count}`);
    }
    const defaultContent = section.querySelector('.default-content-wrapper');
    if (defaultContent && !defaultContent.querySelector(`.${rightWrapClass}`)) {
      const rightWrap = document.createElement('div');
      rightWrap.className = rightWrapClass;
      const pTags = defaultContent.querySelectorAll(':scope > p');
      pTags.forEach((p) => rightWrap.append(p));
      defaultContent.append(rightWrap);
    }

    // 2. Format CTA link with arrow button
    const ctaLink = section.querySelector('.default-content-wrapper a');
    if (ctaLink && !ctaLink.querySelector('.btn-arrow')) {
      ctaLink.classList.add('know-more-btn');
      ctaLink.setAttribute('aria-label', 'Know more about India\'s fastest growing insurance company');
      // const arrow = document.createElement('span');
      // arrow.className = 'btn-arrow';
      // // arrow.innerHTML = '→';
      // ctaLink.append(arrow);
    }
  }
  if (block.classList.contains('category-info-cards')) {
    await loadCSS(`${window.hlx.codeBasePath}/blocks/cards/category-info-cards.css`);
  }
  if (block.classList.contains('insurance-category-cards')) {
    decorateInsuranceCategoryCards(block);
    await loadCSS(`${window.hlx.codeBasePath}/blocks/cards/insurance-category-cards.css`);
  }
  if (block.classList.contains('product-benefit-card')) {
    loadCSS(`${window.hlx.codeBasePath}/blocks/cards/product-benefit-card.css`);
  }

  if (block.closest('.category-sticky-banner')) {
    initCategoryStickyBanner(block);
  }
}
