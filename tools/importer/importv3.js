/* global WebImporter */

const sanitizeHref = (href) => {
  if (!href) return '';
  const trimmed = href.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') || /^javascript/i.test(trimmed)) {
    return trimmed;
  }
  const cleaned = trimmed.replace(/^https?:\/\/(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|(www\.)?kotaklife\.com)/i, '');
  if (!cleaned) return '/';
  return cleaned.startsWith('/') || cleaned.startsWith('http') ? cleaned : `/${cleaned}`;
};

const sanitizeAllLinks = (main) => {
  main.querySelectorAll('a[href]').forEach((a) => {
    const rawHref = a.getAttribute('href');
    if (rawHref) {
      a.setAttribute('href', sanitizeHref(rawHref));
    }
  });
};

const getPathname = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return '/';
  }
  const strippedValue = value.replace(/^https?:\/\/[^/]+/i, '');
  return strippedValue.split(/[?#]/)[0] || '/';
};

// Falls back to <body> if the expected wrapper class is missing
const selectContentRoot = (document) => document.querySelector('.best-invest.best-invest1.outer') || document.querySelector('.best-invest.outer') || document.body;

const removeGlobalNoise = (main) => {
  WebImporter.DOMUtils.remove(main, [
    '.blog-bradcrumb',
    '.breadcrumb',
    'article.breadcrumb',
    '[class*="bradcrum"]',
    '[class*="breadcrum"]',
    '.menu.bottomRight',
    '.kotak-eterm-plan-popup',
    '.blog-social-meida',
    '.reddiv',
    '.hide-mobile',
    '.also-readd',
    '.kotak-e-term-plan',
    '.suggestion',
    '.saving-token',
    '.new-footer.mt-0',
    'footer',
    '#scrollTopBtn',
    '.go_to_top',
    '.overlay',
    'script', 'style', 'noscript', 'form', 'select', 'input', 'textarea',
  ]);
};

/**
 * SANITIZE MALFORMED HEADINGS
 * Fixes broken source HTML where an <h2> tag illegally wraps <div> containers
 * (such as Accordions or Suggested Readings sections).
 */
const fixMalformedHeadings = (main) => {
  const headings = [...main.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  headings.forEach((heading) => {
    // If a heading tag contains block-level elements, unwrap it into a neutral <div>
    if (heading.querySelector('div, section, ul, ol, table, article')) {
      const div = document.createElement('div');
      div.className = heading.className;
      div.append(...heading.childNodes);
      heading.replaceWith(div);
    }
  });
};

/**
 * SANITIZE MALFORMED BLOCK AND LIST HIERARCHY
 * 1. Unwraps inline tags (<span>, <a>, <b>, etc.) when they illegally wrap block elements
 *    (e.g. <span id="topic1"> wrapping <h2>, <p>, <ul>, <table>, <div>).
 * 2. Fixes unclosed or malformed <ul>/<ol> lists where block-level elements
 *    (like <h2>, <table>, <p>, <div>) were accidentally swallowed into the list.
 */
const fixMalformedHierarchy = (main) => {
  // 1. Unwrap inline elements wrapping block-level elements (preserve author tooltip)
  const inlines = [...main.querySelectorAll('span, b, strong, em, i')];
  inlines.forEach((el) => {
    if (el.closest('.authorBox, .tooltiptext')) return;
    if (el.querySelector('h1, h2, h3, h4, h5, h6, p, ul, ol, table, div, section, article')) {
      el.replaceWith(...el.childNodes);
    }
  });

  // 2. Fix lists that swallowed block-level elements
  const lists = [...main.querySelectorAll('ul, ol')];
  lists.forEach((list) => {
    const hasDirectNonLi = [...list.children].some((c) => c.tagName !== 'LI');
    const hasLiWithBlocks = [...list.querySelectorAll(':scope > li')].some((li) => (
      li.querySelector('h1, h2, h3, h4, h5, h6, table, .accordion-div, .authorBox')
    ));

    if (!hasDirectNonLi && !hasLiWithBlocks) return;

    // Flatten any block elements out of li elements
    [...list.querySelectorAll(':scope > li')].forEach((li) => {
      const illegalBlocks = [
        ...li.querySelectorAll('h1, h2, h3, h4, h5, h6, table, .accordion-div, .authorBox'),
      ];
      if (illegalBlocks.length) {
        illegalBlocks.forEach((block) => {
          li.after(block);
        });
      }
    });

    // Split the list at every non-li child
    let currentList = null;
    const fragment = main.ownerDocument.createDocumentFragment();

    [...list.childNodes].forEach((node) => {
      if (node.nodeType === 3 && !node.textContent.trim()) {
        return;
      }
      if (node.nodeType === 1 && node.tagName === 'LI') {
        if (!currentList) {
          currentList = main.ownerDocument.createElement(list.tagName.toLowerCase());
          if (list.className) currentList.className = list.className;
          fragment.append(currentList);
        }
        currentList.append(node);
      } else {
        currentList = null;
        fragment.append(node);
      }
    });

    list.replaceWith(fragment);
  });
};

/**
 * FIX RELATIVE IMAGE PATHS
 * Strips out incorrect intermediate page paths (like /insurance-guide/protection/)
 * and forces the image to resolve from the absolute /assets/images/ root.
 */
const fixImageUrls = (main) => {
  const images = [...main.querySelectorAll('img')];

  images.forEach((img) => {
    const currentSrc = img.src || img.getAttribute('src');

    // Check if the image contains the standard asset path but is resolving wrong
    if (currentSrc && currentSrc.includes('/assets/images/')) {
      // Extract everything from '/assets/images/' to the end of the URL
      const assetPath = currentSrc.substring(currentSrc.indexOf('/assets/images/'));

      // Rewrite the src to point to the correct absolute URL
      img.src = `https://www.kotaklife.com${assetPath}`;
    }
  });
};

const SUPERSCRIPT_MAP = {
  0: '⁰',
  1: '¹',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ',
  '*': '*',
};

const SUBSCRIPT_MAP = {
  0: '₀',
  1: '₁',
  2: '₂',
  3: '₃',
  4: '₄',
  5: '₅',
  6: '₆',
  7: '₇',
  8: '₈',
  9: '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  a: 'ₐ',
  e: 'ₑ',
  o: 'ₒ',
  x: 'ₓ',
};

/**
 * SANITIZE REDUNDANT HEADING FORMATTING
 * 1. Converts <sup> and <sub> tags inside headings to Unicode characters so that
 *    the importer's title serializer does not drop them and their content.
 * 2. Removes <b> and <strong> tags from inside headings to prevent
 *    the markdown parser from escaping them into literal text.
 */
const cleanHeadingFormatting = (main) => {
  const headings = [...main.querySelectorAll('h1, h2, h3, h4, h5, h6')];

  headings.forEach((heading) => {
    heading.querySelectorAll('sup').forEach((sup) => {
      const text = sup.textContent.trim();
      const unicodeSup = text.split('').map((char) => SUPERSCRIPT_MAP[char] || char).join('');
      sup.replaceWith(heading.ownerDocument.createTextNode(unicodeSup));
    });

    heading.querySelectorAll('sub').forEach((sub) => {
      const text = sub.textContent.trim();
      const unicodeSub = text.split('').map((char) => SUBSCRIPT_MAP[char] || char).join('');
      sub.replaceWith(heading.ownerDocument.createTextNode(unicodeSub));
    });

    const boldTags = [...heading.querySelectorAll('b, strong')];
    boldTags.forEach((b) => {
      // Replace the <b> tag with its inner text, removing the HTML wrapper
      b.replaceWith(...b.childNodes);
    });
  });
};

/**
 * HELPER: Creates a Section Metadata table and appends a section break (---)
 * STRICT PLACEMENT: Must be siblings of the content wrapper.
 */
const appendSectionMetadata = (element, style, document, addBreak = true, extraRows = []) => {
  const rows = [
    ['Section Metadata'],
    ['style', style],
  ];

  if (Array.isArray(extraRows)) {
    extraRows.forEach((row) => {
      if (Array.isArray(row) && row.length === 2) {
        rows.push(row);
      }
    });
  }

  const sectionMetaData = WebImporter.DOMUtils.createTable(rows, document);

  element.after(sectionMetaData);
  // Only add the hr if requested
  if (addBreak) {
    sectionMetaData.after(document.createElement('hr'));
  }
};

const isValidHeroCtaHref = (rawHref) => {
  if (!rawHref) return false;
  const trimmed = rawHref.trim();
  return Boolean(
    trimmed
    && trimmed !== '#'
    && !/^javascript/i.test(trimmed)
    && !/\.(png|jpe?g|webp|svg|gif)(\?|$)/i.test(trimmed),
  );
};

const extractHeroUpdatedDate = (container) => {
  if (!container) return '';
  const dateEl = [...container.querySelectorAll('.sec_para p, .sec_para, .blogs-ul li, p')]
    .find((el) => /(?:Blog\s+)?Updated\s+on/i.test(el.textContent));
  if (dateEl) {
    const clone = dateEl.cloneNode(true);
    clone.querySelectorAll('.smile_ai, .smile_div').forEach((el) => el.remove());
    const text = clone.textContent;

    const hasBlog = /Blog\s+Updated\s+on/i.test(text);
    const prefix = hasBlog ? 'Blog Updated on:' : 'Updated on:';

    // Match exact date formats after 'Updated on:'
    const mdyMatch = text.match(/(?:Blog\s+)?Updated\s+on\s*:?\s*([A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i);
    if (mdyMatch) return `${prefix} ${mdyMatch[1].trim()}`;

    const dmyMatch = text.match(/(?:Blog\s+)?Updated\s+on\s*:?\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9},?\s*\d{4})/i);
    if (dmyMatch) return `${prefix} ${dmyMatch[1].trim()}`;

    const numMatch = text.match(/(?:Blog\s+)?Updated\s+on\s*:?\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i);
    if (numMatch) return `${prefix} ${numMatch[1].trim()}`;

    const generalMatch = text.match(/(?:Blog\s+)?Updated\s+on\s*:?\s*([^<·|\n\r]+?)(?=\s*(?:Human|\bno AI\b|[·|]|$))/i);
    if (generalMatch) {
      const rawDate = generalMatch[1].replace(/[\s\u00A0·|]+$/, '').trim();
      if (rawDate) return `${prefix} ${rawDate}`;
    }
  }
  const fallbackEl = [...container.querySelectorAll('.sec_para p, .sec_para, .blogs-ul li, p')]
    .find((el) => /[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}/.test(el.textContent));
  if (fallbackEl) {
    const clone = fallbackEl.cloneNode(true);
    clone.querySelectorAll('.smile_ai, .smile_div').forEach((el) => el.remove());
    const match = clone.textContent.match(/([A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/);
    if (match) {
      const hasBlog = /Blog\s+Updated\s+on/i.test(clone.textContent);
      const prefix = hasBlog ? 'Blog Updated on:' : 'Updated on:';
      return `${prefix} ${match[1].trim()}`;
    }
  }
  return '';
};

const createInsuBannerSection = (main, document, heroContainer, {
  h1,
  desc,
  ctaLink,
  ctaText,
  viewsText,
  dateText,
}) => {
  // 1. Row 1: Heading, Description & CTA (field "text" in models/_insu-banner.json)
  const textCell = document.createElement('div');
  if (h1) {
    textCell.append(h1.cloneNode(true));
  }

  if (desc) {
    textCell.append(desc);
  }

  const rawCtaHref = ctaLink ? (ctaLink.getAttribute('href') || ctaLink.href) : '';
  if (ctaLink && isValidHeroCtaHref(rawCtaHref) && ctaText) {
    const ctaP = document.createElement('p');
    const ctaA = document.createElement('a');
    ctaA.href = sanitizeHref(rawCtaHref);
    ctaA.textContent = ctaText;
    if (ctaLink.title) ctaA.title = ctaLink.title;
    if (ctaLink.target) ctaA.target = ctaLink.target;
    ctaP.append(ctaA);
    textCell.append(ctaP);
  }

  // 2. Row 2: Updated Date / Read Time (field "readTime" in models/_insu-banner.json)
  const readTimeCell = document.createElement('div');
  const readTimeP = document.createElement('p');
  if (dateText) {
    readTimeP.textContent = dateText;
  } else {
    const wordCount = (main.textContent || '').trim().split(/\s+/).length;
    const readMinutes = Math.max(1, Math.ceil(wordCount / 200));
    readTimeP.textContent = `${readMinutes} Mins read`;
  }
  readTimeCell.append(readTimeP);

  // 3. Row 3: Views (field "views" in models/_insu-banner.json)
  const viewsCell = document.createElement('div');
  const viewsP = document.createElement('p');
  viewsP.textContent = viewsText || '94 view';
  viewsCell.append(viewsP);

  const imageCell = document.createElement('div');
  const damOrigin = 'https://publish-p190053-e2194583.adobeaemcloud.com';
  const images = [
    ['/content/dam/kotaklife-eds/insurance-guide/blogs/insu-banner/insurance-banner-desktop-bg.png', 'Line art illustration connecting video, podcast, and chat icons representing multimedia content'],
    ['/content/dam/kotaklife-eds/insurance-guide/blogs/insu-banner/insurance-guilde-mobile-banner.png', 'Line art illustration connecting video, podcast, and chat icons representing multimedia content'],
  ];

  images.forEach(([path, alt]) => {
    const paragraph = document.createElement('p');
    const image = document.createElement('img');
    image.src = new URL(path, damOrigin).href;
    image.alt = alt;
    paragraph.append(image);
    imageCell.append(paragraph);
  });

  const insuBannerBlock = WebImporter.DOMUtils.createTable([
    ['Insu Banner'],
    [textCell],
    [readTimeCell],
    [viewsCell],
    [imageCell],
  ], document);

  heroContainer.replaceWith(insuBannerBlock);
  if (typeof appendSectionMetadata === 'function') {
    appendSectionMetadata(insuBannerBlock, 'blog-banner', document, true, [['nav-theme', 'light']]);
  } else {
    insuBannerBlock.after(document.createElement('hr'));
  }
};

/**
 * HERO BANNER (INSU BANNER)
 * Converts .blog-head into an 'Insu Banner' block table aligned 1:1 with the
 * component model (_insu-banner.json):
 * Row 0: Insu Banner (Header)
 * Row 1: text (Heading, Description, and CTA button link in one richtext cell)
 * Row 2: readTime (e.g. "5 Mins read")
 * Row 3: views (e.g. "24,975 view")
 * Row 4: images (Desktop first, then mobile, each with alt text)
 */
const buildHeroBanner = (main, document) => {
  const blogHead = main.querySelector('.blog-head') || main.querySelector('.best-card');
  if (!blogHead) return;

  const h1 = blogHead.querySelector('h1') || blogHead.querySelector('h2');
  if (!h1) {
    blogHead.remove();
    return;
  }

  const rawDesc = blogHead.querySelector('.text-center > p, .best-card p, p');
  const desc = rawDesc ? rawDesc.cloneNode(true) : null;

  const ctaSelectors = [
    '.btnLink a',
    '.new_drp_dwn .drpwn-label a',
    '.drpwn-wrapper .drpwn-label a',
    '.drpwn-label a',
    '.new_drp_dwn .drpwn-toggle a',
    '.drpwn-wrapper .drpwn-toggle a',
    '.drpwn-menu li a',
    '.new_drp_dwn a',
    '.drpwn-wrapper a',
    'a[href*="blog_cta"]',
    'a.popup-term-btn',
    '.kotak-eterm-plan-popup a',
    '.insu-banner-cta',
  ];

  let btnLink = [...blogHead.querySelectorAll(ctaSelectors.join(', '))].find((a) => (
    isValidHeroCtaHref(a.getAttribute('href') || a.href)
  ));

  if (!btnLink) {
    btnLink = [...blogHead.querySelectorAll('.views-blogs a')].find((a) => {
      if (a.closest('.blog-social-meida, .social__icons, .blog-bradcrumb, .menu.bottomRight, .blogs-ul')) {
        return false;
      }
      return isValidHeroCtaHref(a.getAttribute('href') || a.href);
    });
  }

  let ctaText = '';
  if (btnLink) {
    ctaText = btnLink.textContent.trim();
    if (!ctaText) {
      const parentLabel = btnLink.closest('.drpwn-wrapper, .new_drp_dwn')?.querySelector('.drpwn-label');
      if (parentLabel && parentLabel.textContent.trim()) {
        ctaText = parentLabel.textContent.trim();
      }
    }
    if (!ctaText) {
      ctaText = btnLink.getAttribute('title') || btnLink.getAttribute('aria-label') || 'Buy Online';
    }
  }

  const viewsLi = blogHead.querySelector('.blogs-ul li:first-child');
  let viewsText = '';
  if (viewsLi) {
    const match = viewsLi.textContent.match(/([\d,]+)\s*Views?/i);
    if (match) {
      viewsText = `${match[1]} view`;
    } else {
      viewsText = viewsLi.textContent.split('|')[0].trim();
    }
  }

  const dateText = extractHeroUpdatedDate(blogHead);

  createInsuBannerSection(main, document, blogHead, {
    h1,
    desc,
    ctaLink: btnLink,
    ctaText,
    viewsText: viewsText || '94 view',
    dateText,
  });
};

/**
 * SUPPORTING HERO BANNER (.new_term_supporting -> INSU BANNER)
 * Converts .new_term_supporting into an 'Insu Banner' block table:
 * - Preserves h1 and full description (.short-text + .more-text without .read-toggle)
 * - Ignores #ulip_disclaimer above the hero row
 * - Maps .calculate-btn / .back_supportt CTA and .sec_para view count
 */
const buildTermSupportingHeroBanner = (main, document) => {
  const termBanner = main.querySelector('.new_term_supporting');
  if (!termBanner) return;

  const h1 = termBanner.querySelector('.term_sup_txt h1, .term_sup_txt h2, h1, h2');

  const rawDesc = termBanner.querySelector('.term_sup_txt p.hero-desc, .term_sup_txt p.investmentDesc, p.hero-desc, p.investmentDesc')
    || [...termBanner.querySelectorAll('.term_sup_txt p')].find((p) => (
      !p.closest('.sec_para, .smile_ai, .calculate-btn, .back_supportt')
      && !/investment risk.*borne by/i.test(p.textContent)
      && p.textContent.trim()
    ));

  let desc = null;
  if (rawDesc) {
    const descClone = rawDesc.cloneNode(true);
    descClone.querySelectorAll('.read-toggle').forEach((toggle) => toggle.remove());
    descClone.querySelectorAll('.short-text, .more-text').forEach((span) => {
      span.replaceWith(...span.childNodes);
    });
    descClone.normalize();
    if (descClone.firstChild?.nodeType === 3) {
      descClone.firstChild.textContent = descClone.firstChild.textContent.replace(/^\s+/, '');
    }
    if (descClone.lastChild?.nodeType === 3) {
      descClone.lastChild.textContent = descClone.lastChild.textContent.replace(/\s+$/, '');
    }
    if (descClone.textContent.trim()) {
      const cleanDesc = document.createElement('p');
      cleanDesc.append(...descClone.childNodes);
      desc = cleanDesc;
    }
  }

  const ctaSelectors = [
    '.calculate-btn a',
    '.back_supportt a',
    '.btnLink a',
    'a[href*="blog_cta"]',
    '.insu-banner-cta',
  ];
  let btnLink = null;
  ctaSelectors.some((selector) => {
    btnLink = [...termBanner.querySelectorAll(selector)].find((a) => (
      isValidHeroCtaHref(a.getAttribute('href') || a.href)
    ));
    return Boolean(btnLink);
  });

  const ctaText = btnLink
    ? (btnLink.textContent.replace(/\s+/g, ' ').trim()
      || btnLink.getAttribute('title')
      || btnLink.getAttribute('aria-label')
      || 'Buy Online')
    : '';

  const viewsEl = [...termBanner.querySelectorAll('.sec_para p, .sec_para, .blogs-ul li:first-child')]
    .find((el) => /([\d,]+)\s*Views?/i.test(el.textContent));
  const viewsMatch = viewsEl?.textContent.match(/([\d,]+)\s*Views?/i);
  const viewsText = viewsMatch ? `${viewsMatch[1]} view` : '94 view';

  const dateText = extractHeroUpdatedDate(termBanner);

  const targetContainer = termBanner.closest('.new_layput_section, .new_layout_section') || termBanner;
  createInsuBannerSection(main, document, targetContainer, {
    h1,
    desc,
    ctaLink: btnLink,
    ctaText,
    viewsText,
    dateText,
  });
};

const createEmbedBlocks = (main, document) => {
  const iframes = [...main.querySelectorAll('iframe')].filter(
    (iframe) => !iframe.closest('.also-read, #leadformem, [id*="leadform"]'),
  );
  iframes.forEach((iframe) => {
    const src = iframe.getAttribute('src');
    if (!src) {
      iframe.remove();
      return;
    }
    const link = document.createElement('a');
    link.href = src;
    link.textContent = src;

    const embedBlock = WebImporter.DOMUtils.createTable([
      ['Embed (yt-video)'],
      [link],
    ], document);

    iframe.replaceWith(embedBlock);
  });
};

/**
 * REPOSITION AUTHOR CARDS BEFORE FAQ
 * Ensures the Author Card is placed above the FAQ Accordion in the document flow.
 */
const repositionAuthorCardsBeforeFaq = (main) => {
  const authorBoxes = [...main.querySelectorAll('.authorBox')];
  if (!authorBoxes.length) return;

  const wrapper = main.querySelector('.accordion-div');
  const borItems = [...main.querySelectorAll('.bor')];
  const target = wrapper || borItems[0];
  if (!target) return;

  const prev = target.previousElementSibling;
  const isFaqHeading = prev
    && (/^h[1-6]$/i.test(prev.tagName) || prev.textContent.toLowerCase().includes('faq'));
  const faqInsertionPoint = isFaqHeading ? prev : target;

  authorBoxes.forEach((box) => {
    faqInsertionPoint.before(box);
  });
};

/**
 * FAQ ACCORDIONS
 * Converts .bor items into an 'Accordion (faq-v2, blog-faq)' block table
 * in its own dedicated section delimited by section breaks.
 */
const appendFaqAccordion = (main, document) => {
  const borItems = [...main.querySelectorAll('.bor')];
  if (!borItems.length) return;

  const items = [];

  borItems.forEach((item) => {
    const question = item.querySelector('.accordion h3, h3, h4');
    const answer = item.querySelector('.panel');

    if (question && answer) {
      const qClone = question.cloneNode(true);
      let qText = qClone.textContent.trim().replace(/[\n\r\t]+/g, ' ');
      qText = qText.replace(/:plus:|:minus:/g, '').trim();
      qClone.textContent = `${qText} :plus: :minus:`;
      items.push([qClone, answer.cloneNode(true)]);
    }
  });

  if (!items.length) return;

  const accordionBlock = WebImporter.DOMUtils.createTable([
    ['Accordion (faq-v2, blog-faq)'],
    ...items,
  ], document);

  const wrapper = main.querySelector('.accordion-div');
  const target = wrapper || borItems[0];
  const prev = target.previousElementSibling;
  const isFaqHeading = prev
    && (/^h[1-6]$/i.test(prev.tagName) || prev.textContent.toLowerCase().includes('faq'));

  if (wrapper) {
    wrapper.replaceWith(accordionBlock);
  } else {
    borItems[0].replaceWith(accordionBlock);
  }

  // Clean up remaining duplicate .bor elements
  borItems.slice(1).forEach((bor) => bor.remove());

  // Check if a section break already exists before the FAQ (e.g. after the Author Card)
  const hasPriorBreak = (el) => {
    if (!el) return false;
    let check = el.previousElementSibling;
    while (check) {
      if (check.tagName === 'HR' || (check.tagName === 'TABLE' && check.textContent.includes('Section Metadata'))) {
        return true;
      }
      check = check.previousElementSibling;
    }
    return false;
  };

  const faqStartEl = isFaqHeading ? prev : accordionBlock;
  if (!hasPriorBreak(faqStartEl)) {
    if (faqStartEl.previousElementSibling && typeof appendSectionMetadata === 'function') {
      appendSectionMetadata(faqStartEl.previousElementSibling, 'column-left-section, blog-content', document, true);
    } else {
      faqStartEl.before(document.createElement('hr'));
    }
  }

  // Seal the FAQ Accordion section so it belongs to the left column
  if (typeof appendSectionMetadata === 'function') {
    appendSectionMetadata(accordionBlock, 'column-left-section, blog-content', document, true);
  } else {
    accordionBlock.after(document.createElement('hr'));
  }
};

// Wraps .insuranceSections elements inside an RTE V2 block with the 'card-border-red' class
const buildInsuranceSectionsBlocks = (main, document) => {
  const insuranceSections = [...main.querySelectorAll('.insuranceSections')];
  if (!insuranceSections.length) return;

  insuranceSections.forEach((section) => {
    const blogBoxes = [...section.querySelectorAll('.blogBox')];
    const list = document.createElement('ul');

    blogBoxes.forEach((box) => {
      const heading = box.querySelector('h3');
      if (!heading) return;

      const li = document.createElement('li');
      li.append(heading.cloneNode(true));

      const paragraph = box.querySelector('p');
      if (paragraph) {
        const innerLi = document.createElement('li');
        innerLi.append(...paragraph.cloneNode(true).childNodes);
        const innerUl = document.createElement('ul');
        innerUl.append(innerLi);
        li.append(innerUl);
      }

      list.append(li);
    });

    const rteBlock = WebImporter.DOMUtils.createTable([
      ['RTE V2 (card-border-red)'],
      [list],
    ], document);

    section.replaceWith(rteBlock);
  });
};

// Converts author box to Author Card block and seals the first column section
const buildProfileCards = (main, document) => {
  const authorBoxes = [...main.querySelectorAll('.authorBox')];
  if (!authorBoxes.length) {
    const firstRightCol = main.querySelector('.also-read, .also-readd, .check-calculators, .bookmarks-links, .category-links');
    if (firstRightCol && firstRightCol.previousElementSibling) {
      const prevEl = firstRightCol.previousElementSibling;
      const isAlreadyBreak = prevEl.tagName === 'HR'
        || (prevEl.tagName === 'TABLE' && prevEl.textContent.includes('Section Metadata'));
      if (!isAlreadyBreak && typeof appendSectionMetadata === 'function') {
        appendSectionMetadata(prevEl, 'column-left-section, blog-content', document);
      }
    }
    return;
  }

  authorBoxes.forEach((box, index) => {
    const photoCell = document.createElement('div');
    const authorCell = document.createElement('div');
    const linkCell = document.createElement('div');
    const bioCell = document.createElement('div');

    const nameElement = box.querySelector('.nameTag') || box.querySelector('.author-name');
    const authorName = nameElement ? nameElement.textContent.trim() : '';
    const existingImg = box.querySelector('.authorImg img') || box.querySelector('img');
    const imgSrc = existingImg ? (existingImg.getAttribute('src') || existingImg.src || '') : '';

    // 1. Photo Row: DAM image for Prasad Pimple, or existing author image for others
    const isPrasadPimple = /prasad/i.test(authorName) || /prasad/i.test(imgSrc);
    const photoP = document.createElement('p');

    if (isPrasadPimple) {
      const damOrigin = 'https://publish-p190053-e2194583.adobeaemcloud.com';
      const profileImgPath = '/content/dam/kotaklife-eds/insurance-guide/blogs/insu-banner/prasad-pimple.png';
      const profileImg = document.createElement('img');
      profileImg.src = new URL(profileImgPath, damOrigin).href;
      profileImg.alt = authorName || 'Prasad Pimple';
      photoP.append(profileImg);
    } else if (existingImg) {
      const profileImg = document.createElement('img');
      if (/^https?:\/\//i.test(imgSrc)) {
        profileImg.src = imgSrc;
      } else if (imgSrc) {
        const cleanPath = imgSrc.startsWith('/') ? imgSrc : `/${imgSrc}`;
        profileImg.src = new URL(cleanPath, 'https://www.kotaklife.com').href;
      }
      profileImg.alt = authorName || existingImg.alt || '';
      photoP.append(profileImg);
    }

    if (photoP.childNodes.length > 0) {
      photoCell.append(photoP);
    }

    // 2. Author Row: Role (e.g. "Reviewed By", "Written By") from live DOM + Name
    const titleContainer = box.querySelector('.nameTitle');
    let roleText = '';
    if (titleContainer) {
      const titleDiv = titleContainer.querySelector('div');
      const targetEl = titleDiv || titleContainer;
      const clone = targetEl.cloneNode(true);
      const nameTag = clone.querySelector('.nameTag');
      if (nameTag) nameTag.remove();
      // Strip HTML comments, trailing colons, and extra whitespace
      roleText = clone.textContent
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/:\s*$/, '')
        .trim();
    }

    if (roleText) {
      const roleP = document.createElement('p');
      roleP.textContent = roleText;
      authorCell.append(roleP);
    }

    if (authorName) {
      const nameP = document.createElement('p');
      nameP.textContent = authorName;
      authorCell.append(nameP);
    }

    // 3. Link Row: Profile link (e.g. LinkedIn URL)
    const linkedinElement = box.querySelector('.tooltiptext a.linkedin')
      || box.querySelector('a[href*="linkedin"]')
      || box.querySelector('.tooltiptext a');
    if (linkedinElement && linkedinElement.href) {
      const profileLink = document.createElement('a');
      profileLink.href = linkedinElement.href;
      profileLink.textContent = linkedinElement.href;
      linkCell.append(profileLink);
    }

    // 4. Bio Row: Author biography description
    const descElement = box.querySelector('.tooltiptext p:first-of-type')
      || box.querySelector('.tooltiptext p')
      || box.querySelector('.blogsTooltip p')
      || box.querySelector('.authorDetails p')
      || box.querySelector('.tooltiptext');
    if (descElement) {
      const bioP = document.createElement('p');
      bioP.innerHTML = descElement.innerHTML.trim();
      bioCell.append(bioP);
    }

    const authorCardBlock = WebImporter.DOMUtils.createTable([
      ['Author Card'],
      [photoCell],
      [authorCell],
      [linkCell],
      [bioCell],
    ], document);

    box.replaceWith(authorCardBlock);

    if (index === authorBoxes.length - 1 && typeof appendSectionMetadata === 'function') {
      appendSectionMetadata(authorCardBlock, 'column-left-section, blog-content', document);
    }
  });
};

const appendKotakPromos = (main, document) => {
  const sourceSection = document.querySelector('.saving-token');
  if (!sourceSection) return;

  const tokens = [...sourceSection.querySelectorAll('.tokens')];
  if (!tokens.length) return;

  const rows = tokens.map((token) => {
    const imageCell = document.createElement('div');
    const textCell = document.createElement('div');

    const image = token.querySelector('img');
    const title = token.querySelector('h4');
    const description = token.querySelector('p');
    const link = token.querySelector('a');

    if (image) imageCell.append(image.cloneNode(true));
    if (title) textCell.append(title.cloneNode(true));
    if (description) textCell.append(description.cloneNode(true));
    if (link) textCell.append(link.cloneNode(true));

    return [imageCell, textCell];
  });

  const cardsBlock = WebImporter.DOMUtils.createTable([
    ['Cards (financial cards)'],
    ...rows,
  ], document);

  sourceSection.replaceWith(cardsBlock);
  main.append(cardsBlock);
};

/**
 * FORM BLOCK (BUY TERM INSURANCE) & TABLE OF CONTENTS
 * Converts .also-read / #leadformem (NotifyVisitors lead form) into a
 * 'Form (buy term insurance)' block table pointing to buy-term-insurance.json
 * preceded by a 'Category Links (table content)' block in the same section.
 * Preserves sidebar 2-column layout alongside bookmarks-links.
 */
const buildLeadForm = (main, document) => {
  const leadContainer = main.querySelector('.also-read, #leadformem, [id*="leadform"]');
  const firstBookmark = main.querySelector('.check-calculators, .category-links, .bookmarks-links, .calculator-bookmarks');

  if (!leadContainer && !firstBookmark) return;

  const tocBlock = WebImporter.DOMUtils.createTable([
    ['Category Links (table content)'],
    ['Table of contents'],
    [''],
  ], document);

  const formLink = document.createElement('a');
  formLink.href = '/content/kotaklife-eds/in/en/forms/buy-term-insurance.json';
  formLink.textContent = '/content/kotaklife-eds/in/en/forms/buy-term-insurance.json';

  const formBlock = WebImporter.DOMUtils.createTable([
    ['Form (buy term insurance, blog-form)'],
    [formLink],
    [''],
  ], document);

  if (firstBookmark && firstBookmark.parentElement) {
    firstBookmark.before(tocBlock, formBlock);
    if (leadContainer) {
      const target = leadContainer.closest('.also-read') || leadContainer;
      target.remove();
    }
  } else if (leadContainer) {
    const target = leadContainer.closest('.also-read') || leadContainer;
    target.before(tocBlock);
    target.replaceWith(formBlock);
    if (typeof appendSectionMetadata === 'function') {
      appendSectionMetadata(formBlock, 'bookmark-section', document);
    }
  }

  // Clean up any remaining duplicate leadform or also-read elements
  main.querySelectorAll('.also-read, #leadformem, [id*="leadform"]').forEach((el) => el.remove());
};

const EXCLUDED_BOOKMARK_PATTERNS = [
  /(?:^|[^a-z0-9])dass[-_\s]*21(?:[-_\s]*calculator|[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])dass\s+calculator\s*21(?:[^a-z0-9]|$)/i,
];

const isExcludedBookmarkLink = (text = '', href = '') => {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const normalizedHref = href.trim();
  return EXCLUDED_BOOKMARK_PATTERNS.some(
    (pattern) => pattern.test(normalizedText) || pattern.test(normalizedHref),
  );
};

/**
 * Helper to build a clean 'Category Links' block table from a bookmark container:
 * Row 0: Category Links (Header)
 * Row 1: Title ("Explore other categories" or container heading)
 * Row 2: Bulleted list of category links (<ul><li><a>...</a></li></ul>)
 */
const createCategoryLinksTable = (container, document) => {
  const heading = container.querySelector('h1, h2, h3, h4, h5, h6, .title, .heading, .calculator-title');
  const titleText = heading ? heading.textContent.trim() : '';

  const titleCell = document.createElement('div');
  const titleP = document.createElement('p');
  titleP.textContent = titleText || 'Explore other categories';
  titleCell.append(titleP);

  const linksCell = document.createElement('div');
  const ul = document.createElement('ul');
  const links = [...container.querySelectorAll('a[href]')];

  links.forEach((link) => {
    const text = link.textContent.replace(/:rightarrowblack:/g, '').trim();
    const href = link.getAttribute('href');

    // Filter out empty anchors, javascript links, accordion toggles, and excluded calculators
    if (!text || !href || /^javascript/i.test(href) || href === '#') return;
    if (/show\s+more|show\s+less/i.test(text)) return;
    if (isExcludedBookmarkLink(text, href)) return;

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = sanitizeHref(href);
    a.textContent = text;
    li.append(a);
    ul.append(li);
  });

  if (!ul.children.length) return null;

  linksCell.append(ul);

  return WebImporter.DOMUtils.createTable([
    ['Category Links'],
    [titleCell],
    [linksCell],
  ], document);
};

/**
 * BLOG NAVIGATION BLOCK
 * Appends an authorable 'Blog Navigation' block table at the bottom of the left column
 * (inside the column-left-section, right before its Section Metadata table).
 */
const appendBlogNavigationBlock = (main, document) => {
  const blogNavTable = WebImporter.DOMUtils.createTable([
    ['Blog Navigation'],
    [''],
  ], document);

  // Look for the last Section Metadata table for column-left-section
  const columnLeftMeta = [...main.querySelectorAll('table')].reverse().find((table) => {
    const text = table.textContent;
    return text.includes('Section Metadata') && text.includes('column-left-section');
  });

  if (columnLeftMeta) {
    columnLeftMeta.before(blogNavTable);
    return;
  }

  // If no column-left Section Metadata table exists yet:
  const lastLeftEl = [...main.querySelectorAll('table')].reverse().find((table) => {
    const text = table.textContent;
    return text.includes('Accordion (faq-v2')
      || text.includes('Author Card')
      || text.includes('RTE')
      || text.includes('Table');
  });

  if (lastLeftEl) {
    lastLeftEl.after(blogNavTable);
  } else {
    const sidebarEl = main.querySelector(
      '.also-read, #leadformem, .check-calculators, .bookmarks-links, .calculator-bookmarks, .category-links:not(table)',
    );
    if (sidebarEl) {
      sidebarEl.before(blogNavTable);
    } else {
      main.append(blogNavTable);
    }
  }

  // Ensure this section is sealed with column-left-section metadata
  if (typeof appendSectionMetadata === 'function') {
    appendSectionMetadata(blogNavTable, 'column-left-section, blog-content', document, true);
  } else {
    blogNavTable.after(document.createElement('hr'));
  }
};

/**
 * Converts bookmark containers into 'Category Links' block tables.
 * All bookmarks remain together in the sidebar and are sealed with
 * 'bookmark-section' section metadata.
 */
const formatBookmarks = (main, document) => {
  const bookmarkSelector = '.check-calculators, .bookmarks-links, '
    + '.calculator-bookmarks, .category-links:not(table)';
  const bookmarkContainers = [
    ...main.querySelectorAll(bookmarkSelector),
  ];
  if (!bookmarkContainers.length) return [];

  let lastBlock = null;

  bookmarkContainers.forEach((container) => {
    const block = createCategoryLinksTable(container, document);
    if (!block) {
      container.remove();
      return;
    }
    container.replaceWith(block);
    lastBlock = block;
  });

  // Seal the sidebar bookmark section after all bookmark blocks
  if (lastBlock && typeof appendSectionMetadata === 'function') {
    let sectionEnd = lastBlock;
    while (sectionEnd.parentElement && sectionEnd.parentElement !== main) {
      sectionEnd = sectionEnd.parentElement;
    }
    appendSectionMetadata(sectionEnd, 'bookmark-section', document);
  } else if (typeof appendSectionMetadata === 'function') {
    const formTable = [...main.querySelectorAll('table')].find((t) => (
      t.textContent.includes('Form (buy term insurance')
    ));
    if (formTable && (!formTable.nextElementSibling
      || !formTable.nextElementSibling.textContent.includes('Section Metadata'))) {
      let sectionEnd = formTable;
      while (sectionEnd.parentElement && sectionEnd.parentElement !== main) {
        sectionEnd = sectionEnd.parentElement;
      }
      appendSectionMetadata(sectionEnd, 'bookmark-section', document);
    }
  }

  return [];
};

/**
 * REMAINING BOOKMARKS (CATEGORY LINKS)
 * Appends remaining category link blocks between Related Insights Fragment
 * and Disclaimer Accordion in their own section.
 */
const appendRemainingBookmarks = (main, categoryBlocks) => {
  if (!categoryBlocks || !categoryBlocks.length) return;

  const lastChild = main.lastElementChild;
  if (!lastChild || lastChild.tagName !== 'HR') {
    main.append(main.ownerDocument.createElement('hr'));
  }

  categoryBlocks.forEach((block) => {
    main.append(block);
  });
};

/**
 * RELATED INSIGHTS FRAGMENT
 * Appends a section break and the related-insights fragment link.
 */
const appendRelatedInsightsFragment = (main, document) => {
  const lastChild = main.lastElementChild;
  if (!lastChild || lastChild.tagName !== 'HR') {
    main.append(document.createElement('hr'));
  }

  const p = document.createElement('p');
  const a = document.createElement('a');
  const fragmentPath = '/content/kotaklife-eds/in/en/fragment/related-insights-v1';
  a.href = fragmentPath;
  a.textContent = fragmentPath;
  p.append(a);
  main.append(p);

  main.append(document.createElement('hr'));
};

/**
 * DISCLAIMER ACCORDION
 * Converts Disclaimer / Terms section into an 'Accordion (faq-v2, product-disclaimer)' block table.
 * Appends :plus: :minus: icons at the end of the label for the accordion expand/collapse toggle.
 */
const appendDisclaimerAccordion = (main, document) => {
  const disclaimerContainer = document.querySelector('.abovespace .terms')
    || document.querySelector('#terms-conditions, section.abovespace, .terms, .accordion.disclaimer, [class*="disclaimer"]');
  if (!disclaimerContainer) return;

  const disclaimerButton = disclaimerContainer.querySelector(
    '.collapsible, button.terms-txt, .terms-txt, .terms-title, summary, .accordion-item-label, h2, h3, h4',
  );

  let labelText = disclaimerButton ? disclaimerButton.textContent.trim().replace(/[\n\r\t]+/g, ' ') : '';
  if (!labelText || labelText.toLowerCase() === 'disclaimer') {
    labelText = 'Disclaimer';
  }

  // Remove existing icon shorthands if already present
  labelText = labelText.replace(/:plus:|:minus:/g, '').trim();

  const label = document.createElement('h3');
  label.textContent = `${labelText} :plus: :minus:`;

  let disclaimerBody = disclaimerContainer.querySelector(
    '.content-col, .terms-para, .accordion-item-body, .accordion-item-body-content',
  );

  if (!disclaimerBody) {
    const paragraphs = disclaimerContainer.querySelectorAll('p');
    if (paragraphs.length > 0) {
      disclaimerBody = document.createElement('div');
      paragraphs.forEach((p) => disclaimerBody.append(p.cloneNode(true)));
    }
  }

  if (disclaimerBody) {
    const accordionBlock = WebImporter.DOMUtils.createTable([
      ['Accordion (faq-v2, product-disclaimer)'],
      [label, disclaimerBody.cloneNode(true)],
    ], document);

    const targetToRemove = document.querySelector('.abovespace') || disclaimerContainer;
    if (targetToRemove) {
      targetToRemove.remove();
    }
    const lastChild = main.lastElementChild;
    if (!lastChild || lastChild.tagName !== 'HR') {
      main.append(document.createElement('hr'));
    }
    main.append(accordionBlock);
    if (typeof appendSectionMetadata === 'function') {
      appendSectionMetadata(accordionBlock, 'margin-140', document, false);
    }
  }
};

/**
 * POPULAR SEARCH BLOCK
 * Converts the live popular searches list into a 'Popular Search' block table:
 * Row 1: Heading <h4><strong>Popular</strong> searches</h4>
 * Row 2: Bullet list of clean search tag links (stripping the label item)
 */
const appendPopularSearches = (main, document) => {
  const source = document.querySelector('.popular_list') || document.querySelector('.popular_searches_new');
  if (!source) return;

  const list = source.querySelector('ul') || (source.tagName === 'UL' ? source : null);
  if (!list) return;

  // Extract all anchor links, ignoring the label item and excluded calculators
  // (e.g. "Frequently Visited :" or "POPULAR SEARCHES :")
  const linkElements = [...list.querySelectorAll('li a')].filter((a) => {
    const text = a.textContent.trim();
    const href = a.getAttribute('href') || a.href || '';
    return text && href && !isExcludedBookmarkLink(text, href);
  });
  if (!linkElements.length) {
    document.querySelectorAll('.popular_list, .popular_searches_new').forEach((el) => el.remove());
    return;
  }

  const cleanList = document.createElement('ul');
  linkElements.forEach((a) => {
    const li = document.createElement('li');
    const cleanLink = document.createElement('a');
    cleanLink.href = sanitizeHref(a.getAttribute('href') || a.href);
    cleanLink.textContent = a.textContent.trim();
    li.append(cleanLink);
    cleanList.append(li);
  });

  // Create heading: <h4><strong>Popular</strong> searches</h4>
  const heading = document.createElement('h4');
  const strong = document.createElement('strong');
  strong.textContent = 'Popular';
  heading.append(strong);
  heading.append(document.createTextNode(' searches'));

  const popularSearchBlock = WebImporter.DOMUtils.createTable([
    ['Popular Search'],
    [heading],
    [cleanList],
  ], document);

  // Clean up source elements from the DOM
  document.querySelectorAll('.popular_list, .popular_searches_new').forEach((el) => el.remove());

  // Start a new section for popular searches
  main.append(document.createElement('hr'));
  main.append(popularSearchBlock);
  if (typeof appendSectionMetadata === 'function') {
    appendSectionMetadata(popularSearchBlock, 'blog-popular-section', document, true);
  } else {
    popularSearchBlock.after(document.createElement('hr'));
  }
};

/**
 * VISUAL PULSE SECTION
 * Appends the visual pulse illustration section directly below Popular Searches.
 * Contains:
 * - Desktop image (p:first-of-type)
 * - Mobile image (p:last-child)
 * - Section Metadata: style = visual-pulse
 */
const appendVisualPulseSection = (main, document) => {
  const damOrigin = 'https://publish-p190053-e2194583.adobeaemcloud.com';
  const desktopDamPath = '/content/dam/kotaklife-eds/insurance-guide/blogs/insu-banner/famliy-group.png';
  const mobileDamPath = '/content/dam/kotaklife-eds/insurance-guide/blogs/insu-banner/Bottom-image.png';

  // Start a new section for visual pulse if not already following an <hr>
  const lastChild = main.lastElementChild;
  if (!lastChild || lastChild.tagName !== 'HR') {
    main.append(document.createElement('hr'));
  }

  // Desktop image (first paragraph, shown on desktop via CSS, authorable in UE)
  const desktopP = document.createElement('p');
  const desktopImg = document.createElement('img');
  desktopImg.src = new URL(desktopDamPath, damOrigin).href;
  desktopImg.alt = 'famliy group';
  desktopP.append(desktopImg);
  main.append(desktopP);

  // Mobile image (second paragraph, shown on mobile via CSS, authorable in UE)
  const mobileP = document.createElement('p');
  const mobileImg = document.createElement('img');
  mobileImg.src = new URL(mobileDamPath, damOrigin).href;
  mobileImg.alt = 'bottom im';
  mobileP.append(mobileImg);
  main.append(mobileP);

  // Append Section Metadata: style = visual-pulse
  if (typeof appendSectionMetadata === 'function') {
    appendSectionMetadata(mobileP, 'visual-pulse', document, false);
  }
};

/**
 * PULSE ANIMATION SECTION
 * Appends an empty 'Pulse Animation' block in its own section directly beneath
 * the visual pulse section so page-level pulse-auto waves render with the default arrow.
 */
const appendPulseAnimationSection = (main, document) => {
  const lastChild = main.lastElementChild;
  if (!lastChild || lastChild.tagName !== 'HR') {
    main.append(document.createElement('hr'));
  }

  const pulseAnimationBlock = WebImporter.DOMUtils.createTable([
    ['Pulse Animation'],
    [''],
  ], document);

  main.append(pulseAnimationBlock);
};

const appendMetadataBlockAtBottom = (main, document) => {
  const metadata = {};
  const title = document.querySelector('title');
  const ogTitle = document.querySelector('meta[property="og:title"], meta[name="og:title"]');
  const description = document.querySelector('meta[name="description"]');
  const ogDescription = document.querySelector('meta[property="og:description"], meta[name="og:description"]');
  const image = document.querySelector('meta[property="og:image"], meta[name="og:image"], meta[property="twitter:image"], meta[name="twitter:image"]');

  // Fall back to og:title / og:description when title / description are missing or empty
  const titleText = title?.textContent?.trim();
  const ogTitleText = ogTitle?.content?.trim();
  if (titleText || ogTitleText) metadata.Title = titleText || ogTitleText;

  const descriptionText = description?.content?.trim();
  const ogDescriptionText = ogDescription?.content?.trim();
  if (descriptionText || ogDescriptionText) {
    metadata.Description = descriptionText || ogDescriptionText;
  }
  if (image?.content) {
    const img = document.createElement('img');
    img.src = new URL(image.content.trim(), 'https://www.kotaklife.com/').href;
    metadata.Image = img;
  } else {
    // Fall back to first article content image rather than the decorative hero banner
    const firstArticleImg = main.querySelector('.default-content-wrapper img, .blog-content img');
    if (firstArticleImg) {
      const img = document.createElement('img');
      img.src = firstArticleImg.src || firstArticleImg.getAttribute('src');
      metadata.Image = img;
    }
  }

  if (metadata.Image) {
    const imageLink = document.createElement('a');
    imageLink.href = metadata.Image.src;
    imageLink.textContent = metadata.Image.src;
    metadata['og:image'] = imageLink;
  }

  // Set the breadcrumb toggle (matches 'breadcrumb' boolean field in models/_page.json)
  metadata.breadcrumb = '{Boolean}true';

  // Set Pulse Waves metadata (matches 'pulse-auto' field in models/_page.json)
  metadata['pulse-auto'] = 'right';

  const metadataBlock = WebImporter.Blocks.getMetadataBlock(document, metadata);
  main.append(metadataBlock);
};

// Wraps <ul class="bullet-pink"> elements inside an RTE V2 block
const buildPinkBulletRteBlocks = (main, document) => {
  const pinkLists = [...main.querySelectorAll('ul.bullet-pink')];
  if (!pinkLists.length) return;

  pinkLists.forEach((list) => {
    const rteBlock = WebImporter.DOMUtils.createTable([
      ['RTE V2 (bullet-pink)'],
      [list.cloneNode(true)],
    ], document);

    list.replaceWith(rteBlock);
  });
};

// Places a standard data table inside a single-cell RTE V2 block
const buildTableInsideRteBlock = (main, document) => {
  const sourceTables = [...main.querySelectorAll('table')];

  sourceTables.forEach((table) => {
    if (table.querySelectorAll('tr').length === 0) {
      table.remove();
      return;
    }

    const blockRows = [
      ['RTE V2 (tabs-table)'],
      [table.cloneNode(true)],
    ];

    const rteBlock = WebImporter.DOMUtils.createTable(blockRows, document);
    table.replaceWith(rteBlock);
  });
};

// Wraps <blockquote> elements inside an RTE V2 block with the 'blockquote' class
const buildBlockquoteRteBlocks = (main, document) => {
  const blockquotes = [...main.querySelectorAll('blockquote')];
  if (!blockquotes.length) return;

  blockquotes.forEach((bq) => {
    const rteBlock = WebImporter.DOMUtils.createTable([
      ['RTE V2 (blockquote)'],
      [bq.cloneNode(true)],
    ], document);

    bq.replaceWith(rteBlock);
  });
};

// Replaces plain-text numbered <p> links with a real <ol>, since look-alike numbered
// paragraphs get merged by the docx/Word ingestion pipeline instead of staying separate
const buildSuggestedReadingsList = (main, document) => {
  const containers = [...main.querySelectorAll('.suggestion')];
  if (!containers.length) return;

  containers.forEach((container) => {
    const links = [...container.querySelectorAll('a[href]')];
    if (!links.length) return;

    const list = document.createElement('ol');
    links.forEach((link) => {
      const li = document.createElement('li');
      const anchor = document.createElement('a');
      anchor.href = sanitizeHref(link.getAttribute('href') || link.href);
      anchor.textContent = link.textContent.trim();
      li.append(anchor);
      list.append(li);
    });

    container.querySelectorAll('p').forEach((p) => p.remove());
    container.append(list);
  });
};

// Grouping the left-column/sidebar sections into a shared grid wrapper is done at
// runtime (see wrapBlogGrid in scripts.js): AEM/EDS always keeps authored sections
// as flat main children, so nesting them here would just produce stray empty
// sections once the doc is split back into page sections.

export default {
  transformDOM: ({ document }) => {
    const main = selectContentRoot(document);

    // Convert native <section> tags to <div> to prevent unwanted '---' breaks
    [...main.querySelectorAll('section')].forEach((sec) => {
      const div = document.createElement('div');
      div.className = sec.className;
      div.id = sec.id;
      div.append(...sec.childNodes);
      sec.replaceWith(div);
    });
    fixImageUrls(main);
    fixMalformedHeadings(main);
    fixMalformedHierarchy(main);
    cleanHeadingFormatting(main);
    removeGlobalNoise(main);

    buildTableInsideRteBlock(main, document);

    buildBlockquoteRteBlocks(main, document);
    if (main.querySelector('.new_term_supporting')) {
      buildTermSupportingHeroBanner(main, document);
      main.querySelectorAll('.blog-head, .best-card').forEach((el) => el.remove());
    } else {
      buildHeroBanner(main, document);
    }
    createEmbedBlocks(main, document);
    buildInsuranceSectionsBlocks(main, document);
    buildPinkBulletRteBlocks(main, document);
    repositionAuthorCardsBeforeFaq(main);
    buildProfileCards(main, document);
    appendFaqAccordion(main, document);
    appendBlogNavigationBlock(main, document);
    buildLeadForm(main, document);
    const remainingCategoryLinks = formatBookmarks(main, document);
    buildSuggestedReadingsList(main, document);

    appendKotakPromos(main, document);
    appendRelatedInsightsFragment(main, document);
    appendRemainingBookmarks(main, remainingCategoryLinks);
    appendDisclaimerAccordion(main, document);
    appendPopularSearches(main, document);
    appendVisualPulseSection(main, document);
    appendPulseAnimationSection(main, document);

    appendMetadataBlockAtBottom(main, document);

    sanitizeAllLinks(main);

    return main;
  },

  generateDocumentPath: ({ url, params }) => {
    const pathname = getPathname(params?.originalURL || url);
    const documentPath = pathname === '/' ? '/index' : pathname.replace(/\/$/, '');
    return WebImporter.FileUtils.sanitizePath(documentPath);
  },
};
