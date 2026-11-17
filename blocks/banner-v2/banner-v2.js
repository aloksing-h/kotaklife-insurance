import { moveInstrumentation } from '../../scripts/scripts.js';
import { decorateIcons } from '../../scripts/aem.js';

const ICON_TOKEN = /:([\w-]+):/g;

/**
 * Builds a CTA button from a paragraph like
 * `Check Premium :right-red-filled: :right-black-filled:`.
 * The first icon is the default one, the second is shown on hover.
 * @param {HTMLElement} p
 * @returns {HTMLAnchorElement}
 */
function createCta(p) {
  const link = p.querySelector('a[href]');
  const clone = p.cloneNode(true);
  clone.querySelectorAll('span.icon').forEach((span) => {
    const cls = [...span.classList].find((c) => c.startsWith('icon-'));
    span.replaceWith(cls ? `:${cls.substring(5)}:` : '');
  });
  const text = clone.textContent;
  const icons = [...text.matchAll(ICON_TOKEN)].map((m) => m[1]);
  const label = text.replace(ICON_TOKEN, '').replace(/[\s:]+$/, '').replace(/\s+/g, ' ').trim();

  const cta = document.createElement('a');
  cta.className = 'banner-v2-cta';
  cta.href = link?.getAttribute('href') || '#';
  if (link?.title) cta.title = link.title;
  moveInstrumentation(p, cta);

  const labelSpan = document.createElement('span');
  labelSpan.className = 'banner-v2-cta-label';
  labelSpan.textContent = label;

  const iconWrap = document.createElement('span');
  iconWrap.className = 'banner-v2-cta-icon';
  [icons[0] || 'right-red-filled', icons[1] || icons[0] || 'right-black-filled'].forEach((name) => {
    const icon = document.createElement('span');
    icon.className = `icon icon-${name}`;
    iconWrap.append(icon);
  });
  decorateIcons(iconWrap);

  cta.append(labelSpan, iconWrap);

  /* Temporarily commented out: Buy term insurance form toggle
   * (Uncomment this block and the rule in blocks/form/buy-term-insurance.css to re-enable)
  const isExpertCta = p.closest('.term-ins-banner') && /^talk to an expert$/i.test(label);
  if (isExpertCta) {
    cta.setAttribute('aria-expanded', 'false');
    cta.addEventListener('click', (event) => {
      event.preventDefault();
      const formSection = document.querySelector('.form-up-desktop .buy-term-insurance')
        ?.closest('.form-up-desktop');
      if (!formSection) return;

      if (formSection.classList.contains('is-open')) {
        cta.setAttribute('aria-expanded', 'true');
        return;
      }

      if (!formSection.id) formSection.id = 'term-insurance-form';
      formSection.classList.add('is-open');
      cta.setAttribute('aria-controls', formSection.id);
      cta.setAttribute('aria-expanded', 'true');
    });
  }
  */
  return cta;
}

/**
 * Formats a stat item into value and label spans
 * @param {HTMLElement} element
 * @returns {HTMLLIElement}
 */
function createStatItem(element) {
  const li = document.createElement('li');
  li.className = 'banner-v2-stat';
  moveInstrumentation(element, li);

  const strong = element.querySelector('strong, b');
  const innerHTML = element.innerHTML.trim();

  if (innerHTML.includes('<br') || innerHTML.includes('<BR')) {
    const parts = innerHTML.split(/<br\s*\/?>/i);
    const valueSpan = document.createElement('span');
    valueSpan.className = 'stat-value';
    valueSpan.innerHTML = parts[0].trim();

    const labelSpan = document.createElement('span');
    labelSpan.className = 'stat-label';
    labelSpan.innerHTML = parts.slice(1).join(' ').trim();

    li.appendChild(valueSpan);
    li.appendChild(labelSpan);
  } else if (strong) {
    const valueSpan = document.createElement('span');
    valueSpan.className = 'stat-value';
    valueSpan.innerHTML = strong.innerHTML;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'stat-label';

    const childNodes = [...element.childNodes];
    childNodes.forEach((node) => {
      if (node !== strong) {
        labelSpan.appendChild(node.cloneNode(true));
      }
    });

    li.appendChild(valueSpan);
    li.appendChild(labelSpan);
  } else {
    const text = element.textContent.trim();
    const parts = text.split(/\s+-\s+|\n/);
    if (parts.length > 1) {
      const valueSpan = document.createElement('span');
      valueSpan.className = 'stat-value';
      valueSpan.textContent = parts[0].trim();

      const labelSpan = document.createElement('span');
      labelSpan.className = 'stat-label';
      labelSpan.textContent = parts.slice(1).join(' ').trim();

      li.appendChild(valueSpan);
      li.appendChild(labelSpan);
    } else {
      const valueSpan = document.createElement('span');
      valueSpan.className = 'stat-value';
      valueSpan.textContent = text;
      li.appendChild(valueSpan);
    }
  }

  return li;
}

/**
 * Optimizes a background image URL to use AEM's modern webply format and target width.
 * @param {string} url The authored image URL
 * @param {string} [width] Target width (e.g. '2000' for desktop, '750' for mobile)
 * @returns {string} The optimized URL requesting webply format
 */
function getOptimizedBgUrl(url, width = '750') {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.href);
    parsed.searchParams.set('format', 'webply');
    parsed.searchParams.set('optimize', 'medium');
    if (width) parsed.searchParams.set('width', width);
    return parsed.href;
  } catch {
    let optUrl = url.replace(/format=[a-z0-9]+/i, 'format=webply');
    if (!optUrl.includes('format=webply')) {
      const sep = optUrl.includes('?') ? '&' : '?';
      optUrl += `${sep}format=webply&optimize=medium`;
    }
    if (width && optUrl.includes('width=')) {
      optUrl = optUrl.replace(/width=\d+/i, `width=${width}`);
    }
    return optUrl;
  }
}

/**
 * Decorates the banner-v2 block
 * @param {Element} block The banner-v2 block element
 */
export default async function decorate(block) {
  if (window.self !== window.top) {
    block.classList.add('is-editor');
  }

  // Set section background CSS variables if defined in section dataset
  const section = block.closest('.section');
  if (section) {
    const desktopBg = section.dataset.backgroundImage;
    const mobileBg = section.dataset.backgroundimageMobile;
    if (desktopBg) {
      section.style.setProperty('--section-bg-desktop', `url('${getOptimizedBgUrl(desktopBg, '2000')}')`);
    }
    if (mobileBg) {
      section.style.setProperty('--section-bg-mobile', `url('${getOptimizedBgUrl(mobileBg, '750')}')`);
    }
  }

  // Collect visual pictures authored in the block
  const pictures = [...block.querySelectorAll('picture')];

  let desktopVisual = null;
  let mobileVisual = null;

  if (pictures.length >= 2) {
    [desktopVisual, mobileVisual] = pictures;
  } else if (pictures.length === 1) {
    [desktopVisual] = pictures;
  }

  // Create content wrapper
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'banner-v2-content';

  // Process text elements and rows
  const rows = [...block.children];
  const headings = [];
  const descriptions = [];
  const statItems = [];
  const ctaItems = [];

  rows.forEach((row) => {
    // Only transfer row-level instrumentation for text content rows
    if (!row.querySelector('picture')) {
      moveInstrumentation(row, contentWrapper);
    }

    // Extract headings
    row.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      headings.push(h);
    });

    // Extract lists (if authored as ul/ol)
    row.querySelectorAll('ul > li, ol > li').forEach((li) => {
      const link = li.querySelector('a[href]');
      if (link) {
        const linkClone = link.cloneNode(true);
        const textWithoutLink = li.textContent.replace(link.textContent, '').trim();
        if (!textWithoutLink) {
          // Entire li is a CTA link
          const ctaP = document.createElement('p');
          ctaP.appendChild(linkClone);
          moveInstrumentation(li, ctaP);
          ctaItems.push(ctaP);
          return;
        }
        // Li has feature text AND a CTA link: extract CTA and clean feature text
        const ctaP = document.createElement('p');
        ctaP.appendChild(linkClone);
        ctaItems.push(ctaP);
        link.remove();
      }
      statItems.push(li);
    });

    // Extract paragraphs (if not part of picture-only containers)
    row.querySelectorAll('p').forEach((p) => {
      if (p.querySelector('picture') && p.textContent.trim() === '') {
        return;
      }
      if (!p.textContent.trim()) {
        return;
      }

      // If paragraph contains <br> or comes after the main description, treat as stat item
      const isBrStat = p.innerHTML.includes('<br') || p.innerHTML.includes('<BR');
      const hasLinkOrIcon = p.querySelector('a, span.icon') || /:[\w-]+:/.test(p.textContent);
      const isStandaloneLink = hasLinkOrIcon && (
        p.querySelector('a[href]')?.textContent.trim() === p.textContent.trim()
        || /^\s*(Check Premium|Know Your Premium|Learn More|Apply Now|Buy Now|Get Started)/i.test(p.textContent)
      );
      const isCta = !isBrStat && ((descriptions.length >= 1 && hasLinkOrIcon) || isStandaloneLink);

      if (isCta) {
        ctaItems.push(p);
      } else if (isBrStat || descriptions.length >= 1) {
        statItems.push(p);
      } else {
        descriptions.push(p);
      }
    });
  });

  // Check if this is a product page banner variation
  const isProductBanner = block.classList.contains('product-banner')
    || (block.classList.contains('term-ins-banner') && (
      statItems.some((s) => /kotak/i.test(s.textContent) || s.textContent.trim().toLowerCase() === 'badge')
      || descriptions.some((d) => d.textContent.trim().toLowerCase() === 'badge')
    ));

  if (isProductBanner) {
    block.classList.add('product-banner');

    // 1. Extract badge text
    let badgeText = '';
    const badgeDescIdx = descriptions.findIndex((p) => /badge/i.test(p.textContent) || p.textContent.trim().length <= 20);
    if (badgeDescIdx !== -1) {
      badgeText = descriptions.splice(badgeDescIdx, 1)[0].textContent.trim();
    } else {
      const badgeStatIdx = statItems.findIndex((s) => /badge/i.test(s.textContent));
      if (badgeStatIdx !== -1) {
        badgeText = statItems.splice(badgeStatIdx, 1)[0].textContent.trim();
      }
    }

    // 2. Extract product title text
    let productTitleText = '';
    const kotakStatIdx = statItems.findIndex((s) => /kotak/i.test(s.textContent));
    if (kotakStatIdx !== -1) {
      productTitleText = statItems.splice(kotakStatIdx, 1)[0].textContent.trim();
    } else if (descriptions.length > 0) {
      productTitleText = descriptions.shift().textContent.trim();
    } else if (headings.length > 1) {
      productTitleText = headings.shift().textContent.trim();
    }

    // Append Product Card at top of content (Figma 7738:26173 / 7738:26496)
    if (badgeText || productTitleText) {
      const card = document.createElement('div');
      card.className = 'banner-v2-product-card';
      if (badgeText) {
        const badge = document.createElement('span');
        badge.className = 'banner-v2-badge';
        badge.textContent = badgeText;
        card.appendChild(badge);
      }
      if (productTitleText) {
        const prodTitle = document.createElement('h3');
        prodTitle.className = 'banner-v2-product-title';
        prodTitle.textContent = productTitleText;
        card.appendChild(prodTitle);
      }
      contentWrapper.appendChild(card);
    }

    // Append headings
    headings.forEach((h) => {
      h.classList.add('banner-v2-title');
      contentWrapper.appendChild(h);
    });

    // Append remaining descriptions if any
    descriptions.forEach((p) => {
      p.classList.add('banner-v2-description');
      contentWrapper.appendChild(p);
    });

    // Safety check: ensure CTA is not stuck in statItems or descriptions if ctaItems is empty
    if (ctaItems.length === 0) {
      const ctaStatIdx = statItems.findIndex((s) => s.querySelector('a[href]'));
      if (ctaStatIdx !== -1) {
        ctaItems.push(statItems.splice(ctaStatIdx, 1)[0]);
      } else {
        const ctaDescIdx = descriptions.findIndex((d) => d.querySelector('a[href]'));
        if (ctaDescIdx !== -1) {
          ctaItems.push(descriptions.splice(ctaDescIdx, 1)[0]);
        }
      }
    }

    // Append key benefit features as checkmark list
    if (statItems.length > 0) {
      const featuresList = document.createElement('ul');
      featuresList.className = 'banner-v2-features';
      statItems.forEach((item) => {
        const clone = item.cloneNode(true);
        // Strip any nested link elements from feature bullet text
        clone.querySelectorAll('a[href]').forEach((a) => a.remove());
        const cleanText = clone.textContent.trim();
        if (!cleanText) return;

        const li = document.createElement('li');
        li.className = 'banner-v2-feature';
        moveInstrumentation(item, li);

        const icon = document.createElement('span');
        icon.className = 'banner-v2-feature-icon';
        icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="white" stroke-width="1.2"/><path d="M5 8.2L7 10.2L11.2 6" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

        const textSpan = document.createElement('span');
        textSpan.className = 'banner-v2-feature-text';
        textSpan.textContent = cleanText;

        li.append(icon, textSpan);
        featuresList.appendChild(li);
      });
      contentWrapper.appendChild(featuresList);
    }

    if (ctaItems.length > 0) {
      const actionsWrapper = document.createElement('div');
      actionsWrapper.className = 'banner-v2-actions';
      ctaItems.forEach((p) => actionsWrapper.appendChild(createCta(p)));
      contentWrapper.appendChild(actionsWrapper);
    }
  } else {
    // Append headings
    headings.forEach((h) => {
      h.classList.add('banner-v2-title');
      contentWrapper.appendChild(h);
    });

    // Append description
    descriptions.forEach((p) => {
      p.classList.add('banner-v2-description');
      contentWrapper.appendChild(p);
    });

    // Append stats as an unordered list
    if (statItems.length > 0) {
      const statsList = document.createElement('ul');
      statsList.className = 'banner-v2-stats';
      statItems.forEach((item) => {
        const statLi = createStatItem(item);
        statsList.appendChild(statLi);
      });
      contentWrapper.appendChild(statsList);
    }

    if (ctaItems.length > 0) {
      const actionsWrapper = document.createElement('div');
      actionsWrapper.className = 'banner-v2-actions';
      ctaItems.forEach((p) => actionsWrapper.appendChild(createCta(p)));
      contentWrapper.appendChild(actionsWrapper);
    }
  }

  // Prepare visual wrapper (Desktop & Mobile)
  let visualWrapper = null;
  if (desktopVisual || mobileVisual) {
    visualWrapper = document.createElement('div');
    visualWrapper.className = 'banner-v2-visual';

    if (desktopVisual && mobileVisual) {
      const deskContainer = document.createElement('div');
      deskContainer.className = 'banner-v2-visual-desktop';
      const p1 = desktopVisual.parentElement;
      if (p1 && (p1.tagName === 'P' || p1.tagName === 'DIV')) {
        moveInstrumentation(p1, deskContainer);
      }
      deskContainer.appendChild(desktopVisual);

      const mobContainer = document.createElement('div');
      mobContainer.className = 'banner-v2-visual-mobile';
      const p2 = mobileVisual.parentElement;
      if (p2 && (p2.tagName === 'P' || p2.tagName === 'DIV')) {
        moveInstrumentation(p2, mobContainer);
      }
      mobContainer.appendChild(mobileVisual);

      visualWrapper.append(deskContainer, mobContainer);
    } else if (desktopVisual) {
      const deskContainer = document.createElement('div');
      deskContainer.className = 'banner-v2-visual-desktop banner-v2-visual-single';
      const p1 = desktopVisual.parentElement;
      if (p1 && (p1.tagName === 'P' || p1.tagName === 'DIV')) {
        moveInstrumentation(p1, deskContainer);
      }
      deskContainer.appendChild(desktopVisual);

      visualWrapper.appendChild(deskContainer);
    }
  }

  // Prepare centered 1200px inner container (confines content + visual to 1200px)
  const innerWrapper = document.createElement('div');
  innerWrapper.className = 'banner-v2-inner';
  if (contentWrapper.children.length > 0) {
    innerWrapper.appendChild(contentWrapper);
  }
  if (visualWrapper) {
    innerWrapper.appendChild(visualWrapper);
  }

  // Re-assemble block cleanly
  block.replaceChildren(innerWrapper);

  // Insurance Guide Banner style: its own scoped styles and behaviour
  if (block.classList.contains('insurance-guide-banner')) {
    const { default: decorateInsuranceGuide } = await import('./banner-v2-insurance-guide.js');
    await decorateInsuranceGuide(block);
  }

  // Contact Us Banner style: its own scoped styles
  if (block.classList.contains('contact-us-banner')) {
    const { default: decorateContactUs } = await import('./banner-v2-contact-us.js');
    await decorateContactUs(block);
  }
}
