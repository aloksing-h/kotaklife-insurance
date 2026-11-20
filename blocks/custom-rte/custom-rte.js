import { moveInstrumentation } from '../../scripts/scripts.js';
import { loadCSS } from '../../scripts/aem.js';
import {
  button,
  div,
  h2,
  input,
  li,
  ul,
  img,
  h3,
  p,
} from '../../scripts/dom-helpers.js';
// import Swiper from '../swiper/swiper-bundle.min.js';

const SLIDE_DURATION = 3000; // 3 seconds per card

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
 * Updates 3D card stack layer classes, color states, and step line position
 * @param {Array<Element>} cards List of card elements
 * @param {Array<Element>} steps List of step button elements
 * @param {Element} trackWrapper Progress track line element
 * @param {number} activeIndex Currently selected card index
 * @param {Function} onAutoAdvance Callback for timer completion
 */
function updateCardStack(cards, steps, trackWrapper, activeIndex) {
  const total = cards.length;

  // 1. Update card stack layers and trigger background color transitions
  cards.forEach((card, i) => {
    card.style.transform = '';
    card.style.transition = '';
    card.style.width = '';
    card.style.height = '';
    card.style.opacity = '';
    card.style.zIndex = '';
    card.classList.remove('is-active', 'stack-layer-1', 'stack-layer-2', 'stack-hidden');

    const offset = (i - activeIndex + total) % total;

    if (offset === 0) {
      card.classList.add('is-active'); // Red Gradient
    } else if (offset === 1) {
      card.classList.add('stack-layer-1'); // Dark Navy
    } else if (offset === 2) {
      card.classList.add('stack-layer-2'); // Dark Burgundy
    } else {
      card.classList.add('stack-hidden');
    }
  });

  // 2. Update step active state and move progress track line
  steps.forEach((step, i) => {
    const isActive = i === activeIndex;
    step.classList.toggle('is-active', isActive);

    if (isActive && trackWrapper) {
      // Position the progress track immediately after the active step button
      step.after(trackWrapper);
    }
  });
}

/**
 * Resolves authored background URL: unescapes HTML entities, strips external host to avoid 401,
 * and ensures modern responsive optimization.
 * @param {string} rawUrl
 * @param {string} defaultWidth
 * @returns {string}
 */
function resolveBgUrl(rawUrl, defaultWidth = '750') {
  if (!rawUrl) return '';
  let url = rawUrl.replace(/^url\(["']?|["']?\)$/gi, '').trim();
  if (url.includes('&amp;')) {
    url = url.replace(/&amp;/g, '&');
  }
  // Strip domain to use relative path so localhost:3000 / aem.page proxy loads without 401
  url = url.replace(/^https?:\/\/(?:dev\.)?kotaklife\.com/i, '');
  if (defaultWidth && url.includes('width=')) {
    url = url.replace(/width=\d+/i, `width=${defaultWidth}`);
  }
  return url;
}

/**
 * Sets up styles and header elements on the calculator section
 * @param {Element} calcSection The calculator section element
 */
function setupCalculatorHeader(calcSection) {
  if (!calcSection || !document.querySelector('.get-cover-plans')) return;

  if (!calcSection.id) {
    calcSection.id = 'calculater-premium';
  }

  const rawDesktop = calcSection.dataset.backgroundImage
    || calcSection.dataset.background
    || calcSection.getAttribute('data-background-image')
    || calcSection.getAttribute('data-background')
    || './media_1556455376a63bb56ecae55b88f6975c817d44dae.png?width=2000&format=webply&optimize=medium';

  const rawMobile = calcSection.dataset.backgroundimageMobile
    || calcSection.dataset.backgroundImageMobile
    || calcSection.dataset.backgroundMobile
    || calcSection.getAttribute('data-backgroundimage-mobile')
    || calcSection.getAttribute('data-background-image-mobile')
    || calcSection.getAttribute('data-background-mobile')
    || './media_11a2111b7c1d70433840db0340613c3f0f3712df4.png?width=750&format=png&optimize=medium';

  const desktopBg = resolveBgUrl(rawDesktop, '2000');
  const mobileBg = resolveBgUrl(rawMobile, '750');

  if (desktopBg) {
    calcSection.style.setProperty('--section-bg-desktop', `url('${desktopBg}')`);
  }
  if (mobileBg) {
    calcSection.style.setProperty('--section-bg-mobile', `url('${mobileBg}')`);
  }

  let closeBtn = calcSection.querySelector('.calc-close-btn');
  if (!closeBtn) {
    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'calc-close-btn';
    closeBtn.setAttribute('aria-label', 'Close calculator');

    const closeImg = document.createElement('img');
    closeImg.src = '/icons/modal-close.svg';
    closeImg.alt = 'Close';
    closeImg.width = 14;
    closeImg.height = 14;
    closeBtn.append(closeImg);

    const defaultContent = calcSection.querySelector('.default-content-wrapper');
    if (defaultContent) {
      defaultContent.append(closeBtn);
    } else {
      calcSection.prepend(closeBtn);
    }
  }

  const title = calcSection.querySelector('.default-content-wrapper h2, .default-content-wrapper h3');
  if (title && !title.querySelector('strong') && title.textContent.includes('Retirement Plan')) {
    title.innerHTML = title.innerHTML.replace('Retirement Plan', '<strong>Retirement Plan</strong>');
  }
}

/**
 * Opens retirement calculator and hides get-cover-plans section
 */
function openRetirementCalculator() {
  const getCoverSection = document.querySelector('.get-cover-plans');
  if (!getCoverSection) return;

  const calcSection = document.getElementById('calculater-premium')
    || document.querySelector('.calculator-main.retirement-calculator');

  getCoverSection.classList.add('dsp-none');

  if (calcSection) {
    calcSection.classList.remove('dsp-none');
    setupCalculatorHeader(calcSection);
    window.dispatchEvent(new Event('resize'));
    calcSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Closes retirement calculator and restores get-cover-plans section
 */
function closeRetirementCalculator() {
  const getCoverSection = document.querySelector('.get-cover-plans');
  if (!getCoverSection) return;

  const calcSection = document.getElementById('calculater-premium')
    || document.querySelector('.calculator-main.retirement-calculator');

  if (calcSection) {
    calcSection.classList.add('dsp-none');
  }

  getCoverSection.classList.remove('dsp-none');
  getCoverSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Global delegated capture listeners for CTA button and Close button
if (!window.hasCalculatorToggleListeners) {
  window.hasCalculatorToggleListeners = true;

  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.calc-close-btn');
    if (closeBtn) {
      e.preventDefault();
      e.stopPropagation();
      closeRetirementCalculator();
      return;
    }

    const cta = e.target.closest('.get-cover-cta, .get-cover-plans a[href*="calculater-premium"]');
    if (cta) {
      e.preventDefault();
      e.stopPropagation();
      openRetirementCalculator();
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!document.querySelector('.get-cover-plans')) return;
      const calcSection = document.getElementById('calculater-premium')
        || document.querySelector('.calculator-main.retirement-calculator');
      if (calcSection && !calcSection.classList.contains('dsp-none')) {
        closeRetirementCalculator();
      }
    }
  });

  // Automatically read and apply background URLs from DOM as soon as available
  const initCalculatorBg = () => {
    if (!document.querySelector('.get-cover-plans')) return;
    const calcSection = document.getElementById('calculater-premium')
      || document.querySelector('.calculator-main.retirement-calculator');
    if (calcSection) {
      setupCalculatorHeader(calcSection);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalculatorBg);
  } else {
    initCalculatorBg();
  }
}

/**
 * Decorates custom-rte block in get-cover-plans section
 * @param {Element} block The custom-rte block element
 */
export default async function decorate(block) {
  if (block.classList.contains('promotion')) {
    const section = block.closest('.get-cover-plans');

    // Decorate CTA Button in default-content-wrapper & setup calculator toggle
    if (section) {
      const ctaLink = section.querySelector('.default-content-wrapper a');
      if (ctaLink) {
        ctaLink.classList.add('get-cover-cta');
        if (!ctaLink.querySelector('.btn-arrow')) {
          const arrowSpan = document.createElement('span');
          arrowSpan.className = 'btn-arrow';
          ctaLink.append(arrowSpan);
        }
      }

      const calcSection = document.getElementById('calculater-premium')
        || document.querySelector('.calculator-main.retirement-calculator');
      if (calcSection) {
        setupCalculatorHeader(calcSection);
        if (!section.classList.contains('dsp-none') && !calcSection.classList.contains('dsp-none')) {
          calcSection.classList.add('dsp-none');
        }
      }
    }

    // Build 3D Card Deck Container
    const cardsContainer = document.createElement('ul');
    cardsContainer.className = 'custom-rte-cards';

    const rows = [...block.children];
    const cards = [];
    const steps = [];

    const seenCards = new Set();

    rows.forEach((row) => {
      const cell = row.children[0] || row;
      const badgeP = cell.querySelector('p');
      const list = cell.querySelector('ul');
      const badgeText = badgeP ? badgeP.textContent.trim() : '';
      const listText = list ? list.textContent.trim().replace(/\s+/g, ' ') : '';

      if (!badgeText && !listText) return;

      const cardSignature = `${badgeText}|${listText}`;
      if (seenCards.has(cardSignature)) return;
      seenCards.add(cardSignature);

      const cardItem = document.createElement('li');
      cardItem.className = 'custom-rte-card';
      moveInstrumentation(row, cardItem);

      // Extract Plan Badge (e.g. "TERM PLAN")
      if (badgeText) {
        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'plan-badge';
        badgeSpan.textContent = badgeText;
        cardItem.append(badgeSpan);
      }

      // Extract List Content
      if (list) {
        const cardBody = document.createElement('div');
        cardBody.className = 'plan-card-body';
        cardBody.append(list.cloneNode(true));
        cardItem.append(cardBody);
      }

      cards.push(cardItem);
      cardsContainer.append(cardItem);
    });

    // Build Step Pagination Bar with animated track (01 ━━━━ 02 03)
    const paginationWrapper = document.createElement('div');
    paginationWrapper.className = 'plan-pagination';

    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'steps-container';

    const trackWrapper = document.createElement('div');
    trackWrapper.className = 'progress-track-wrapper';
    const trackFill = document.createElement('span');
    trackFill.className = 'progress-bar-fill';
    trackWrapper.append(trackFill);

    let currentIndex = 0;
    let isTransitioning = false;
    let progressAnimation;
    let advanceAutoplay;
    let isHovered = false;
    let isDragging = false;
    let isHorizontalSwipe = false;
    let justDragged = false;
    let startX = 0;
    let startY = 0;
    let diffX = 0;
    let dragDirection = 0;
    let activePointerId = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motionOptions = {
      duration: 520,
      easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      fill: 'both',
    };
    const readState = (card) => {
      const style = getComputedStyle(card);
      return {
        transform: style.transform,
        width: style.width,
        height: style.height,
        opacity: style.opacity,
        zIndex: style.zIndex,
      };
    };
    const pauseAutoplay = () => {
      progressAnimation?.pause();
    };
    const resumeAutoplay = () => {
      pauseAutoplay();
      if (cards.length < 2 || reducedMotion.matches || isDragging || isTransitioning
        || document.hidden || isHovered) return;
      if (!progressAnimation) {
        const animation = trackFill.animate(
          [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
          { duration: SLIDE_DURATION, easing: 'linear', fill: 'forwards' },
        );
        progressAnimation = animation;
        animation.finished.then(() => {
          if (progressAnimation === animation) advanceAutoplay();
        }).catch(() => {});
      } else {
        progressAnimation.play();
      }
    };
    const finishAnimations = async (animations) => {
      await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
      animations.forEach((animation) => animation.cancel());
      cardsContainer.classList.remove('is-transitioning');
      isTransitioning = false;
      resumeAutoplay();
    };

    const selectCard = async (nextIndex, direction = -1) => {
      if (isTransitioning || isDragging || cards.length < 2) return;
      pauseAutoplay();
      if (nextIndex === currentIndex || reducedMotion.matches) {
        if (nextIndex !== currentIndex) {
          progressAnimation?.cancel();
          progressAnimation = null;
        }
        updateCardStack(cards, steps, trackWrapper, nextIndex);
        currentIndex = nextIndex;
        resumeAutoplay();
        return;
      }

      isTransitioning = true;
      progressAnimation?.cancel();
      progressAnimation = null;
      const outgoingCard = cards[currentIndex];
      const incomingCard = cards[nextIndex];
      const before = cards.map(readState);
      const exitDistance = outgoingCard.offsetWidth;
      cardsContainer.classList.add('is-transitioning');
      currentIndex = nextIndex;
      updateCardStack(cards, steps, trackWrapper, currentIndex);
      pauseAutoplay();
      const after = cards.map(readState);
      const animations = cards.map((card, index) => {
        let from = { ...before[index], zIndex: after[index].zIndex };
        let to = after[index];
        if (direction < 0 && card === outgoingCard) {
          from = { ...before[index], zIndex: cards.length + 1 };
          to = {
            ...from,
            transform: `translateX(${-exitDistance}px)`,
            opacity: 0,
          };
        } else if (direction > 0 && card === incomingCard) {
          from = {
            ...after[index],
            transform: dragDirection > 0 ? before[index].transform : `translateX(${-exitDistance}px)`,
            opacity: 1,
            zIndex: cards.length + 1,
          };
          to = { ...after[index], zIndex: cards.length + 1 };
        }
        return card.animate([from, to], motionOptions);
      });
      dragDirection = 0;
      await finishAnimations(animations);
    };

    const handleNextSlide = () => {
      selectCard((currentIndex + 1) % cards.length, -1);
    };
    advanceAutoplay = handleNextSlide;

    const handlePrevSlide = () => {
      selectCard((currentIndex - 1 + cards.length) % cards.length, 1);
    };
    cards.forEach((_, i) => {
      const stepBtn = document.createElement('button');
      stepBtn.type = 'button';
      stepBtn.className = `step-indicator ${i === 0 ? 'is-active' : ''}`;
      stepBtn.textContent = String(i + 1).padStart(2, '0');
      stepBtn.setAttribute('aria-label', `View plan ${i + 1}`);

      stepBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCard(i, i < currentIndex ? 1 : -1);
      });

      steps.push(stepBtn);
      stepsContainer.append(stepBtn);

      // Add click listener on cards to advance stack (only if not dragging)
      cards[i].addEventListener('click', () => {
        if (justDragged || isDragging) return;
        selectCard(i, i < currentIndex ? 1 : -1);
      });
    });

    // Touch & Pointer Drag / Swipe Gesture Handlers
    const snapBack = async () => {
      isTransitioning = true;
      const before = cards.map(readState);
      cardsContainer.classList.add('is-transitioning');
      updateCardStack(cards, steps, trackWrapper, currentIndex);
      pauseAutoplay();
      const animations = reducedMotion.matches ? [] : cards.map((card, index) => card.animate(
        [before[index], readState(card)],
        { ...motionOptions, duration: 260 },
      ));
      dragDirection = 0;
      await finishAnimations(animations);
    };

    cardsContainer.addEventListener('pointerdown', (e) => {
      if (isTransitioning || isDragging || cards.length < 2
        || e.target.closest('a, button, input, select, textarea')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      activePointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      diffX = 0;
      isDragging = true;
      isHorizontalSwipe = false;
      dragDirection = 0;
      cardsContainer.setPointerCapture(e.pointerId);
      pauseAutoplay();
    });

    cardsContainer.addEventListener('pointermove', (e) => {
      if (!isDragging || e.pointerId !== activePointerId) return;
      diffX = e.clientX - startX;
      const diffY = e.clientY - startY;
      if (!isHorizontalSwipe) {
        // Allow vertical page scroll without capturing
        if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 8) {
          isDragging = false;
          activePointerId = null;
          resumeAutoplay();
          return;
        }
        // Horizontal swipe detected
        if (Math.abs(diffX) > 8) {
          isHorizontalSwipe = true;
        }
      }
      if (isHorizontalSwipe) {
        const activeCard = cards[currentIndex];
        const previousCard = cards[(currentIndex - 1 + cards.length) % cards.length];
        const nextDirection = diffX > 0 ? 1 : -1;
        if (dragDirection !== nextDirection) {
          cardsContainer.classList.add('is-transitioning');
          updateCardStack(cards, steps, trackWrapper, currentIndex);
          pauseAutoplay();
          cardsContainer.classList.remove('is-transitioning');
          dragDirection = nextDirection;
        }
        if (diffX <= 0) {
          activeCard.style.transition = 'none';
          activeCard.style.transform = `translateX(${diffX}px)`;
        } else {
          previousCard.style.transition = 'none';
          previousCard.style.width = `${activeCard.offsetWidth}px`;
          previousCard.style.height = `${activeCard.offsetHeight}px`;
          previousCard.style.opacity = '1';
          previousCard.style.zIndex = String(cards.length + 1);
          previousCard.style.transform = `translateX(${Math.min(0, diffX - activeCard.offsetWidth)}px)`;
        }
      }
    });

    const finishDrag = (e) => {
      if (e.type === 'lostpointercapture' && e.target !== cardsContainer) return;
      if ((!isDragging && !isHorizontalSwipe) || e.pointerId !== activePointerId) return;
      const wasSwiping = isHorizontalSwipe;
      isDragging = false;
      isHorizontalSwipe = false;
      activePointerId = null;
      if (cardsContainer.hasPointerCapture(e.pointerId)) {
        cardsContainer.releasePointerCapture(e.pointerId);
      }
      if (wasSwiping) {
        justDragged = true;
        setTimeout(() => {
          justDragged = false;
        }, 200);
        const SWIPE_THRESHOLD = 45;
        if (e.type === 'pointercancel' || e.type === 'lostpointercapture') {
          snapBack();
        } else if (diffX < -SWIPE_THRESHOLD) {
          // Swiped left: fast-forward to next card
          handleNextSlide();
        } else if (diffX > SWIPE_THRESHOLD) {
          // Swiped right: go to previous card
          handlePrevSlide();
        } else {
          // Insufficient distance: snap back and resume
          snapBack();
        }
      } else {
        resumeAutoplay();
      }
    };
    cardsContainer.addEventListener('pointerup', finishDrag);
    cardsContainer.addEventListener('pointercancel', finishDrag);
    cardsContainer.addEventListener('lostpointercapture', finishDrag);
    cardsContainer.tabIndex = 0;
    cardsContainer.setAttribute('aria-label', 'Insurance plans');
    cardsContainer.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)
        || event.target.closest('a, button, input, select, textarea')) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') handlePrevSlide();
      else handleNextSlide();
    });
    cardsContainer.addEventListener('mouseenter', () => {
      isHovered = true;
      pauseAutoplay();
    });
    cardsContainer.addEventListener('mouseleave', () => {
      isHovered = false;
      resumeAutoplay();
    });
    document.addEventListener('visibilitychange', resumeAutoplay);
    reducedMotion.addEventListener('change', resumeAutoplay);
    stepsContainer.append(trackWrapper);
    paginationWrapper.append(stepsContainer);

    // Update Block DOM
    block.textContent = '';
    block.append(cardsContainer, paginationWrapper);

    // Initialize stack & start progress track timer
    updateCardStack(cards, steps, trackWrapper, 0);
    resumeAutoplay();
    return;
  }

  if (block.closest('.section.calc-card')) {
    const isCommonText = block.classList.contains('cmmn-txt')
      || block.classList.contains('cmmn-txt-row');
    if (!isCommonText) {
      addLayerClasses(block, {
        1: 'card-calc',
        2: 'card-inner',
        3: 'card-child',
        4: 'card-item',
      });
    }
    // if (!block.classList.contains('card-link')) {
    //   [...block.children].forEach((row) => {
    //     row.children[2]?.remove();
    //   });
    // } else {
    //   [...block.children].forEach((row) => {
    //     const [imgDiv, textDiv, linkDiv] = row.children;
    //     const link = linkDiv?.querySelector('a');
    //     if (!link) return;
    //     link.textContent = '';
    //     link.classList.add('calc-card-link');
    //     linkDiv.remove();
    //     link.append(imgDiv, textDiv);
    //     row.append(link);
    //     row.classList.add('calc-card-item');
    //     const href = link.getAttribute('href');
    //     row.setAttribute('role', 'button');
    //     row.setAttribute('tabindex', '0');
    //     row.setAttribute('aria-label', `Navigate to ${href}`);
    //     // Row is the focus target, so keep the inner link out of tab order
    //     link.setAttribute('tabindex', '-1');
    //     row.addEventListener('keydown', (e) => {
    //       if (e.code === 'Enter' || e.code === 'Space') {
    //         e.preventDefault();
    //         window.location.href = href;
    //       }
    //     });
    //   });
    // }

    const cards = [...block.children];
    if (cards.length > 4) {
      const mobileQuery = window.matchMedia('(max-width: 768px)');
      let isInitializingSwiper = false;

      const disableSwiper = () => {
        if (block.swiperInstance) {
          block.swiperInstance.destroy(true, true);
          block.swiperInstance = null;
        }

        const swiperWrapper = block.querySelector(':scope > .swiper-wrapper');
        cards.forEach((card) => {
          card.classList.remove('swiper-slide');
          block.append(card);
        });
        swiperWrapper?.remove();
        block.querySelector(':scope > .swiper-pagination')?.remove();
        block.classList.remove('swiper');
      };

      const enableSwiper = async () => {
        if (block.swiperInstance || isInitializingSwiper) return;
        isInitializingSwiper = true;

        block.classList.add('swiper');
        const swiperWrapper = document.createElement('div');
        swiperWrapper.className = 'swiper-wrapper';
        cards.forEach((card) => {
          card.classList.add('swiper-slide');
          swiperWrapper.append(card);
        });

        const pagination = document.createElement('div');
        pagination.className = 'swiper-pagination';
        block.append(swiperWrapper, pagination);

        const { default: createSwiper } = await import('../swiper/swiper-bundle.min.js');
        if (!mobileQuery.matches) {
          disableSwiper();
          isInitializingSwiper = false;
          return;
        }

        block.swiperInstance = createSwiper(block, {
          slidesPerView: 2,
          slidesPerGroup: 2,
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

      const toggleSwiper = () => {
        if (mobileQuery.matches) enableSwiper();
        else disableSwiper();
      };

      toggleSwiper();
      mobileQuery.addEventListener('change', toggleSwiper);
    }
  }

  // Custom RTE Redirection link (3-column "RTE Image Item" rows only: image, text, hidden link)
  if (!block.classList.contains('card-link')) {
    [...block.children].forEach((row) => {
      // if (row.children.length === 3) row.children[2]?.remove();
      if (row.children.length === 3 && !row.classList.contains('card-content')) row.children[2]?.remove();
    });
  } else {
    [...block.children].forEach((row) => {
      const [imgDiv, textDiv, linkDiv] = row.children;
      const link = linkDiv?.querySelector('a');
      if (!link) return;
      link.textContent = '';
      link.classList.add('card-anchor');
      linkDiv.remove();
      link.append(imgDiv, textDiv);
      row.append(link);
      row.classList.add('card-item');
      const href = link.getAttribute('href');
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-label', `Navigate to ${href}`);
      // Row is the focus target, so keep the inner link out of tab order
      link.setAttribute('tabindex', '-1');
      row.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          window.location.href = href;
        }
      });
    });
  }

  // Fund Performance Investment Tab - Team Component
  const investmentTeam = block.closest('.investment-team');
  if (investmentTeam) {
    addLayerClasses(investmentTeam.children[2], {
      1: 'team-card',
      2: 'team-inner',
      3: 'team-child',
      4: 'team-item',
      5: 'team-inneritem',
      6: 'item-child',
    });

    // const blockWrap = block.closest('.custom-rte-wrapper');

    if (block.classList.contains('team-card')) {
      // const cards = [...block.children];
      // const mobileQuery = window.matchMedia('(max-width: 768px)');
      // let isInitializingSwiper = false;

      // const disableSwiper = () => {
      //   if (block.swiperInstance) {
      //     block.swiperInstance.destroy(true, true);
      //     block.swiperInstance = null;
      //   }

      //   const swiperWrapper = block.querySelector(':scope > .swiper-wrapper');
      //   cards.forEach((card) => {
      //     card.classList.remove('swiper-slide');
      //     block.append(card);
      //   });
      //   swiperWrapper?.remove();
      //   block.querySelector(':scope > .swiper-pagination')?.remove();
      //   block.classList.remove('swiper');
      // };

      // const enableSwiper = async () => {
      //   if (block.swiperInstance || isInitializingSwiper) return;
      //   isInitializingSwiper = true;

      //   block.classList.add('swiper');
      //   const swiperWrapper = document.createElement('div');
      //   swiperWrapper.className = 'swiper-wrapper';
      //   cards.forEach((card) => {
      //     card.classList.add('swiper-slide');
      //     swiperWrapper.append(card);
      //   });

      //   const pagination = document.createElement('div');
      //   pagination.className = 'swiper-pagination';
      //   block.append(swiperWrapper, pagination);

      //   const { default: createSwiper } = await import('../swiper/swiper-bundle.min.js');
      //   if (!mobileQuery.matches) {
      //     disableSwiper();
      //     isInitializingSwiper = false;
      //     return;
      //   }

      //   block.swiperInstance = createSwiper(block, {
      //     // slidesPerView: 1.394,
      //     slidesPerView: 1.33,
      //     slidesPerGroup: 1,
      //     spaceBetween: 9,
      //     slidesOffsetBefore: 16,
      //     slidesOffsetAfter: 16,
      //     grabCursor: true,
      //     observer: true,
      //     observeParents: true,
      //     pagination: {
      //       el: pagination,
      //       clickable: true,
      //     },
      //   });
      //   isInitializingSwiper = false;
      // };

      // const toggleSwiper = () => {
      //   if (mobileQuery.matches) enableSwiper();
      //   else disableSwiper();
      // };

      // toggleSwiper();
      // mobileQuery.addEventListener('change', toggleSwiper);

      // const blockWrap = block.closest('.custom-rte-wrapper');
      const investTeamCont = div({ class: 'invest-team-container' });
      const investTeamWrap = div({ class: 'invest-team-wrap' });
      investTeamCont.appendChild(investTeamWrap);
      Array.from(block.children).forEach((child) => {
        investTeamWrap.appendChild(child);
      });
      block.appendChild(investTeamCont);
      const { default: createSwiper } = await import('../swiper/swiper-bundle.min.js');

      // mobile swiper
      // const mobileQuery = window.matchMedia('(max-width: 768px)');
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        investTeamCont.classList.add('swiper');
        investTeamWrap.classList.add('swiper-wrapper');
        Array.from(investTeamWrap.children).forEach((child) => {
          child.classList.add('swiper-slide');
        });

        const pagination = div({ class: 'swiper-pagination' });
        investTeamCont.append(pagination);

        investTeamCont.swiperInstance = createSwiper(investTeamCont, {
          // slidesPerView: 1.394,
          slidesPerView: 1.34,
          slidesPerGroup: 1,
          spaceBetween: 9,
          slidesOffsetBefore: 16,
          slidesOffsetAfter: 16,
          grabCursor: true,
          observer: true,
          observeParents: true,
          pagination: {
            el: pagination,
            clickable: true,
          },
        });
      }

      // Modal structure and swiper
      const modalSwiper = div(
        { class: 'modal-swiper-container' },
        div(
          { class: 'modal-swiper swiper' },
          div(
            { class: 'modal-swiper-wrapper swiper-wrapper' },
            ...Array.from(investTeamWrap.children).map((child) => {
              const imgSrc = child.querySelector('.team-child-1 img')?.getAttribute('src') || '';
              const title = child.querySelector('.team-child-2 .team-item-2')?.textContent.trim() || '';
              const subTitle = child.querySelector('.team-child-2 .team-item-3')?.textContent.trim() || '';
              const teamChild2 = child.querySelector('.team-child-2');
              const contentChildren = teamChild2 ? [...teamChild2.children] : [];
              const descArr = contentChildren
                .slice(3)
                .map((el) => el.textContent.trim())
                .filter(Boolean);

              return div(
                { class: 'modal-detail-container swiper-slide' },
                div(
                  { class: 'modal-close-btn' },
                  img({ src: '/icons/modal-close.svg', alt: 'Close', class: 'close-icon' }),
                ),
                div(
                  { class: 'modal-img-wrap' },
                  img({ src: imgSrc, alt: title, class: 'modal-image' }),
                ),
                div(
                  { class: 'detail-content' },
                  h3({ class: 'detail-title' }, title),
                  p({ class: 'detail-subtitle' }, subTitle),
                  div(
                    { class: 'desc-wrap' },
                    ...descArr.map((text) => p({ class: 'detail-desc' }, text)),
                  ),
                ),
              );
            }),
          ),
        ),
      );

      block.appendChild(modalSwiper);

      if (modalSwiper) {
        const modalSwiperEl = modalSwiper.querySelector('.modal-swiper');
        const nextBtn = div({ class: 'swiper-button-next' });
        const prevBtn = div({ class: 'swiper-button-prev' });
        const wrapBtn = div({ class: 'swiper-button-wrap' });
        wrapBtn.append(prevBtn, nextBtn);
        modalSwiperEl.appendChild(wrapBtn);

        const modalSwiperInstance = createSwiper(modalSwiperEl, {
          slidesPerView: 1,
          slidesPerGroup: 1,
          spaceBetween: 16,
          // centerMode: true,
          slidesOffsetBefore: 16,
          slidesOffsetAfter: 16,
          // centerMode: true,
          observer: true,
          observeParents: true,
          navigation: {
            prevEl: modalSwiperEl.querySelector('.swiper-button-prev'),
            nextEl: modalSwiperEl.querySelector('.swiper-button-next'),
          },
          breakpoints: {
            768: {
              slidesPerView: 'auto',
              slidesOffsetBefore: 0,
              slidesOffsetAfter: 0,
            },
          },
        });

        const teamSection = block.closest('.section.investment-team.red-logo-bg');
        const originalSectionMarginTop = teamSection?.style.marginTop || '';
        const desktopTeamQuery = window.matchMedia('(min-width: 769px)');
        const originalBlockMinHeight = block.style.minHeight;
        const modalBlockHeight = () => {
          const modalStyle = getComputedStyle(modalSwiper);
          return Math.max(
            investTeamCont.offsetTop + investTeamCont.offsetHeight,
            modalSwiper.offsetTop + modalSwiper.offsetHeight
              + parseFloat(modalStyle.marginBottom),
          );
        };
        const reserveModalHeight = () => {
          const expanded = modalSwiper.classList.contains('expanded');
          investTeamCont.inert = expanded;
          block.style.minHeight = expanded ? `${modalBlockHeight()}px` : originalBlockMinHeight;
        };
        let sectionHeightAnimation;
        let stopSectionScroll = () => {};
        let mobileScrollOrigin = null;
        const transitionSectionHeight = (updateView, scrollTarget = null) => {
          stopSectionScroll();
          if (!teamSection) {
            updateView();
            reserveModalHeight();
            return;
          }
          const sectionFrame = () => {
            const style = getComputedStyle(teamSection);
            return {
              height: style.height,
              marginTop: style.marginTop,
              paddingTop: style.paddingTop,
              paddingBottom: style.paddingBottom,
              overflow: 'clip',
            };
          };
          const previousFrame = sectionFrame();
          const previousBounds = teamSection.getBoundingClientRect();
          const previousHeight = previousBounds.height;
          sectionHeightAnimation?.cancel();
          updateView();
          reserveModalHeight();
          const nextHeight = teamSection.getBoundingClientRect().height;
          teamSection.style.marginTop = desktopTeamQuery.matches
            ? `${parseFloat(previousFrame.marginTop) + previousHeight - nextHeight}px`
            : originalSectionMarginTop;
          const nextFrame = sectionFrame();
          const shouldScroll = !desktopTeamQuery.matches && scrollTarget !== null;
          const scrollStart = window.scrollY;
          const scrollEnd = typeof scrollTarget === 'function' ? scrollTarget() : scrollTarget;
          const syncMobileScroll = (progress = 1) => {
            const maxScroll = Math.max(
              0,
              document.documentElement.scrollHeight - window.innerHeight,
            );
            const target = scrollStart + (scrollEnd - scrollStart) * progress;
            window.scrollTo({ top: Math.min(maxScroll, Math.max(0, target)), behavior: 'instant' });
          };
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            if (shouldScroll) syncMobileScroll();
            return;
          }
          sectionHeightAnimation = teamSection.animate([previousFrame, nextFrame], {
            duration: 450,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          });
          if (shouldScroll) {
            const scrollController = new AbortController();
            let scrollFrame;
            stopSectionScroll = () => {
              window.cancelAnimationFrame(scrollFrame);
              scrollController.abort();
            };
            const listenerOptions = { passive: true, signal: scrollController.signal };
            window.addEventListener('wheel', stopSectionScroll, listenerOptions);
            window.addEventListener('touchstart', stopSectionScroll, listenerOptions);
            window.addEventListener('keydown', (event) => {
              if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
                stopSectionScroll();
              }
            }, listenerOptions);
            const syncScrollFrame = () => {
              syncMobileScroll(sectionHeightAnimation.effect.getComputedTiming().progress ?? 1);
              if (sectionHeightAnimation.playState === 'running') {
                scrollFrame = window.requestAnimationFrame(syncScrollFrame);
              } else {
                stopSectionScroll();
              }
            };
            scrollFrame = window.requestAnimationFrame(syncScrollFrame);
          }
        };

        desktopTeamQuery.addEventListener('change', () => transitionSectionHeight(() => {}));

        const modalSizeObserver = new ResizeObserver(() => {
          if (modalSwiper.classList.contains('expanded')
            && block.style.minHeight !== `${modalBlockHeight()}px`) {
            transitionSectionHeight(() => {});
          }
        });
        modalSizeObserver.observe(modalSwiper);
        modalSizeObserver.observe(investTeamCont);

        Array.from(investTeamWrap.children).forEach((card, index) => {
          card.addEventListener('click', () => {
            if (!desktopTeamQuery.matches && !modalSwiper.classList.contains('expanded')) {
              mobileScrollOrigin = window.scrollY;
            }
            investTeamCont.swiperInstance?.slideTo(index, 0);
            setTimeout(() => {
              transitionSectionHeight(() => {
                modalSwiper.classList.add('expanded');
                investTeamCont.classList.add('hide');
                modalSwiperInstance.update();
                modalSwiperInstance.slideTo(index, 0);
              }, () => {
                const mobileTopOffset = 96 + 75;
                return window.scrollY + teamSection.getBoundingClientRect().top - mobileTopOffset;
              });
            }, 100);
          });
        });

        // Click on modal close button removes the expanded class
        modalSwiper.querySelectorAll('.modal-close-btn').forEach((closeBtn) => {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            transitionSectionHeight(() => {
              modalSwiper.classList.remove('expanded');
              investTeamCont.classList.remove('hide');
            }, mobileScrollOrigin);
            mobileScrollOrigin = null;
          });
        });
      }
    }
  }

  if (block.closest('.investment-philosophy.fund-tab-content-v2')) {
    addLayerClasses(block, {
      1: 'philosophy-card',
      2: 'plsphy-inner',
      3: 'plsphy-child',
      4: 'plsphy-item',
      5: 'plsphy-inneritem',
      6: 'item-child',
    });
  }

  if (block.closest('.nav-performance')) {
    const navPerformanceCss = new URL('./nav-performance.css', import.meta.url).href;
    await loadCSS(navPerformanceCss);
    const { default: decorateNavPerformance } = await import('./nav-performance.js');
    decorateNavPerformance(block);
  }

  if (block.closest('.global-search')) {
    block.querySelectorAll('p').forEach((ele, i) => {
      ele.classList.add(`search-item-${i + 1}`);
    });

    const modalCloseBtn = block.querySelector('.search-item-1 span').cloneNode(true);
    const searchIcon = block.querySelector('.search-item-2 span').cloneNode(true);
    const inputLbl = block.querySelector('.search-item-3').textContent;
    const searchResultIcon = block.querySelector('.search-item-4 span').cloneNode(true);
    const searchTrendingTxt = block.querySelector('.search-item-5').textContent;
    // trending searches: an authored bullet list, else the original five
    const authoredTags = [...block.querySelectorAll('li')]
      .map((item) => item.textContent.trim()).filter(Boolean);
    const trendingTags = authoredTags.length ? authoredTags : [
      'Contact number', 'Manage policy', 'How to file a claim', 'Child plan', 'NRI investment plans',
    ];
    // the search results page: an authored link, else /in/en/search
    const resultsPath = block.querySelector('p > a[href]')?.getAttribute('href') || '/in/en/search';

    const globalSearchStr = div(
      { class: 'global-search-container' },
      div(
        { class: 'search-field-wrap' },
        searchIcon,
        input({
          type: 'text', placeholder: inputLbl, class: 'search-inp', ariaLabel: inputLbl,
        }),
        button(
          { type: 'submit', class: 'search-submit-btn', 'aria-label': 'Submit Search' },
          searchResultIcon,
        ),
      ),
      div(
        { class: 'trending-searches-wrapper' },
        h2({ class: 'trending-title' }, searchTrendingTxt),
        ul(
          { class: 'trending-tags-list' },
          ...trendingTags.map((tag) => li(
            { class: 'trending-tag-item' },
            button({ class: 'trending-tag-btn', type: 'button', 'aria-label': `Search for ${tag}` }, tag),
          )),
        ),
      ),
    );
    const closeIconTemplate = document.createElement('template');
    closeIconTemplate.className = 'global-search-close-icon';
    closeIconTemplate.content.append(modalCloseBtn);
    block.innerHTML = '';
    block.append(globalSearchStr, closeIconTemplate);

    // search behaviour (submit, Enter, clear, trending searches): its own module
    const { default: initGlobalSearch } = await import('./global-search.js');
    initGlobalSearch(globalSearchStr, { resultsPath });
  }
}
