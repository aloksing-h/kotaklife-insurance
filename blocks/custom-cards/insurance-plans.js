/**
 * Decorates Custom Cards for the Insurance Plans / Term Insurance Plan section.
 * - Manages card structure (badge, title brand/plan split, hover actions, bottom CTA).
 * - Manages desktop carousel (> 4 cards) and mobile 2x2 grid layout.
 *
 * @param {Element} block The custom-cards block element
 */

import { decorateIcons } from '../../scripts/aem.js';

const PUBLISH_ORIGIN = 'https://publish-p190053-e2194583.adobeaemcloud.com';
const PREVIEW_HOSTS = ['aem.page', 'aem.live', 'localhost'];

function resolveDamUrl(href) {
  if (!href) return '';
  try {
    const url = new URL(href, window.location.href);
    if (!url.pathname.startsWith('/content/')) return href;
    const isPreview = PREVIEW_HOSTS.some((host) => window.location.hostname.includes(host));
    const domain = isPreview ? PUBLISH_ORIGIN : window.location.origin;
    return `${domain}${url.pathname}${url.search}`;
  } catch {
    return href;
  }
}

async function triggerFileDownload(url) {
  const cleanPath = url.split('?')[0].split('#')[0];
  let filename = cleanPath.split('/').pop() || 'brochure.pdf';
  if (!filename.toLowerCase().endsWith('.pdf')) {
    filename = `${filename}.pdf`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.style.display = 'none';
    tempLink.href = blobUrl;
    tempLink.download = filename;
    document.body.append(tempLink);
    tempLink.click();
    setTimeout(() => {
      tempLink.remove();
      window.URL.revokeObjectURL(blobUrl);
    }, 1000);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[insurance-plans] Direct blob download failed (likely CORS on cross-origin DAM), opening in new tab:', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function updateNavState(swiper, prevBtn, nextBtn, navWrapper) {
  if (!prevBtn || !nextBtn) return;

  if (swiper.isLocked) {
    if (navWrapper) navWrapper.classList.add('nav-hidden');
    return;
  }
  if (navWrapper) navWrapper.classList.remove('nav-hidden');

  const { isBeginning, isEnd } = swiper;
  prevBtn.disabled = isBeginning;
  prevBtn.setAttribute('aria-disabled', String(isBeginning));
  prevBtn.classList.toggle('is-disabled', isBeginning);

  nextBtn.disabled = isEnd;
  nextBtn.setAttribute('aria-disabled', String(isEnd));
  nextBtn.classList.toggle('is-disabled', isEnd);
}

function structureCard(card) {
  const body = card.querySelector('.custom-cards-card-body');
  if (!body) return;

  // 1. Identify badge: paragraph with "ONLINE" or shield icon
  const badgeP = [...body.querySelectorAll(':scope > p, p')].find((p) => {
    const text = p.textContent.trim().toUpperCase();
    return text.includes('ONLINE') || p.querySelector('.icon-shield-ellipsis, [class*="shield"]');
  });

  if (badgeP) {
    badgeP.classList.add('insurance-card-badge');
    if (!badgeP.querySelector('.icon')) {
      const shield = document.createElement('span');
      shield.className = 'icon icon-shield-ellipsis';
      badgeP.prepend(shield);
    }
  }

  // 2. Identify default and hover content lists
  const allLists = [...body.querySelectorAll(':scope > ul, ul')];
  const defaultList = allLists[0] || null;
  const hoverList = allLists.length >= 2 ? allLists[allLists.length - 1] : null;

  // 3. Format Title in default content: "Kotak" brand on line 1, plan name on line 2
  const titleEl = defaultList
    ? defaultList.firstElementChild
    : (body.querySelector('h1, h2, h3, h4, h5, h6')
      || [...body.querySelectorAll('p')].find((p) => p !== badgeP && /^kotak\s*/i.test(p.textContent.trim())));

  if (titleEl && !titleEl.querySelector('.insurance-title-brand')) {
    titleEl.classList.add('insurance-card-title');
    if (/^kotak\s*/i.test(titleEl.textContent.trim())) {
      const remaining = titleEl.innerHTML.replace(/^kotak\s*(<br\s*\/?>)?/i, '');
      titleEl.innerHTML = `<span class="insurance-title-brand">Kotak</span><span class="insurance-title-plan">${remaining}</span>`;
    }
  }

  // 4. Format Description in default content
  const descEl = (defaultList && defaultList.children.length > 1)
    ? defaultList.children[1]
    : [...body.querySelectorAll('p')].find((p) => p !== badgeP && p !== titleEl);
  if (descEl) descEl.classList.add('insurance-card-desc');

  // 5. Structure Hover Content
  if (hoverList) {
    hoverList.classList.add('insurance-card-hover-content');

    const items = [...hoverList.children];
    items.forEach((li, idx) => {
      const text = li.textContent.trim().toLowerCase();
      const saveIcon = li.querySelector('.icon-save, .icon-download, [class*="save"], [class*="download"]');
      const isSave = saveIcon || (li.querySelector('a') && (text.includes('download') || text.includes('brochure') || text.includes('save') || !text));
      const isExplore = text.includes('explore') || (li.querySelector('.icon-arrow_right, .icon-rating-arrow-right') && !text.includes('buy') && !text.includes('protect') && !text.includes('plan'));
      const isHeading = li.querySelector('h1, h2, h3, h4, h5, h6') || (idx === 0 && !li.querySelector('a') && items.length > 3);

      if (isSave) {
        li.classList.add('insurance-action-save');
        let a = li.querySelector('a');
        if (!a) {
          a = document.createElement('a');
          a.href = '#';
          while (li.firstChild) a.append(li.firstChild);
          li.append(a);
        }
        const label = a.textContent.trim() || 'Download Plan Brochure';
        a.setAttribute('aria-label', label);
        const existingIcon = a.querySelector('.icon');
        a.replaceChildren(existingIcon || Object.assign(document.createElement('span'), { className: 'icon icon-download' }));
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');

        const rawHref = a.getAttribute('href') || '';
        const resolvedHref = resolveDamUrl(rawHref);
        if (resolvedHref && resolvedHref !== rawHref) {
          a.setAttribute('href', resolvedHref);
        }

        if (a.href && !a.href.endsWith('#')) {
          a.setAttribute('download', '');
          if (!a.dataset.downloadBound) {
            a.dataset.downloadBound = 'true';
            a.addEventListener('click', (e) => {
              const currentUrl = a.href;
              if (!currentUrl || currentUrl.endsWith('#')) return;
              e.preventDefault();
              triggerFileDownload(currentUrl);
            });
          }
        }
      } else if (isExplore) {
        li.classList.add('insurance-action-explore');
        let a = li.querySelector('a');
        if (!a) {
          a = document.createElement('a');
          a.href = '#';
          while (li.firstChild) a.append(li.firstChild);
          li.append(a);
        }
        const exploreIcon = a.querySelector('.icon');
        const cleanText = a.textContent.replace(/[\u2190-\u21FF\u2794-\u27BF]|->|>/g, '').trim() || 'Explore Now';
        a.textContent = cleanText;
        a.append(exploreIcon || Object.assign(document.createElement('span'), { className: 'icon icon-arrow_right' }));
      } else if (li.querySelector('a')) {
        li.classList.add('insurance-action-primary');
        const anchors = [...li.querySelectorAll(':scope > a')];
        const pillAnchor = anchors.find((el) => el.textContent.trim()) || anchors[0];
        const redIcon = li.querySelector('.icon-right-red-filled');
        const blackIcon = li.querySelector('.icon-right-black-filled');

        pillAnchor.classList.add('insurance-btn-pill');
        if (!pillAnchor.querySelector('.insurance-btn-arrow')) {
          const label = pillAnchor.textContent.trim() || 'Buy Online';
          const defaultIcon = redIcon || Object.assign(document.createElement('span'), { className: 'icon icon-arrow-right-2' });
          defaultIcon.classList.add('insurance-arrow-default');

          const arrowWrap = document.createElement('span');
          arrowWrap.className = 'insurance-btn-arrow';
          arrowWrap.append(defaultIcon);
          if (blackIcon) {
            blackIcon.classList.add('insurance-arrow-hover');
            arrowWrap.append(blackIcon);
          }

          const textSpan = document.createElement('span');
          textSpan.className = 'insurance-btn-text';
          textSpan.textContent = label;

          pillAnchor.replaceChildren(textSpan, arrowWrap);
        }
        anchors.filter((el) => el !== pillAnchor).forEach((el) => el.remove());
      } else if (isHeading) {
        li.classList.add('insurance-hover-desc');
      } else {
        li.classList.add('insurance-bullet-item');
      }
    });

    // Group primary CTA button and save/download button into bottom actions row
    const primaryItem = hoverList.querySelector('.insurance-action-primary');
    const saveItem = hoverList.querySelector('.insurance-action-save');
    if (primaryItem && saveItem && !hoverList.querySelector('.insurance-card-bottom-actions')) {
      const actionsRow = document.createElement('div');
      actionsRow.className = 'insurance-card-bottom-actions';
      actionsRow.append(primaryItem, saveItem);
      hoverList.append(actionsRow);
    }
  }
}

export default async function decorateInsurancePlans(block) {
  const wrapper = block.closest('.custom-cards-wrapper');
  if (wrapper) wrapper.classList.add('insurance-plans');
  block.classList.add('insurance-plans');

  const section = block.closest('.section');
  const ul = block.querySelector('ul');
  if (!ul) return;

  const originalCards = [...ul.children];
  const totalCards = originalCards.length;

  // 1. Structure cards
  originalCards.forEach((card) => {
    card.classList.add('insurance-card');
    structureCard(card);
  });

  // 2. Setup Header Navigation for Desktop Carousel
  const defaultContent = section?.querySelector('.default-content-wrapper');
  let prevBtn;
  let nextBtn;
  let navWrapper;

  if (defaultContent) {
    if (!defaultContent.querySelector('.insurance-header-text')) {
      const headerText = document.createElement('div');
      headerText.className = 'insurance-header-text';
      const textEls = [...defaultContent.children].filter(
        (el) => !el.classList.contains('insurance-carousel-nav') && !el.matches('a, button'),
      );
      headerText.append(...textEls);
      defaultContent.prepend(headerText);
    }

    const navIconsP = [...defaultContent.querySelectorAll(':scope > p, .insurance-header-text > p')].find(
      (p) => p.querySelectorAll('.icon').length >= 2 && !p.textContent.trim(),
    );
    const navIcons = navIconsP ? [...navIconsP.querySelectorAll('.icon')] : [];
    navIconsP?.remove();

    navWrapper = defaultContent.querySelector('.insurance-carousel-nav');
    const authoredNavLinks = [...defaultContent.querySelectorAll('a:has(.icon), a[href*="prev"], a[href*="next"]')];
    prevBtn = authoredNavLinks.find((a) => a.getAttribute('href')?.includes('prev') || a.querySelector('[class*="left"]'))
      || defaultContent.querySelector('.insurance-nav-prev');
    nextBtn = authoredNavLinks.find((a) => a.getAttribute('href')?.includes('next') || a.querySelector('[class*="right"]'))
      || defaultContent.querySelector('.insurance-nav-next');

    if (!navWrapper) {
      navWrapper = document.createElement('div');
      navWrapper.className = 'insurance-carousel-nav';
      navWrapper.setAttribute('aria-label', 'Plan Carousel Controls');

      if (prevBtn && nextBtn) {
        prevBtn.classList.add('insurance-nav-btn', 'insurance-nav-prev');
        nextBtn.classList.add('insurance-nav-btn', 'insurance-nav-next');
        navWrapper.append(prevBtn, nextBtn);
      } else {
        prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'insurance-nav-btn insurance-nav-prev is-disabled';
        prevBtn.disabled = true;
        prevBtn.setAttribute('aria-label', 'Previous');
        prevBtn.append(navIcons[0] || Object.assign(document.createElement('span'), { className: 'icon icon-arrow-left-2' }));

        nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'insurance-nav-btn insurance-nav-next';
        nextBtn.setAttribute('aria-label', 'Next');
        nextBtn.append(navIcons[1] || Object.assign(document.createElement('span'), { className: 'icon icon-arrow-right-2' }));

        navWrapper.append(prevBtn, nextBtn);
      }

      defaultContent.classList.add('insurance-section-header');
      defaultContent.append(navWrapper);
    }

    const headerText = defaultContent.querySelector('.insurance-header-text');
    if (headerText && !headerText.querySelector('.insurance-header-copy')) {
      const copyEls = [...headerText.children].filter((el) => !el.matches('h1, h2, h3'));
      copyEls.forEach((el) => {
        if (el.matches('p') && el.children.length === 1 && el.firstElementChild.matches('a')) {
          el.classList.add('insurance-header-cta');
        }
      });
      if (copyEls.length) {
        const copy = document.createElement('div');
        copy.className = 'insurance-header-copy';
        copy.append(...copyEls);
        headerText.append(copy);
      }
    }

    if (totalCards <= 4) {
      navWrapper.classList.add('nav-hidden');
    }
  }

  decorateIcons(block);
  if (defaultContent) decorateIcons(defaultContent);

  // 3. Mobile Line Pagination indicator container
  let pagination = block.querySelector('.insurance-pagination-dots');
  if (!pagination) {
    pagination = document.createElement('div');
    pagination.className = 'insurance-pagination-dots';
    block.append(pagination);
  }

  // 4. Responsive Carousel Management (Mobile: 4 cards/page 2x2 grid,Desktop: 4 cards visible)
  let createSwiper;
  try {
    const swiperModule = await import('../swiper/swiper-bundle.min.js');
    createSwiper = swiperModule.default;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to load Swiper bundle', err);
    return;
  }

  const destroySwiper = () => {
    if (block.swiperInstance) {
      block.swiperInstance.destroy(true, true);
      block.swiperInstance = null;
    }
    block.classList.remove('swiper');
    ul.classList.remove('swiper-wrapper');
    originalCards.forEach((card) => card.classList.remove('swiper-slide'));
  };

  const setupMobileLayout = () => {
    destroySwiper();
    ul.replaceChildren();

    const isSmallMobile = window.innerWidth < 360;
    const cardsPerPage = isSmallMobile ? 2 : 4;
    const totalPages = Math.ceil(totalCards / cardsPerPage);

    for (let i = 0; i < totalCards; i += cardsPerPage) {
      const pageCards = originalCards.slice(i, i + cardsPerPage);
      const slide = document.createElement('li');
      slide.className = 'swiper-slide insurance-slide-page';
      const pageGrid = document.createElement('ul');
      pageGrid.className = 'insurance-page-grid';
      if (isSmallMobile) {
        pageGrid.classList.add('is-small-mobile');
      }
      pageCards.forEach((c) => {
        c.classList.remove('swiper-slide');
        pageGrid.append(c);
      });
      slide.append(pageGrid);
      ul.append(slide);
    }

    if (totalPages > 1) {
      block.classList.add('swiper');
      ul.classList.add('swiper-wrapper');
      pagination.style.display = 'flex';
      pagination.replaceChildren();

      block.swiperInstance = createSwiper(block, {
        slidesPerView: 1,
        spaceBetween: 16,
        speed: 400,
        pagination: {
          el: pagination,
          clickable: true,
          bulletClass: 'swiper-pagination-bullet',
          bulletActiveClass: 'swiper-pagination-bullet-active',
        },
      });
    } else {
      pagination.style.display = 'none';
      pagination.replaceChildren();
    }
  };

  const setupDesktopLayout = () => {
    destroySwiper();
    ul.replaceChildren();
    pagination.style.display = 'none';

    originalCards.forEach((c) => {
      c.classList.remove('is-hover-active');
      ul.append(c);
    });

    if (totalCards > 3) {
      block.classList.add('swiper');
      ul.classList.add('swiper-wrapper');
      originalCards.forEach((c) => c.classList.add('swiper-slide'));

      block.swiperInstance = createSwiper(block, {
        slidesPerView: 3,
        spaceBetween: 16,
        speed: 400,
        breakpoints: {
          900: {
            slidesPerView: 4,
            spaceBetween: 16,
          },
          1200: {
            slidesPerView: 4,
            spaceBetween: 20,
          },
        },
        navigation: {
          prevEl: prevBtn,
          nextEl: nextBtn,
        },
        on: {
          init(swiper) {
            updateNavState(swiper, prevBtn, nextBtn, navWrapper);
          },
          slideChange(swiper) {
            updateNavState(swiper, prevBtn, nextBtn, navWrapper);
          },
          breakpoint(swiper) {
            updateNavState(swiper, prevBtn, nextBtn, navWrapper);
          },
          resize(swiper) {
            updateNavState(swiper, prevBtn, nextBtn, navWrapper);
          },
        },
      });
      updateNavState(block.swiperInstance, prevBtn, nextBtn, navWrapper);
    } else if (navWrapper) {
      navWrapper.classList.add('nav-hidden');
    }
  };

  let currentLayout = null;

  const getLayoutType = () => {
    if (window.innerWidth >= 768) return 'desktop';
    if (window.innerWidth < 360) return 'small-mobile';
    return 'mobile';
  };

  const updateLayout = () => {
    const layout = getLayoutType();
    if (layout === currentLayout) return;
    currentLayout = layout;

    if (layout === 'desktop') {
      setupDesktopLayout();
    } else {
      setupMobileLayout();
    }
  };

  const desktopQuery = window.matchMedia('(min-width: 768px)');
  const smallMobileQuery = window.matchMedia('(max-width: 359px)');

  updateLayout();
  desktopQuery.addEventListener('change', updateLayout);
  smallMobileQuery.addEventListener('change', updateLayout);

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateLayout, 100);
  });
}
