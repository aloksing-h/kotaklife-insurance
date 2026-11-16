import { decorateIcons } from '../../scripts/aem.js';
import { div } from '../../scripts/dom-helpers.js';

export default function initValuesSwiper(block) {
  decorateIcons(block);
  const ul = block.querySelector(':scope > ul');
  if (!ul) return;

  const slides = [...ul.children];
  const swiperQuery = window.matchMedia('(max-width: 899px)');
  let pagination = block.querySelector(':scope > .swiper-pagination');
  let isInitializing = false;

  const toggleSwiperClasses = (enabled) => {
    block.classList.toggle('swiper', enabled);
    ul.classList.toggle('swiper-wrapper', enabled);
    slides.forEach((li) => {
      li.classList.toggle('swiper-slide', enabled);
      if (!enabled) li.classList.remove('values-card-active');
    });
  };

  // Slide the clicked card fully into view, backwards or forwards
  const revealSlide = (swiper, index) => {
    const {
      snapGrid, slidesGrid, slidesSizesGrid, size,
    } = swiper;
    const start = slidesGrid[index];
    const end = start + slidesSizesGrid[index];
    const offset = -swiper.translate;
    let snapIndex = -1;
    if (start < offset) {
      snapIndex = snapGrid.findLastIndex((snap) => snap <= start);
    } else if (end > offset + size) {
      snapIndex = snapGrid.findIndex((snap) => snap + size >= end);
    }
    if (snapIndex >= 0) swiper.slideTo(snapIndex);
    swiper.updateActiveIndex(index);
    swiper.updateSlidesClasses();
  };

  const enableSwiper = async () => {
    if (block.swiperInstance || isInitializing) return;
    isInitializing = true;

    if (!pagination) {
      pagination = div({ class: 'swiper-pagination' });
      pagination.addEventListener('keydown', (event) => {
        if (!event.target.matches('.swiper-pagination-bullet')
          || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        const index = [...pagination.children].indexOf(event.target);
        event.target.click();
        pagination.children[index]?.focus();
      });
      block.append(pagination);
    }
    toggleSwiperClasses(true);

    try {
      const { default: createSwiper } = await import('../swiper/swiper-bundle.min.js');

      // Viewport may have grown to desktop while the bundle was loading
      if (!swiperQuery.matches) {
        toggleSwiperClasses(false);
        return;
      }

      block.swiperInstance = createSwiper(block, {
        slidesPerView: 'auto',
        spaceBetween: 8,
        normalizeSlideIndex: true,
        grabCursor: true,
        watchOverflow: true,
        watchSlidesProgress: true,
        pagination: {
          el: pagination,
          clickable: true,
          type: 'custom',
          renderCustom(swiper) {
            return swiper.snapGrid.map((snap, index) => {
              const active = index === swiper.snapIndex;
              return `<span class="swiper-pagination-bullet${active ? ' swiper-pagination-bullet-active' : ''}" tabindex="0" role="button" aria-label="Go to slide ${index + 1}"${active ? ' aria-current="true"' : ''}></span>`;
            }).join('');
          },
        },
        on: {
          click(swiper) {
            if (!Number.isInteger(swiper.clickedIndex)) return;
            slides.forEach((slide, index) => {
              slide.classList.toggle('values-card-active', index === swiper.clickedIndex);
            });
            revealSlide(swiper, swiper.clickedIndex);
            swiper.pagination.update();
          },
        },
      });
    } catch (error) {
      toggleSwiperClasses(false);
      // eslint-disable-next-line no-console
      console.error('Failed to initialize values Swiper', error);
    } finally {
      isInitializing = false;
    }
  };

  const disableSwiper = () => {
    if (block.swiperInstance) {
      block.swiperInstance.destroy(true, true);
      block.swiperInstance = null;
    }
    toggleSwiperClasses(false);
  };

  const handleMediaChange = (e) => (e.matches ? enableSwiper() : disableSwiper());

  handleMediaChange(swiperQuery);
  swiperQuery.addEventListener('change', handleMediaChange);
}
