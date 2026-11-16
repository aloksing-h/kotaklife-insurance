import { loadCSS } from '../../scripts/aem.js';
import { openModal } from '../modal/modal.js';
import {
  div, span, button, getRespectiveDomain,
} from '../../scripts/dom-helpers.js';

async function decorateCustomerReviews(block) {
  // Truncation measurements and Swiper slide-width calculations both depend
  // on this block's CSS and the Swiper library. Loading both in parallel
  // eliminates network waterfalls and ensures styles are ready before layout.
  const [, { default: createSwiper }] = await Promise.all([
    loadCSS(`${window.hlx?.codeBasePath || ''}/blocks/testimonials/customer-reviews.css`),
    import('../swiper/swiper-bundle.min.js'),
  ]);

  const rows = [...block.children].filter(
    (el) => el.nodeType === 1
      && !el.classList.contains('swiper-wrapper')
      && !el.classList.contains('customer-reviews-controls'),
  );

  if (!rows.length) return;

  let swiperWrapper = block.querySelector(':scope > .swiper-wrapper');
  if (!swiperWrapper) {
    swiperWrapper = div({ class: 'swiper-wrapper' });
    block.prepend(swiperWrapper);
  }

  let lastCollapsedIndex = 0;
  let isUpdating = false;

  const getCollapsedSlidesPerView = () => {
    if (window.innerWidth >= 900) return 3;
    if (window.innerWidth >= 600) return 2;
    return 1.15;
  };

  const syncExpandedState = (expandedRow = null) => {
    const swiper = block.swiperInstance;
    const targetRow = expandedRow || null;
    const wasExpanded = block.classList.contains('has-expanded-card');
    const hasExpanded = Boolean(targetRow);

    if (swiper && !wasExpanded && hasExpanded) {
      lastCollapsedIndex = swiper.activeIndex;
    }

    block.classList.toggle('has-expanded-card', hasExpanded);

    // Keep all cards in expanded state (aria-expanded="true")
    rows.forEach((row) => {
      row.setAttribute('aria-expanded', hasExpanded ? 'true' : 'false');
    });

    if (swiper) {
      isUpdating = true;

      swiper.params.slidesPerView = hasExpanded ? 1 : getCollapsedSlidesPerView();
      if (swiper.params.breakpoints) {
        swiper.params.breakpoints[600].slidesPerView = hasExpanded ? 1 : 2;
        swiper.params.breakpoints[900].slidesPerView = hasExpanded ? 1 : 3;
      }
      if (swiper.originalParams) {
        swiper.originalParams.slidesPerView = hasExpanded ? 1 : 1.15;
      }

      swiper.updateSize();
      swiper.updateSlides();

      if (hasExpanded) {
        const targetIndex = rows.indexOf(targetRow);
        if (targetIndex !== -1) {
          swiper.slideTo(targetIndex, 400, false);
        }
      } else {
        const closeIndex = swiper.activeIndex ?? lastCollapsedIndex;
        swiper.slideTo(closeIndex, 400, false);
      }

      swiper.updateProgress();
      swiper.updateSlidesClasses();
      if (swiper.pagination) {
        swiper.pagination.render();
        swiper.pagination.update();
      }
      if (swiper.navigation) {
        swiper.navigation.update();
      }

      setTimeout(() => {
        isUpdating = false;
      }, 450);
    }
  };

  const updateCardTruncation = (cardRow) => {
    if (cardRow.getAttribute('aria-expanded') === 'true') return;

    const body = cardRow.querySelector('.customer-review-body');
    const readMore = cardRow.querySelector('.customer-review-readmore-source');
    const readMoreLabel = readMore?.textContent?.trim() || 'Read more';
    const reviewP = body?.querySelector('p') || body;
    if (!reviewP || !body) return;

    if (!cardRow.dataset.fullText) {
      cardRow.dataset.fullText = reviewP.textContent.trim();
    }

    // Skip while the card isn't laid out yet
    if (body.clientHeight === 0) return;

    const { fullText } = cardRow.dataset;

    let shortSpan = reviewP.querySelector('.customer-review-text-short');
    let readMoreBtn = reviewP.querySelector('.customer-review-read-more');
    let fullSpan = reviewP.querySelector('.customer-review-text-full');

    if (!shortSpan) {
      shortSpan = span({ class: 'customer-review-text-short' });
      readMoreBtn = button(
        {
          type: 'button',
          class: 'customer-review-read-more',
          onclick: (e) => {
            e.stopPropagation();
            syncExpandedState(cardRow);
          },
        },
        readMoreLabel,
      );
      fullSpan = span({ class: 'customer-review-text-full' }, fullText);
      reviewP.textContent = '';
      reviewP.append(shortSpan, readMoreBtn, fullSpan);
    }

    // Measure with full text displayed to test if truncation is needed
    shortSpan.style.display = 'none';
    readMoreBtn.style.display = 'none';
    fullSpan.style.display = 'inline';

    if (body.scrollHeight <= body.clientHeight + 1) {
      cardRow.classList.remove('is-truncatable');
      return;
    }

    cardRow.classList.add('is-truncatable');
    fullSpan.style.display = '';
    shortSpan.style.display = '';
    readMoreBtn.style.display = '';

    if (!cardRow.words) {
      cardRow.words = fullText.split(/\s+/);
    }
    const { words } = cardRow;

    // Binary search (O(log N)) to find max words fitting within the container,
    // reducing layout thrashing from ~40 reflows down to ~5-6 reflows per card.
    let low = 1;
    let high = words.length - 1;
    let bestCount = 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      shortSpan.textContent = `${words.slice(0, mid).join(' ').replace(/[.,;:\s]+$/, '')}.. `;
      if (body.scrollHeight <= body.clientHeight + 1) {
        bestCount = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    shortSpan.textContent = `${words.slice(0, bestCount).join(' ').replace(/[.,;:\s]+$/, '')}.. `;
  };

  rows.forEach((row) => {
    row.classList.add('customer-review-card', 'swiper-slide');
    row.setAttribute('aria-expanded', 'false');

    const [headerCol, bodyCol, readMoreCol, starCol] = [...row.children];

    if (headerCol) {
      headerCol.classList.add('customer-review-header');
      const [nameEl, roleEl] = [...headerCol.children];
      if (nameEl) nameEl.classList.add('customer-review-name');
      if (roleEl) roleEl.classList.add('customer-review-role');
    }

    if (bodyCol) {
      bodyCol.classList.add('customer-review-body');
    }

    if (readMoreCol) {
      readMoreCol.classList.add('customer-review-readmore-source');
    }

    if (starCol) {
      starCol.classList.add('customer-review-star');
    }

    if (!row.querySelector('.customer-review-close')) {
      const closeBtn = button({
        type: 'button',
        class: 'customer-review-close',
        'aria-label': 'Close expanded review',
        onclick: (e) => {
          e.stopPropagation();
          syncExpandedState(null);
        },
      });
      row.append(closeBtn);
    }
  });

  // Batch append decorated rows to swiper wrapper
  swiperWrapper.append(...rows);

  // Delegated events on wrapper: card navigation on mobile and width transition completion
  swiperWrapper.addEventListener('click', (e) => {
    if (e.target.closest('.customer-review-close')
      || e.target.closest('.customer-review-read-more')) {
      return;
    }

    const card = e.target.closest('.customer-review-card');
    if (!card) return;

    const swiper = block.swiperInstance;
    const rowIndex = rows.indexOf(card);
    if (window.innerWidth < 600 && swiper && swiper.activeIndex !== rowIndex) {
      swiper.slideTo(rowIndex);
    }
  });

  swiperWrapper.addEventListener('transitionend', (e) => {
    const card = e.target.closest('.customer-review-card');
    if (!card || e.target !== card || e.propertyName !== 'width') return;
    if (card.getAttribute('aria-expanded') !== 'true') {
      updateCardTruncation(card);
    }
  });

  let controls = block.querySelector('.customer-reviews-controls');
  if (!controls) {
    controls = div(
      { class: 'customer-reviews-controls' },
      div({ class: 'swiper-pagination' }),
      div(
        { class: 'customer-reviews-nav' },
        button(
          {
            type: 'button',
            class: 'customer-reviews-nav-btn customer-reviews-prev',
            'aria-label': 'Previous review',
          },
          span({ class: 'customer-reviews-nav-icon' }),
        ),
        button(
          {
            type: 'button',
            class: 'customer-reviews-nav-btn customer-reviews-next',
            'aria-label': 'Next review',
          },
          span({ class: 'customer-reviews-nav-icon' }),
        ),
      ),
    );
    block.append(controls);
  }

  block.classList.add('swiper');
  const paginationEl = controls.querySelector('.swiper-pagination');
  const prevEl = controls.querySelector('.customer-reviews-prev');
  const nextEl = controls.querySelector('.customer-reviews-next');

  block.swiperInstance = createSwiper(block, {
    slidesPerView: 1.15,
    spaceBetween: 12,
    grabCursor: true,
    watchOverflow: true,
    pagination: {
      el: paginationEl,
      clickable: true,
    },
    navigation: {
      prevEl,
      nextEl,
    },
    breakpoints: {
      600: {
        slidesPerView: 2,
        spaceBetween: 16,
      },
      900: {
        slidesPerView: 3,
        spaceBetween: 20,
      },
    },
    on: {
      slideChange(swiper) {
        if (isUpdating) return;
        if (swiper.navigation) {
          swiper.navigation.update();
        }
      },
    },
  });

  // Calculate card truncation once Swiper has initialized slide dimensions
  rows.forEach((row) => updateCardTruncation(row));

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      if (!block.classList.contains('has-expanded-card')) {
        rows.forEach((row) => updateCardTruncation(row));
      }
    });
  }

  let lastWidth = window.innerWidth;
  let resizeTimer;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!block.classList.contains('has-expanded-card')) {
        rows.forEach((row) => updateCardTruncation(row));
      }
    }, 200);
  });
}

async function resolveMediaUrl(href) {
  try {
    const url = new URL(href, window.location.href);
    if (url.pathname.startsWith('/content/')) {
      let domain = await getRespectiveDomain();
      if (domain === true) {
        domain = 'https://publish-p48457-e1275402.adobeaemcloud.com';
      }
      return domain + url.pathname;
    }
    return url.href;
  } catch {
    return href;
  }
}

export default function decorate(block) {
  if (block.classList.contains('customer-reviews')) {
    decorateCustomerReviews(block);
    return;
  }

  if (block.classList.contains('customer-say')) {
    let activeIndex = 0;
    let bullets = [];

    // Get only actual card items (never count pagination or non-element nodes)
    const getItems = () => [...block.children].filter(
      (el) => el.nodeType === 1 && !el.classList.contains('swiper-pagination'),
    );

    // Single source of truth: Switch active item, sync pagination, and manage video states
    const activateItem = (targetIndex) => {
      const items = getItems();
      if (items.length === 0) return;

      // Clamp index to valid bounds
      const validIndex = Math.max(0, Math.min(targetIndex, items.length - 1));
      activeIndex = validIndex;

      items.forEach((item, i) => {
        const isActive = i === validIndex;
        item.setAttribute('aria-expanded', isActive ? 'true' : 'false');

        // Manage Background Video Play/Pause State
        const bgVideo = item.querySelector('video');
        if (bgVideo) {
          if (isActive) {
            // Call play directly; iOS requires this to start buffering
            bgVideo.play().catch(() => {});
          } else {
            bgVideo.pause();
            bgVideo.currentTime = 0; // Reset video to start
          }
        }
      });

      // Update Pagination Bullets
      bullets.forEach((bullet, i) => {
        if (i === validIndex) {
          bullet.classList.add('swiper-pagination-bullet-active');
        } else {
          bullet.classList.remove('swiper-pagination-bullet-active');
        }
      });
    };

    // Decorate an individual card item (idempotent)
    const decorateItem = async (row, index) => {
      row.classList.add('testimonial-item');
      row.setAttribute('tabindex', '0');
      row.setAttribute('role', 'button');
      if (!row.hasAttribute('aria-expanded')) {
        row.setAttribute('aria-expanded', index === 0 ? 'true' : 'false');
      }

      if (row.dataset.decorated === 'true') {
        return; // Already decorated, avoid duplicate listeners or DOM restructure
      }
      row.dataset.decorated = 'true';

      let modalUrl = null;
      const columns = [...row.children];
      if (columns.length >= 2) {
        const col1 = columns[0];
        const col2 = columns[1];

        col1.classList.add('testimonial-col-1');
        col2.classList.add('testimonial-col-2');

        // Decorate Column 1: Short Images
        const col1Elements = [...col1.children];
        if (col1Elements.length >= 1) col1Elements[0].classList.add('short-img-mob');
        if (col1Elements.length >= 2) col1Elements[1].classList.add('short-img-desk');

        // Decorate Column 2: Large Images & Videos
        const col2Elements = [...col2.children];
        if (col2Elements.length >= 1) col2Elements[0].classList.add('large-img-mob');
        if (col2Elements.length >= 2) col2Elements[1].classList.add('large-img-desk');

        // Background Video Initialization
        if (col2Elements.length >= 3) {
          col2Elements[2].classList.add('video-source-wrapper');
          const VideoWrapper = col2Elements[2];
          const isVideoEl = (el) => /\.(mp4|webm|ogg)(\?|$)/i.test(el?.querySelector('a')?.getAttribute('href') || '');

          if (isVideoEl(VideoWrapper)) {
            const videoAnchor = VideoWrapper.querySelector('a');
            if (videoAnchor) {
              const videoSrc = await resolveMediaUrl(videoAnchor.href);

              const video = document.createElement('video');
              video.setAttribute('loop', '');
              video.setAttribute('muted', '');
              video.muted = true;
              video.setAttribute('playsinline', '');
              video.setAttribute('crossorigin', 'anonymous');
              video.setAttribute('webkit-playsinline', '');
              video.setAttribute('preload', 'auto');
              video.setAttribute('autoplay', ''); // Required for smoother iOS handling
              video.setAttribute('src', videoSrc);

              // Use existing image as a seamless loading poster
              const posterImg = col2.querySelector('.large-img-desk img') || col2.querySelector('.large-img-mob img');
              if (posterImg) {
                video.setAttribute('poster', posterImg.src);
              }

              // Add a class ONLY when the video has buffered and is actively playing
              video.addEventListener('playing', () => {
                row.classList.add('video-is-playing');
              });

              // Handle pausing resetting the visual state
              video.addEventListener('pause', () => {
                row.classList.remove('video-is-playing');
              });

              VideoWrapper.innerHTML = '';
              VideoWrapper.appendChild(video);

              // Trigger play if this item happens to be currently active
              if (index === activeIndex && row.getAttribute('aria-expanded') === 'true') {
                video.play().catch(() => {});
              } else {
                // Ensure inactive videos are paused despite the autoplay attribute
                video.pause();
              }
            }
          }
        }

        // Play Button & Modal Link Extraction
        if (col2Elements.length >= 4) {
          const videoBtnWrapper = col2Elements[3];
          videoBtnWrapper.classList.add('video-btn-wrapper');
          videoBtnWrapper.setAttribute('aria-label', 'Play video testimonial');
          videoBtnWrapper.setAttribute('role', 'button');
          videoBtnWrapper.setAttribute('tabindex', '0');

          const link = videoBtnWrapper.querySelector('a');
          if (link) {
            modalUrl = link.href;
            link.removeAttribute('href');
          }

          videoBtnWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            if (modalUrl) {
              openModal(modalUrl);
            }
          });

          videoBtnWrapper.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              if (modalUrl) {
                openModal(modalUrl);
              }
            }
          });
        }
      }

      // Hover & Focus switch active states
      /*
      if (window.matchMedia('(hover: hover)').matches) {
        row.addEventListener('mouseenter', () => {
          const items = getItems();
          const currentIndex = items.indexOf(row);
          if (currentIndex !== -1) activateItem(currentIndex);
        });
      }
      */
      row.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'touch') return;
        const items = getItems();
        const currentIndex = items.indexOf(row);
        if (currentIndex !== -1) activateItem(currentIndex);
      });

      row.addEventListener('focus', () => {
        const items = getItems();
        const currentIndex = items.indexOf(row);
        if (currentIndex !== -1) activateItem(currentIndex);
      });

      // Click handler for the row
      row.addEventListener('click', () => {
        const items = getItems();
        const currentIndex = items.indexOf(row);
        if (currentIndex !== -1) activateItem(currentIndex);
      });

      // Keyboard support
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const items = getItems();
          const currentIndex = items.indexOf(row);
          if (currentIndex !== -1) activateItem(currentIndex);
        }
      });
    };

    // Rebuild pagination dynamically to always match the exact card count
    const syncPagination = () => {
      const items = getItems();
      let pagination = block.querySelector(':scope > .swiper-pagination');

      if (items.length <= 1) {
        if (pagination) pagination.remove();
        bullets = [];
        if (items.length === 1) {
          items[0].setAttribute('aria-expanded', 'true');
        }
        return;
      }

      if (!pagination) {
        pagination = document.createElement('div');
        pagination.className = 'swiper-pagination';
        block.appendChild(pagination);
      }

      // Clear existing bullets and regenerate to match current items.length
      pagination.innerHTML = '';
      bullets = items.map((_, index) => {
        const bullet = document.createElement('span');
        bullet.className = `swiper-pagination-bullet${index === activeIndex ? ' swiper-pagination-bullet-active' : ''}`;
        bullet.setAttribute('role', 'button');
        bullet.setAttribute('tabindex', '0');
        bullet.setAttribute('aria-label', `Go to slide ${index + 1}`);

        bullet.addEventListener('click', (e) => {
          e.stopPropagation();
          activateItem(index);
        });

        bullet.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            activateItem(index);
          }
        });

        pagination.appendChild(bullet);
        return bullet;
      });

      activateItem(activeIndex);
    };

    // Initial decoration of all cards
    const items = getItems();
    items.forEach((row, index) => {
      decorateItem(row, index);
    });
    syncPagination();

    // Watch for any cards added or removed dynamically (Universal Editor, DOM patch, or scripts)
    const observer = new MutationObserver((mutations) => {
      let cardCountChanged = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && !node.classList.contains('swiper-pagination')) {
            cardCountChanged = true;
          }
        });
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === 1 && !node.classList.contains('swiper-pagination')) {
            cardCountChanged = true;
          }
        });
      });

      if (cardCountChanged) {
        const currentItems = getItems();
        currentItems.forEach((row, index) => {
          decorateItem(row, index);
        });
        // Ensure activeIndex is still within bounds
        if (activeIndex >= currentItems.length) {
          activeIndex = Math.max(0, currentItems.length - 1);
        }
        syncPagination();
      }
    });

    observer.observe(block, { childList: true });

    // Touch swipe support on mobile
    let touchStartX = 0;
    block.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    block.addEventListener('touchend', (e) => {
      const currentItems = getItems();
      if (currentItems.length <= 1) return;
      const touchEndX = e.changedTouches[0].screenX;
      const diffX = touchStartX - touchEndX;
      if (Math.abs(diffX) > 40) {
        if (diffX > 0 && activeIndex < currentItems.length - 1) {
          activateItem(activeIndex + 1);
        } else if (diffX < 0 && activeIndex > 0) {
          activateItem(activeIndex - 1);
        }
      }
    }, { passive: true });
  }
}
