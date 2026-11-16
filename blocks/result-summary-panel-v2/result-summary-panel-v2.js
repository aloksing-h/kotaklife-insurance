import { getCalculatorScope } from '../calculators/calculator-controller.js';
import createResultAnnouncer from '../calculators/result-announcer.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

export default async function decorate(block) {
  const rows = [...block.children];
  const calculatorType = rows[0]?.querySelector('select')?.value
    || rows[0]?.textContent.trim();
  if (calculatorType !== 'term') return;

  const fields = rows.slice(1);
  const summaryImage = fields[0]?.querySelector('picture')?.cloneNode(true);
  const summaryImageElement = summaryImage?.querySelector('img');
  if (summaryImageElement && !summaryImageElement.hasAttribute('alt')) {
    summaryImageElement.alt = '';
  }
  if (summaryImageElement?.getAttribute('alt') === '') {
    summaryImageElement.setAttribute('aria-hidden', 'true');
  }
  const getText = (index) => fields[index]?.textContent.trim() || '';
  const authoredDiscount = getText(1);
  const authoredLabel = getText(2);
  const descriptionTemplate = getText(3);
  const authoredCtaLabel = getText(4);
  const authoredCtaLink = fields[5]?.querySelector('a')?.getAttribute('href')?.trim();
  const scope = getCalculatorScope(block, 'term');
  const calculator = scope.querySelector('.calculators.term-inurance-text');

  block.dataset.calculatorType = 'term';
  block.innerHTML = `
    <div class="calc-card term-result-card">
      <div class="result-summary-content">
        <div class="result-summary-details term-result-details${summaryImage
    ? '' : ' term-result-details-no-image'}">
          <span class="term-result-discount" hidden></span>
          <div class="term-content-blue">
            ${summaryImage ? '<div class="illustration-wrap"></div>' : ''}
            <div class="savings-summary-box">
              <p class="term-result-label"></p>
              <div class="savings-amount-text" data-term-premium>₹XXXXX</div>
              <p class="term-result-frequency">Annually for ₹XXXXX cover</p>
            </div>
          </div>
        </div>
        <p class="term-result-status" role="status" aria-live="polite" hidden></p>
        <div class="result-summary-action" hidden>
          <a class="cta-plan-btn" target="_blank" rel="noopener noreferrer"></a>
        </div>
      </div>
    </div>`;
  const announceResult = createResultAnnouncer(block);

  if (summaryImage) block.querySelector('.illustration-wrap').append(summaryImage);

  [
    '.illustration-wrap',
    '.term-result-discount',
    '.term-result-label',
    '.term-result-frequency',
    '.cta-plan-btn',
    '.result-summary-action',
  ].forEach((selector, index) => {
    const target = block.querySelector(selector);
    const source = fields[index];
    if (source && target) {
      moveInstrumentation(source, target);
      if (source.firstElementChild) moveInstrumentation(source.firstElementChild, target);
    }
  });

  const status = block.querySelector('.term-result-status');
  const premium = block.querySelector('[data-term-premium]');
  const action = block.querySelector('.result-summary-action');
  const button = block.querySelector('.cta-plan-btn');
  const discount = block.querySelector('.term-result-discount');
  const frequency = block.querySelector('.term-result-frequency');

  block.querySelector('.term-result-label').textContent = authoredLabel;
  premium.setAttribute('aria-label', authoredLabel || 'Premium');
  discount.textContent = authoredDiscount;
  discount.hidden = !authoredDiscount;
  frequency.textContent = 'Annually for ₹XXXXX cover';

  const safeDestination = (href) => {
    try {
      const destination = new URL(href, window.location.origin);
      return ['http:', 'https:'].includes(destination.protocol) ? destination.href : '';
    } catch (error) {
      if (error instanceof TypeError) return '';
      throw error;
    }
  };

  if (authoredCtaLabel && authoredCtaLink) {
    const destination = safeDestination(authoredCtaLink);
    if (destination) {
      button.href = destination;
      button.textContent = authoredCtaLabel;
      action.hidden = false;
    } else {
      status.textContent = 'The configured purchase link is invalid.';
      status.hidden = false;
    }
  }

  const renderQuote = ({ status: quoteStatus, quote, error }) => {
    status.hidden = false;
    if (quoteStatus === 'loading') {
      premium.textContent = '--';
      premium.setAttribute('aria-label', `${authoredLabel || 'Premium'}: --`);
      frequency.textContent = '';
      discount.hidden = true;
      status.textContent = 'Calculating your premium...';
      action.hidden = true;
      return;
    }
    if (quoteStatus === 'error') {
      status.textContent = error || 'Unable to calculate your premium. Please try again.';
      action.hidden = true;
      premium.textContent = '--';
      premium.setAttribute('aria-label', `${authoredLabel || 'Premium'}: --`);
      frequency.textContent = '';
      discount.hidden = true;
      return;
    }
    if (quoteStatus !== 'success' || !quote) return;

    block.querySelector('.term-result-label').textContent = authoredLabel || quote.label;
    premium.textContent = quote.premium;
    premium.setAttribute(
      'aria-label',
      `${authoredLabel || quote.label || 'Premium'}: ${quote.premium}`,
    );
    frequency.textContent = descriptionTemplate
      ? descriptionTemplate
        .replaceAll('{frequency}', quote.frequency)
        .replaceAll('{cover}', quote.coverDescription)
      : `${quote.frequency} ${quote.coverDescription}`;
    const discountLabel = authoredDiscount || quote.discount;
    discount.textContent = discountLabel;
    discount.hidden = !discountLabel;

    const destination = safeDestination(authoredCtaLink || quote.ctaHref);
    if (!destination) {
      status.textContent = 'The configured purchase link is invalid.';
      action.hidden = true;
      return;
    }
    button.href = destination;
    button.textContent = authoredCtaLabel || quote.ctaLabel;
    action.hidden = false;
    status.textContent = '';
    status.hidden = true;
    announceResult([
      `${authoredLabel || quote.label || 'Premium'}: ${quote.premium}`,
      frequency.textContent,
      discountLabel,
    ].filter(Boolean).join('. '));
  };

  scope.addEventListener('term-quote-update', (event) => renderQuote(event.detail));
  if (calculator?.termQuoteState) renderQuote(calculator.termQuoteState);
}
