/**
 * Turns the banners of a section (an infinity-banner and offer banners) into
 * a slider with pagination dots, using the project's Swiper bundle.
 * The banners stay as they are; their wrappers become the slides (no copies,
 * so the infinity banner and the video the intro hands over to it exist once).
 */

const SLIDE_BLOCKS = ['infinity-banner', 'offer-banner'];
const AUTOPLAY_S = 5;
const SPEED_MS = 700;
const MOTION_QUERY = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * @param {Element} section
 * @param {{ autoplay?: number|null }} options seconds per slide (0 = off)
 */
export default async function initBannerSlider(section, { autoplay = null } = {}) {
  const wrappers = [...section.children].filter((el) => SLIDE_BLOCKS
    .some((name) => el.querySelector(`:scope > .${name}`)));
  if (wrappers.length < 2 || section.querySelector('.offer-banner-slider')) return;

  const slider = document.createElement('div');
  slider.className = 'offer-banner-slider swiper';
  const track = document.createElement('div');
  track.className = 'swiper-wrapper';
  slider.append(track);
  wrappers[0].before(slider);
  wrappers.forEach((wrapper) => {
    wrapper.classList.add('swiper-slide');
    track.append(wrapper);
  });

  const dots = document.createElement('div');
  dots.className = 'offer-banner-dots';
  slider.after(dots);

  const reduced = MOTION_QUERY.matches;
  const delay = (autoplay ?? AUTOPLAY_S) * 1000;
  const autoplaying = !reduced && delay > 0;
  const { default: createSwiper } = await import('../swiper/swiper-bundle.min.js');
  const swiper = createSwiper(slider, {
    slidesPerView: 1,
    speed: reduced ? 0 : SPEED_MS,
    rewind: true,
    grabCursor: true,
    // the section is hidden while the intro plays: re-measure when it shows
    observer: true,
    observeParents: true,
    autoplay: !autoplaying ? false : {
      delay,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    },
    pagination: {
      el: dots,
      clickable: true,
      bulletElement: 'button',
      bulletClass: 'offer-banner-dot',
      bulletActiveClass: 'is-active',
    },
    a11y: {
      enabled: true,
      paginationBulletMessage: 'Show banner {{index}}',
    },
  });
  swiper.autoplay?.stop();

  // autoplay only while the slider is on screen; load the other slides'
  // images once it is
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      swiper.update();
      slider.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
      if (autoplaying) swiper.autoplay?.start();
    } else {
      swiper.autoplay?.stop();
    }
  }, { threshold: 0.4 }).observe(slider);

  // scrolling back up to an intro at the top of the page plays its reverse
  // transition on the first banner: show that one first
  const toFirst = () => {
    if (!section.classList.contains('infinity-intro-host-section')) return;
    if (Math.abs(window.scrollY) < 2 && swiper.activeIndex !== 0) swiper.slideTo(0, 0);
  };
  window.addEventListener('wheel', (e) => { if (e.deltaY < 0) toFirst(); }, { passive: true });
  window.addEventListener('keydown', (e) => { if (['ArrowUp', 'PageUp'].includes(e.key)) toFirst(); });
  let touchY = null;
  window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (touchY !== null && e.touches[0].clientY - touchY > 20) toFirst();
  }, { passive: true });
}
