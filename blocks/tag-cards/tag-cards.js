import { decorateIcons, loadCSS } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Decorates the popular-cover-plans variation of tag-cards
 * @param {Element} block The tag-cards block element
 */
function decoratePopularCoverPlans(block) {
  loadCSS(`${window.hlx.codeBasePath}/blocks/tag-cards/popular-cover-plans.css`);

  const ul = block.querySelector('ul');
  const items = [...block.querySelectorAll('.tag-cards-item')];

  items.forEach((item) => {
    const tagDiv = item.querySelector('.tag-cards-tag');
    const ctaDiv = item.querySelector('.tag-cards-cta');

    if (tagDiv && !tagDiv.textContent.trim()) {
      tagDiv.classList.add('is-empty');
    }

    if (ctaDiv) {
      const link = ctaDiv.querySelector('a');
      const targetEl = link || ctaDiv.querySelector('p') || ctaDiv;

      if (link) {
        link.classList.remove('button');
        const btnContainer = link.closest('.button-container');
        if (btnContainer) btnContainer.classList.remove('button-container');
      }

      if (!targetEl.querySelector('span.icon')) {
        const rawIconText = targetEl.textContent.trim().replace(/^:|:$/g, '');
        if (rawIconText) {
          targetEl.textContent = '';
          const iconSpan = document.createElement('span');
          iconSpan.className = `icon icon-${rawIconText}`;
          targetEl.append(iconSpan);
        }
      }
    }
  });

  decorateIcons(block);

  if (!ul || items.length <= 4) return;

  const mobileQuery = window.matchMedia('(max-width: 768px)');
  let isInitializingSwiper = false;

  const disableSwiper = () => {
    if (block.swiperInstance) {
      block.swiperInstance.destroy(true, true);
      block.swiperInstance = null;
    }
    block.classList.remove('swiper');
    ul.classList.remove('swiper-wrapper');
    items.forEach((item) => item.classList.remove('swiper-slide'));
    block.querySelector(':scope > .swiper-pagination')?.remove();
  };

  const enableSwiper = async () => {
    if (block.swiperInstance || isInitializingSwiper) return;
    isInitializingSwiper = true;

    block.classList.add('swiper');
    ul.classList.add('swiper-wrapper');
    items.forEach((item) => item.classList.add('swiper-slide'));

    let pagination = block.querySelector(':scope > .swiper-pagination');
    if (!pagination) {
      pagination = document.createElement('div');
      pagination.className = 'swiper-pagination';
      block.append(pagination);
    }

    const { default: createSwiper } = await import('../swiper/swiper-bundle.min.js');
    if (!mobileQuery.matches) {
      disableSwiper();
      isInitializingSwiper = false;
      return;
    }

    block.swiperInstance = createSwiper(block, {
      slidesPerView: 2,
      slidesPerGroup: 1,
      spaceBetween: 8,
      grabCursor: true,
      observer: true,
      observeParents: true,
      grid: {
        rows: 2,
        fill: 'row',
      },
      pagination: {
        el: pagination,
        clickable: true,
      },
    });

    isInitializingSwiper = false;
  };

  const handleViewportChange = (e) => {
    if (e.matches) {
      enableSwiper();
    } else {
      disableSwiper();
    }
  };

  handleViewportChange(mobileQuery);
  mobileQuery.addEventListener('change', handleViewportChange);
}

/**
 * Decorates the generic tag-cards block
 * @param {Element} block The tag-cards block element
 */
export default function decorate(block) {
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'tag-cards-item';
    moveInstrumentation(row, li);

    while (row.firstElementChild) {
      li.append(row.firstElementChild);
    }

    const [tagDiv, bodyDiv, ctaDiv] = [...li.children];
    if (tagDiv) tagDiv.className = 'tag-cards-tag';
    if (bodyDiv) bodyDiv.className = 'tag-cards-body';
    if (ctaDiv) ctaDiv.className = 'tag-cards-cta';

    ul.append(li);
  });

  decorateIcons(ul);
  block.replaceChildren(ul);

  if (block.classList.contains('popular-cover-plans')) {
    decoratePopularCoverPlans(block);
  }
}
