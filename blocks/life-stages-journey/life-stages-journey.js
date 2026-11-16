import { loadCSS } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import {
  div, span, p, a,
} from '../../scripts/dom-helpers.js';

/**
 * Decorates the young-professionals variation of life-stages-journey.
 * @param {Element} block The life-stages-journey block element
 */
async function decorateYoungProfessionals(block) {
  loadCSS(`${window.hlx?.codeBasePath || ''}/blocks/life-stages-journey/young-professionals.css`);

  const rows = [...block.children].filter((el) => el.nodeType === 1);
  if (!rows.length) return;

  // Categorize content rows based strictly on model or explicit authored content
  let titleRow = null;
  let personaRow = null;
  const milestoneRows = [];
  let outcomeRow = null;
  const disclaimerRows = [];

  rows.forEach((row, index) => {
    const cols = [...row.children];
    const model = row.getAttribute('data-aue-model');
    const firstColText = cols[0]?.textContent?.trim().toLowerCase() || '';
    const rowText = row.textContent.trim().toLowerCase();
    const hasImage = Boolean(row.querySelector('picture, img'));
    const hasHeading = Boolean(row.querySelector('h1, h2, h3, h4, h5, h6'));
    const hasCta = Boolean(row.querySelector('.button-container, a[href]'));

    // Accurate disclaimer detection (matches model, table keyword, or trailing disclaimer copy)
    const isDisclaimer = model === 'life-stages-disclaimer'
      || firstColText.includes('disclaimer')
      || row.classList.contains('life-stages-disclaimer')
      || (!hasImage && !hasCta && (
        rowText.includes('illustration')
        || rowText.includes('medical history')
        || rowText.includes('actual premium')
        || (rowText.startsWith('*') && !firstColText.match(/\d+/))
        || (index === rows.length - 1 && cols.length === 1 && !hasHeading)
      ));

    if (model === 'life-stages-title' || firstColText === 'title'
      || (index === 0 && hasHeading && !hasImage)) {
      titleRow = row;
    } else if (model === 'life-stages-persona' || firstColText === 'persona'
      || (!model && (index === 0 || index === 1) && hasImage && cols.length >= 2 && !personaRow)) {
      personaRow = row;
    } else if (model === 'life-stages-outcome' || firstColText === 'outcome'
      || (!model && (hasCta || (hasImage && index >= rows.length - 3)))) {
      if (!outcomeRow) outcomeRow = row;
      else milestoneRows.push({ row, isHighlight: false });
    } else if (isDisclaimer) {
      disclaimerRows.push({ row, index });
    } else if (model === 'life-stages-milestone' || firstColText.startsWith('milestone')
      || rowText.match(/\d+\s*(?:yrs|year|years)?/i)) {
      milestoneRows.push({ row, isHighlight: firstColText.includes('highlight') });
    } else if (index === rows.length - 1 && !hasImage && !hasCta) {
      disclaimerRows.push({ row, index });
    } else {
      milestoneRows.push({ row, isHighlight: false });
    }
  });

  // Disclaimer items can be authored for the title (at top) and/or footer (at bottom)
  const footerDisclaimerRows = [];
  if (disclaimerRows.length > 0) {
    const personaIdx = personaRow ? rows.indexOf(personaRow) : 1;
    const firstIsTitle = !titleRow && (
      disclaimerRows[0].index === 0
      || Boolean(disclaimerRows[0].row.querySelector('h1, h2, h3, h4, h5, h6'))
      || (disclaimerRows.length >= 2 && disclaimerRows[0].index < personaIdx)
    );

    if (firstIsTitle) {
      titleRow = disclaimerRows[0].row;
      disclaimerRows.slice(1).forEach((item) => footerDisclaimerRows.push(item.row));
    } else {
      disclaimerRows.forEach((item) => footerDisclaimerRows.push(item.row));
    }
  }

  // Root container built in memory to prevent layout thrashing
  const container = div({ class: 'lsj-container' });

  // 0. Build Title (if authored inside block)
  if (titleRow) {
    const propCol = titleRow.querySelector(
      '[data-aue-prop="disclaimer"], [data-aue-prop="title"], [data-aue-prop="text"]',
    );
    const tCols = [...titleRow.children];
    const contentCol = propCol || (tCols.length > 1 ? tCols[tCols.length - 1] : tCols[0]);

    if (contentCol) {
      const textWrap = div({ class: 'lsj-title-content' });
      if (contentCol !== titleRow) moveInstrumentation(contentCol, textWrap);
      while (contentCol.firstChild) textWrap.append(contentCol.firstChild);

      textWrap.querySelectorAll('p').forEach((pEl) => {
        const t = pEl.textContent.trim().toLowerCase();
        if (t === 'disclaimer' || t === 'title') pEl.remove();
      });

      if (textWrap.textContent.trim()) {
        const titleEl = div({ class: 'lsj-title' }, textWrap);
        moveInstrumentation(titleRow, titleEl);
        container.append(titleEl);
      }
    }
  }

  // 1. Build Persona Header
  let personaEl = null;
  if (personaRow) {
    const pCols = [...personaRow.children];
    const mediaWrap = div({ class: 'lsj-persona-media' });
    const pic = personaRow.querySelector('picture, img');
    if (pic) {
      const picCol = pic.closest('div');
      if (picCol && picCol !== personaRow) moveInstrumentation(picCol, mediaWrap);
      mediaWrap.append(pic);
    }

    const infoWrap = div({ class: 'lsj-persona-info' });
    const textCol = pCols.length > 2 ? pCols[2] : pCols[pCols.length - 1];
    if (textCol) {
      if (textCol !== personaRow) moveInstrumentation(textCol, infoWrap);
      while (textCol.firstChild) infoWrap.append(textCol.firstChild);
    }

    personaEl = div({ class: 'lsj-persona' }, mediaWrap, infoWrap);
    moveInstrumentation(personaRow, personaEl);
  }

  // 2. Build Milestones & Timeline Tracks
  const trackTop = div({ class: 'lsj-track lsj-track-top' });
  if (personaEl) trackTop.append(personaEl);

  const turnEl = div({ class: 'lsj-connector-turn', 'aria-hidden': 'true' });
  const trackBottom = div({ class: 'lsj-track lsj-track-bottom' });

  // Process Milestones
  const totalMilestones = milestoneRows.length;
  milestoneRows.forEach(({ row, isHighlight }, idx) => {
    const cols = [...row.children];

    // Parse age/unit from col 1 or 2
    let [metaCol, contentCol] = cols;

    if (cols.length >= 3 && cols[0].textContent.trim().toLowerCase().startsWith('milestone')) {
      [, metaCol, contentCol] = cols;
    } else if (cols.length === 1) {
      [metaCol] = cols;
      contentCol = metaCol;
    }

    const metaText = metaCol ? metaCol.textContent.trim() : '';
    // Extract age digits and unit from authored content
    const ageMatch = metaText.match(/\d+/);
    const age = ageMatch ? ageMatch[0] : metaText;
    const unitMatch = metaText.match(/yrs|year|years/i);
    let unit = unitMatch ? unitMatch[0] : '';
    if (!unit && ageMatch) unit = 'Yrs';

    const col3Text = cols[2]?.textContent.trim().toLowerCase() || '';
    const hasStrong = Boolean(metaCol?.querySelector('strong'));
    const isSeniorAge = parseInt(age, 10) >= 70;
    const variantProp = row.querySelector('[data-aue-prop="variant"]');
    const isHighlightVariant = variantProp?.textContent.trim().toLowerCase() === 'highlight';
    const highlight = isHighlight
      || isHighlightVariant
      || metaText.toLowerCase().includes('highlight')
      || col3Text.includes('highlight')
      || isSeniorAge
      || (hasStrong && isSeniorAge)
      || (idx === totalMilestones - 1 && totalMilestones > 3);

    // Determine desktop alternating position (top vs bottom)
    let pos = idx % 2 === 0 ? 'top' : 'bottom';
    if (metaText.toLowerCase().includes('top') || col3Text.includes('top')) pos = 'top';
    if (metaText.toLowerCase().includes('bottom') || col3Text.includes('bottom')) pos = 'bottom';

    // Marker (Badge + Unit)
    const badge = span({ class: `lsj-badge ${highlight ? 'lsj-badge-red' : 'lsj-badge-blue'}` }, age);
    const markerWrap = div({ class: 'lsj-milestone-marker' }, badge);
    if (metaCol && metaCol !== row) moveInstrumentation(metaCol, markerWrap);

    if (unit) {
      markerWrap.append(span({ class: 'lsj-badge-unit' }, unit));
    }

    // Text Content
    const contentWrap = div({ class: 'lsj-milestone-content' });
    if (contentCol) {
      if (contentCol !== row) moveInstrumentation(contentCol, contentWrap);
      while (contentCol.firstChild) contentWrap.append(contentCol.firstChild);
      // Clean up standalone metadata paragraphs
      contentWrap.querySelectorAll('p').forEach((pEl) => {
        const t = pEl.textContent.trim();
        if (/^\d+\s*yrs/i.test(t) || t.toLowerCase() === 'top' || t.toLowerCase() === 'bottom') {
          pEl.remove();
        }
      });
    }

    const mEl = div(
      {
        class: `lsj-milestone lsj-pos-${pos}${highlight ? ' lsj-milestone-highlight' : ''}`,
        'data-age': age,
      },
      contentWrap,
      markerWrap,
    );
    moveInstrumentation(row, mEl);

    // On desktop, the last milestone (e.g. 74 Yrs) belongs to trackBottom
    if (idx === totalMilestones - 1 && totalMilestones > 3) {
      trackBottom.append(mEl);
    } else {
      trackTop.append(mEl);
    }
  });

  // 3. Build Outcome Card
  if (outcomeRow) {
    const oCols = [...outcomeRow.children];

    // Outcome image (Family picture)
    const outMedia = div({ class: 'lsj-outcome-media' });
    const outPic = outcomeRow.querySelector('picture, img');
    if (outPic) {
      const picCol = outPic.closest('div');
      if (picCol && picCol !== outcomeRow) moveInstrumentation(picCol, outMedia);
      outMedia.append(outPic);
    }

    // Card Body
    const outCard = div({ class: 'lsj-outcome-card' });

    // Check if authored with Universal Editor fields
    const textProp = outcomeRow.querySelector('[data-aue-prop="text"], [data-aue-prop="description"]');
    const subtitleProp = outcomeRow.querySelector('[data-aue-prop="subtitle"]');
    const amountProp = outcomeRow.querySelector('[data-aue-prop="amount"]');
    const ctaProp = outcomeRow.querySelector('[data-aue-prop="cta"]');
    const buttonTextProp = outcomeRow.querySelector(
      '[data-aue-prop="ctaText"], [data-aue-prop="buttonText"]',
    );

    let hasCardContent = false;

    if (textProp) {
      const textWrap = div({ class: 'lsj-outcome-text' });
      moveInstrumentation(textProp, textWrap);
      while (textProp.firstChild) textWrap.append(textProp.firstChild);

      const firstP = textWrap.querySelector('p');
      if (firstP) firstP.classList.add('lsj-outcome-subtitle');

      const amountEl = textWrap.querySelector('h1, h2, h3, h4, h5, h6, strong');
      if (amountEl) {
        if (amountEl.tagName === 'STRONG') {
          const pParent = amountEl.closest('p');
          if (pParent && pParent !== firstP) {
            pParent.classList.add('lsj-outcome-amount');
          } else {
            amountEl.classList.add('lsj-outcome-amount');
          }
        } else {
          amountEl.classList.add('lsj-outcome-amount');
        }
      }

      outCard.append(textWrap);
      hasCardContent = true;
    } else if (subtitleProp || amountProp) {
      const subtitleText = subtitleProp?.textContent.trim() || '';
      const amountText = amountProp?.textContent.trim() || '';

      if (subtitleText) {
        const subtitleEl = p({ class: 'lsj-outcome-subtitle' }, subtitleText);
        if (subtitleProp) moveInstrumentation(subtitleProp, subtitleEl);
        outCard.append(subtitleEl);
        hasCardContent = true;
      }

      if (amountText) {
        const amountEl = p({ class: 'lsj-outcome-amount' }, amountText);
        if (amountProp) moveInstrumentation(amountProp, amountEl);
        outCard.append(amountEl);
        hasCardContent = true;
      }
    }

    // Fallback: If neither textProp nor subtitleProp/amountProp provided content,
    // inspect all headings and paragraphs in outcomeRow (excluding CTA link paragraph)
    if (!hasCardContent) {
      const ctaLink = ctaProp?.querySelector('a') || outcomeRow.querySelector('a');
      const ctaP = ctaLink ? ctaLink.closest('p') : null;
      const amountHeading = outcomeRow.querySelector('h1, h2, h3, h4, h5, h6, strong');
      const amountText = amountHeading ? amountHeading.textContent.trim() : '';

      const allPs = [...outcomeRow.querySelectorAll('p')].filter(
        (pEl) => pEl !== ctaP && !pEl.querySelector('a'),
      );

      let subtitleText = '';
      const foundP = allPs.find((pEl) => {
        const t = pEl.textContent.replace(amountText, '').trim();
        return t.length > 0;
      });
      if (foundP) {
        subtitleText = foundP.textContent.replace(amountText, '').trim();
      }

      if (subtitleText) {
        outCard.append(p({ class: 'lsj-outcome-subtitle' }, subtitleText));
      }

      if (amountText) {
        outCard.append(p({ class: 'lsj-outcome-amount' }, amountText));
      }
    }

    // Now append CTA button
    const ctaLink = ctaProp?.querySelector('a') || outcomeRow.querySelector('a');
    const href = ctaLink?.href || ctaProp?.textContent.trim() || '';
    const labelText = buttonTextProp?.textContent.trim()
      || ctaLink?.textContent.trim()
      || (oCols.length > 2 && oCols[2].querySelector('a')?.textContent.trim())
      || '';

    if (href && labelText) {
      const buttonA = a(
        {
          class: 'lsj-outcome-cta',
          href,
          ...(ctaLink?.target ? { target: ctaLink.target } : {}),
        },
        span({ class: 'lsj-outcome-cta-label' }, labelText),
        span({ class: 'lsj-outcome-cta-icon', 'aria-hidden': 'true' }),
      );
      if (buttonTextProp) moveInstrumentation(buttonTextProp, buttonA.firstElementChild);

      const ctaWrap = div({ class: 'lsj-outcome-cta-wrap' }, buttonA);
      if (ctaProp) moveInstrumentation(ctaProp, ctaWrap);
      outCard.append(ctaWrap);
    }

    const outcomeEl = div({ class: 'lsj-outcome' }, outMedia, outCard);
    moveInstrumentation(outcomeRow, outcomeEl);
    trackBottom.append(outcomeEl);
  }

  const timelineEl = div({ class: 'lsj-timeline' }, trackTop, turnEl, trackBottom);
  container.append(timelineEl);

  // 4. Build Disclaimer Footer (strictly if authored, zero fallback)
  if (footerDisclaimerRows.length > 0) {
    const discEl = div({ class: 'lsj-disclaimer' });

    footerDisclaimerRows.forEach((dRow) => {
      const propCol = dRow.querySelector('[data-aue-prop="disclaimer"], [data-aue-prop="text"]');
      const dCols = [...dRow.children];
      const discCol = propCol || (dCols.length > 1 ? dCols[dCols.length - 1] : dCols[0]);

      if (!discCol) return;

      const textWrap = div({ class: 'lsj-disclaimer-content' });
      if (discCol !== dRow) moveInstrumentation(discCol, textWrap);
      while (discCol.firstChild) textWrap.append(discCol.firstChild);

      textWrap.querySelectorAll('p').forEach((pEl) => {
        if (pEl.textContent.trim().toLowerCase() === 'disclaimer') pEl.remove();
      });

      if (!textWrap.textContent.trim()) return;

      if (footerDisclaimerRows.length === 1) {
        moveInstrumentation(dRow, discEl);
        discEl.append(textWrap);
      } else {
        const itemEl = div({ class: 'lsj-disclaimer-item' }, textWrap);
        moveInstrumentation(dRow, itemEl);
        discEl.append(itemEl);
      }
    });

    if (discEl.children.length > 0) {
      container.append(discEl);
    }
  }

  // Clear existing unparsed content and mount decorated DOM atomically
  block.replaceChildren(container);
}

/**
 * Decorates the life-stages-journey block.
 * @param {Element} block The life-stages-journey block element
 */
export default async function decorate(block) {
  if (block.classList.contains('young-professionals')) {
    await decorateYoungProfessionals(block);
  }
}
