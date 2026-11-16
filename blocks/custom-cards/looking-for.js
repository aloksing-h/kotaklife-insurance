import { decorateIcons } from '../../scripts/aem.js';
import { div } from '../../scripts/dom-helpers.js';

async function initBannerSwiper(block) {
  const ul = block.querySelector('ul');
  if (!ul || block.swiperInstance) return;

  const { default: createSwiper } = await import('../swiper/swiper-bundle.min.js');

  let pagination = block.querySelector('.swiper-pagination');
  if (!pagination) {
    pagination = document.createElement('div');
    pagination.className = 'swiper-pagination custom-cards-pagination';
    block.append(pagination);
  }

  block.classList.add('swiper');
  ul.classList.add('swiper-wrapper');
  [...ul.children].forEach((li) => li.classList.add('swiper-slide'));

  block.swiperInstance = createSwiper(block, {
    slidesPerView: 1,
    spaceBetween: 0,
    grabCursor: true,
    slidesOffsetAfter: 10, // Applied to mobile screens by default
    centeredSlides: true,
    centeredSlidesBounds: true,
    slideToClickedSlide: true,
    pagination: {
      el: pagination,
      clickable: true,
    },
    breakpoints: {
      // When window width is >= 900px (matches your desktop CSS media query)
      900: {
        slidesOffsetAfter: 0, // Resets the offset for desktop
      },
    },
  });
}
/**
 * Decorates the custom-cards block for AEM Edge Delivery Services
 * @param {Element} block The custom-cards block element
 */
export default async function decorate(block) {
  const section = block.closest('.looking-for, .best-seller-banner');
  const wrapper = block.closest('.custom-cards-wrapper');

  if (!section || !wrapper) return;

  // Home page "Looking For" banner: inferred from sitting right after a Search block.
  const isLegacyBannerWrapper = wrapper.previousElementSibling?.classList.contains('search-wrapper');
  if (isLegacyBannerWrapper) {
    wrapper.classList.add('looking-banner');
  }

  // Explicit opt-in via the "Best Seller Banner" section style, independent of sibling order.
  if (section.classList.contains('best-seller-banner')) {
    wrapper.classList.add('best-seller-banner-card');
  }

  const isBanner = wrapper.classList.contains('looking-banner') || wrapper.classList.contains('best-seller-banner-card');
  if (!isBanner) {
    const mobile = window.matchMedia('(width < 900px)');
    block.querySelectorAll(':scope > ul > li').forEach((card) => {
      const link = card.querySelector('.custom-cards-card-body a[href]:has(.icon-red-arrow-up-right)');
      if (!link) return;
      const heading = card.querySelector('.custom-cards-card-body :is(h2, h3, h4, h5, h6)');
      if (!link.textContent.trim() && !link.hasAttribute('aria-label') && heading) {
        link.setAttribute('aria-label', heading.textContent.trim());
      }
      card.addEventListener('click', (event) => {
        if (!mobile.matches || event.defaultPrevented
          || event.target.closest('a, button, input, select, textarea, label')) return;
        link.click();
      });
    });
    return;
  }

  const cardItems = block.querySelectorAll('ul > li');

  cardItems.forEach((cardLi) => {
    const cardBody = cardLi.querySelector('.custom-cards-card-body');
    const cardImage = cardLi.querySelector('.custom-cards-card-image');

    if (!cardBody || !cardImage || cardBody.querySelector('.banner-cta-group')) return;

    // Wrap CTA link and disclaimer for each banner card.
    const ctaParagraph = cardBody.querySelector('p:has(a)');
    const disclaimerParagraph = cardBody.querySelector('p:nth-child(3)');

    if (ctaParagraph && disclaimerParagraph) {
      const ctaGroup = div({ class: 'banner-cta-group' }, ctaParagraph, disclaimerParagraph);
      cardBody.appendChild(ctaGroup);
    }
  });

  decorateIcons(block);

  await initBannerSwiper(block);
}
