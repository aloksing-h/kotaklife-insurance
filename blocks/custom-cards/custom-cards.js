import { createOptimizedPicture, decorateIcons } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import bannerDecorate from './looking-for.js';
import decorateInfiniteProtection from './infinite-protection.js';
import initInsightsSwiper from './insights-impact-plans.js';
import initValuesSwiper from './values-cards.js';
import initdifferenceSwiper from './difference-cards.js';
import decorateInsurancePlans from './insurance-plans.js';

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
 * The card CTA is an arrow button link, and its accessible name indicates where
 * it goes, e.g. "Know more: Savings Plans".
 * @param {Element} block The custom-cards block element
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
    const links = [...li.querySelectorAll('.custom-cards-card-body a[href]')];
    const [link, ...hoverIconLinks] = links;
    if (!link) return;
    li.classList.add('has-link');
    decorateLinkIcons(link);
    const title = li.querySelector('.custom-cards-card-body :is(h2, h3, h4, h5, h6)')?.textContent.trim();
    const label = link.textContent.trim();
    if (title && !label.toLowerCase().includes(title.toLowerCase())) {
      link.setAttribute('aria-label', label ? `${label}: ${title}` : title);
    }
    link.removeAttribute('title');

    // Extra authored links are decorative hover-icon duplicates, not separate destinations
    hoverIconLinks.forEach((hoverLink) => {
      decorateLinkIcons(hoverLink);
      hoverLink.setAttribute('aria-hidden', 'true');
      hoverLink.setAttribute('tabindex', '-1');
      hoverLink.removeAttribute('title');
    });
  });
}

/**
 * Initializes Swiper instance for mobile viewports (< 900px)
 * @param {Element} block The custom-cards block element
 */

export default async function decorate(block) {
  const differenceCardsSection = block.closest('.difference-cards');
  const valuesCardsSection = block.closest('.values-cards-hover');
  const section = block.closest('.insights-impact-plans');
  // const codeBase = window.hlx?.codeBasePath || '';

  /* Transform row structure to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);

    [...li.children].forEach((div, i) => {
      if (i === 0) {
        div.className = 'custom-cards-card-image';

        // Extract variations authored via col1_classes and apply to li
        [...div.classList].forEach((cls) => {
          if (['featured', 'horizontal', 'image-overlay'].includes(cls)) {
            li.classList.add(cls);
          }
        });

        // Process and optimize primary and secondary pictures
        const pictures = [...div.querySelectorAll('picture')];
        pictures.forEach((pic, index) => {
          const img = pic.querySelector('img');
          if (img) {
            const optimizedPic = createOptimizedPicture(img.src, img.alt || '', false, [{ width: '750' }]);
            optimizedPic.classList.add(index === 0 ? 'primary-image' : 'secondary-image');
            pic.replaceWith(optimizedPic);
          }
        });
      } else {
        div.className = 'custom-cards-card-body';
      }
    });
    ul.append(li);
  });

  block.textContent = '';
  block.append(ul);

  await bannerDecorate(block);

  if (block.closest('.infinite-protection')) {
    await decorateInfiniteProtection(block);
  }

  // Initialize Swiper after DOM setup
  if (section) {
    initInsightsSwiper(block);

    // Add aria-label to the "Know More" CTA anchor
    const ctaAnchor = section.querySelector('.default-content-wrapper:last-child a');
    if (ctaAnchor && !ctaAnchor.hasAttribute('aria-label')) {
      ctaAnchor.setAttribute('aria-label', 'Know more about Insights and Impact');
    }
  }
  if (differenceCardsSection) {
    initdifferenceSwiper(block);
  }
  if (valuesCardsSection) {
    initValuesSwiper(block);
  }

  const isInsurancePlans = block.classList.contains('insurance-plans')
    || block.closest('.custom-cards-wrapper')?.classList.contains('insurance-plans');

  if (isInsurancePlans) {
    await decorateInsurancePlans(block);
  }

  if (block.classList.contains('insurance-category-cards')) {
    decorateInsuranceCategoryCards(block);
  }

  if (block.closest('.animation-section-2')) {
    import('../../scripts/animation/bannerAnimation.js');
  }
}
