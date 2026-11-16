import { getCalculatorScope } from '../calculators/calculator-controller.js';
import createTobaccoField from '../calculators/fields/tobacco-field/tobacco-field.js';
import createResultAnnouncer from '../calculators/result-announcer.js';

function markDecorativeImage(picture) {
  const image = picture?.querySelector('img');
  if (image && !image.hasAttribute('alt')) image.alt = '';
  if (image?.getAttribute('alt') === '') image.setAttribute('aria-hidden', 'true');
  return picture;
}

export default async function decorate(block) {
  const rows = [...block.children];
  const firstValue = rows[0]?.textContent.trim();
  const isTypeFirstModel = ['retirement', 'savings', 'hra', 'hlv'].includes(firstValue);
  let authoredType;
  if (isTypeFirstModel) {
    // Normalize the new type-first model to the legacy row mapping.
    const [typeRow] = rows.splice(0, 1);
    authoredType = firstValue;
    rows.splice(8, 0, typeRow);
  }
  const omittedAltRows = [3, 19, 26, 31];
  const getRow = (index) => {
    if (index === 9 && isTypeFirstModel) return rows[8];
    const omittedBefore = isTypeFirstModel
      ? omittedAltRows.filter((rowIndex) => rowIndex <= index).length : 0;
    return rows[index - omittedBefore];
  };
  const getText = (index) => getRow(index)?.querySelector('p')?.textContent.trim() || '';

  authoredType ||= getText(9);
  if (authoredType && !['retirement', 'savings', 'hra', 'hlv'].includes(authoredType)) return;
  const isHra = authoredType === 'hra'
    || (!authoredType && Boolean(block.closest('.hra-calculator')));
  if (isHra) {
    const exemptedLabel = getText(20) || 'Exempted HRA';
    const taxableLabel = getText(21) || 'Taxable HRA';
    const buttonTitle = getText(22);
    const buttonLink = getRow(23)?.querySelector('a')?.getAttribute('href')?.trim();
    const authoredMetroCity = (getRow(24)?.querySelector('select')?.value
      || getText(24)).toLowerCase();
    const summaryImage = markDecorativeImage(
      getRow(25)?.querySelector('picture')?.cloneNode(true),
    );
    const metroCityDefault = ['yes', 'no'].includes(authoredMetroCity)
      ? authoredMetroCity : 'yes';
    const hraScope = getCalculatorScope(block, 'hra');
    block.dataset.calculatorType = 'hra';
    block.innerHTML = `
      <div class="calc-card hra-result-card">
        <div class="fund-estimate-box">
          <p class="hra-result-label"></p>
          <p class="fund-estimate-value hra-result-value"
            data-hra-result="exempted">--</p>
        </div>
        <div class="result-summary-content">
          <div class="result-summary-details hra-result-details${summaryImage
    ? '' : ' hra-result-details-no-image'}">
            ${summaryImage ? '<div class="illustration-wrap"></div>' : ''}
            <div class="savings-summary-box">
              <div class="hra-result-city-slot"></div>
              <p class="hra-result-label"></p>
              <p class="savings-amount-text hra-result-value"
                data-hra-result="taxable">--</p>
            </div>
          </div>
          ${buttonTitle && buttonLink ? `
          <div class="result-summary-action">
            <a class="cta-plan-btn"></a>
          </div>
          ` : ''}
        </div>
      </div>`;
    const announceResult = createResultAnnouncer(block);
    if (summaryImage) block.querySelector('.illustration-wrap').append(summaryImage);
    const labels = block.querySelectorAll('.hra-result-label');
    labels[0].textContent = exemptedLabel;
    labels[1].textContent = taxableLabel;
    const citySlot = block.querySelector('.hra-result-city-slot');
    const updateHraPlan = () => {
      const calculator = hraScope.querySelector('.calculators.hra-text');
      calculator?.dispatchEvent(new CustomEvent('hra-plan-input-change', { bubbles: true }));
    };
    const updateMetroCityLabels = (isMetroCity) => {
      const choiceLabels = citySlot.querySelectorAll('.tobacco-choice-label');
      choiceLabels[0]?.classList.toggle('is-selected', !isMetroCity);
      choiceLabels[1]?.classList.toggle('is-selected', isMetroCity);
    };
    const metroCityField = createTobaccoField({
      id: 'hra-result-metro-city',
      label: 'Do you live in metro city like Delhi, Mumbai, Kolkata or Chennai?',
      required: true,
      value: metroCityDefault,
      optionsList: [
        { label: 'No', value: 'no' },
        { label: 'Yes', value: 'yes' },
      ],
      onChange: (isMetroCity) => {
        updateMetroCityLabels(isMetroCity === 'yes');
        updateHraPlan();
      },
    });
    hraScope.hraMetroCityField = metroCityField;
    if (metroCityField) citySlot.append(metroCityField.element);
    updateMetroCityLabels(metroCityDefault === 'yes');
    if (buttonTitle && buttonLink) {
      const button = block.querySelector('.cta-plan-btn');
      button.href = buttonLink;
      button.textContent = buttonTitle;
      button.setAttribute('aria-label', buttonTitle);
    }
    const formatCurrency = (value) => `₹ ${value.toLocaleString('en-IN', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}`;
    const updateHraResults = ({ result }) => {
      const exempted = block.querySelector('[data-hra-result="exempted"]');
      const taxable = block.querySelector('[data-hra-result="taxable"]');
      exempted.textContent = Number.isFinite(result?.exemptedHra)
        ? formatCurrency(result.exemptedHra) : '--';
      taxable.textContent = Number.isFinite(result?.taxableHra)
        ? formatCurrency(result.taxableHra) : '--';
      announceResult(
        `${exemptedLabel}: ${exempted.textContent}. ${taxableLabel}: ${taxable.textContent}.`,
      );
    };
    hraScope.addEventListener('hra-plan-update', (event) => updateHraResults(event.detail));
    updateHraPlan();
    if (hraScope.hraPlanInputs) updateHraResults({ result: hraScope.hraPlanResult });
    return;
  }
  const isHlv = authoredType === 'hlv'
    || (!authoredType && Boolean(block.closest('.hlv-calculator')));
  if (isHlv) {
    const resultLabel = getText(27) || 'Your Human Life Value (HLV) is:';
    const buttonTitle = getText(28);
    const buttonLink = getRow(29)?.querySelector('a')?.getAttribute('href')?.trim();
    const summaryImage = markDecorativeImage(
      getRow(30)?.querySelector('picture')?.cloneNode(true),
    );
    const hlvScope = getCalculatorScope(block, 'hlv');
    block.dataset.calculatorType = 'hlv';
    block.innerHTML = `
      <div class="calc-card">
        <div class="result-summary-content">
          <div class="result-summary-details hlv-result-details${summaryImage
    ? '' : ' hlv-result-details-no-image'}">
            ${summaryImage ? '<div class="illustration-wrap"></div>' : ''}
            <div class="savings-summary-box">
              <p class="hlv-result-label"></p>
              <p class="savings-amount-text" data-hlv-result>--</p>
            </div>
          </div>
          ${buttonTitle && buttonLink ? `
          <div class="result-summary-action">
            <a class="cta-plan-btn"></a>
          </div>
          ` : ''}
        </div>
      </div>`;
    const announceResult = createResultAnnouncer(block);
    block.querySelector('.hlv-result-label').textContent = resultLabel;
    if (summaryImage) block.querySelector('.illustration-wrap').append(summaryImage);
    if (buttonTitle && buttonLink) {
      const button = block.querySelector('.cta-plan-btn');
      button.href = buttonLink;
      button.textContent = buttonTitle;
      button.setAttribute('aria-label', buttonTitle);
    }
    const updateHlvResults = ({ result }) => {
      const value = block.querySelector('[data-hlv-result]');
      value.textContent = Number.isFinite(result?.humanLifeValue)
        ? `₹ ${Math.round(result.humanLifeValue).toLocaleString('en-IN')}` : '--';
      announceResult(`${resultLabel} ${value.textContent}`);
    };
    hlvScope.addEventListener('hlv-plan-update', (event) => updateHlvResults(event.detail));
    updateHlvResults({
      result: hlvScope.hlvPlanResult,
    });
    return;
  }
  const isSavings = authoredType === 'savings'
    || (!authoredType && Boolean(block.closest('.savings-calculator')));
  const calculatorType = isSavings ? 'savings' : 'retirement';
  const summaryTitle = isSavings ? '' : getText(0);
  const summaryImage = markDecorativeImage(
    getRow(isSavings ? 18 : 1)?.querySelector('picture')?.cloneNode(true),
  );
  const resultHeading = isSavings ? getText(10) : '';
  const monthlyLabel = getText(isSavings ? 11 : 3);
  const yearlyLabel = getText(isSavings ? 12 : 4);
  const monthlySavingsTitle = isSavings ? '' : getText(5);
  const yearlySavingsTitle = isSavings ? '' : getText(6);
  const monthlyCaption = isSavings ? getText(13) : '';
  const yearlyCaption = isSavings ? getText(14) : '';
  const coveredMessage = isSavings ? getText(15) : '';
  const buttonTitle = getText(isSavings ? 16 : 7);
  const buttonLink = getRow(isSavings ? 17 : 8)
    ?.querySelector('a')?.getAttribute('href')?.trim();
  const hasSavings = isSavings || Boolean(monthlySavingsTitle || yearlySavingsTitle);
  const hasToggle = isSavings
    ? Boolean(monthlyLabel && yearlyLabel)
    : Boolean(monthlyLabel && yearlyLabel && monthlySavingsTitle && yearlySavingsTitle);
  const hasAction = Boolean(buttonTitle && buttonLink);
  const hasDetails = Boolean(summaryImage || hasSavings);

  if (!summaryTitle && !hasDetails && !hasAction) {
    block.replaceChildren();
    return;
  }

  block.innerHTML = `
    <div class="calc-card">
      ${summaryTitle ? `
      <div class="fund-estimate-box">
        <p class="fund-estimate-label"></p>
        <p class="fund-estimate-value" id="fundResult">--</p>
      </div>
      ` : ''}
      ${hasDetails || hasAction ? `
      <div class="result-summary-content">
        ${hasDetails ? `
        <div class="result-summary-details">
          ${summaryImage ? '<div class="illustration-wrap"></div>' : ''}
          ${hasSavings ? `
          <div class="savings-summary-box">
            ${resultHeading ? '<p class="savings-result-heading"></p>' : ''}
            ${monthlyLabel || yearlyLabel ? `
            <div class="toggle-row">
              ${monthlyLabel ? '<span class="monthly-label"></span>' : ''}
              ${hasToggle ? `
              <label class="switch-label">
                <input type="checkbox" id="freqToggle">
                <span class="switch-knob"></span>
              </label>
              ` : ''}
              ${yearlyLabel ? '<span class="yearly-label"></span>' : ''}
            </div>
            ` : ''}
            ${!isSavings ? '<p class="savings-title-text" id="savingsTitle"></p>' : ''}
            <p class="savings-amount-text" id="savingsResult">--</p>
            ${isSavings ? `
            <p class="savings-result-caption"></p>
            <p class="savings-covered-message" hidden></p>
            ` : ''}
          </div>
          ` : ''}
        </div>
        ` : ''}
        ${hasAction ? `
          <div class="result-summary-action">
            <a class="cta-plan-btn"></a>
          </div>
        ` : ''}
      </div>
      ` : ''}
    </div>
  `;
  const announceResult = createResultAnnouncer(block);

  if (summaryTitle) block.querySelector('.fund-estimate-label').textContent = summaryTitle;
  block.dataset.calculatorType = calculatorType;
  if (resultHeading) block.querySelector('.savings-result-heading').textContent = resultHeading;
  if (summaryImage) block.querySelector('.illustration-wrap').append(summaryImage);

  const fundValue = block.querySelector('.fund-estimate-value');
  const monthlyText = block.querySelector('.monthly-label');
  const yearlyText = block.querySelector('.yearly-label');
  const frequencyToggle = block.querySelector('#freqToggle');
  const savingsTitle = isSavings ? null : block.querySelector('.savings-title-text');
  const savingsValue = block.querySelector('.savings-amount-text');
  const caption = block.querySelector('.savings-result-caption');
  const coveredNotice = block.querySelector('.savings-covered-message');
  if (monthlyText) monthlyText.textContent = monthlyLabel;
  if (yearlyText) yearlyText.textContent = yearlyLabel;
  frequencyToggle?.setAttribute(
    'aria-label',
    `Savings frequency: ${monthlyLabel} or ${yearlyLabel}`,
  );

  if (hasAction) {
    const cta = block.querySelector('.cta-plan-btn');
    cta.href = buttonLink;
    cta.textContent = buttonTitle;
  }

  let latestPlanResult;
  const scope = getCalculatorScope(block, calculatorType);

  function renderPlan(result, inputs) {
    const invalidAgeOrder = !isSavings && Number.isInteger(inputs?.currentAge)
      && Number.isInteger(inputs?.retirementAge)
      && Number.isInteger(inputs?.lifeExpectancy)
      && (inputs.currentAge >= inputs.retirementAge
        || inputs.retirementAge >= inputs.lifeExpectancy);
    let displayResult = result;
    if (invalidAgeOrder) {
      displayResult = { estimatedFund: 0, monthlySavings: 0, yearlySavings: 0 };
    } else if (result?.isValid === false) {
      displayResult = null;
    }
    latestPlanResult = displayResult;
    const formatIndianCurrency = (amount) => `₹ ${Math.round(amount).toLocaleString('en-IN')}`;
    const yearly = frequencyToggle ? frequencyToggle.checked : !monthlySavingsTitle;
    if (savingsTitle) {
      savingsTitle.textContent = yearly ? yearlySavingsTitle : monthlySavingsTitle;
    }
    if (fundValue) {
      fundValue.textContent = displayResult ? formatIndianCurrency(displayResult.estimatedFund) : '--';
    }
    if (savingsValue) {
      savingsValue.textContent = displayResult
        ? formatIndianCurrency(yearly ? displayResult.yearlySavings : displayResult.monthlySavings) : '--';
    }
    if (caption) caption.textContent = yearly ? yearlyCaption : monthlyCaption;
    if (coveredNotice) {
      const amount = yearly ? displayResult?.yearlySavings : displayResult?.monthlySavings;
      coveredNotice.textContent = amount === 0 ? coveredMessage : '';
      coveredNotice.hidden = !coveredNotice.textContent;
      [block.querySelector('.toggle-row'), savingsTitle, savingsValue, caption]
        .forEach((element) => {
          if (element) element.hidden = !coveredNotice.hidden;
        });
    }
    const resultParts = [];
    if (fundValue) resultParts.push(`${summaryTitle}: ${fundValue.textContent}`);
    if (savingsValue && !savingsValue.hidden) {
      const savingsLabel = savingsTitle?.textContent || resultHeading || summaryTitle;
      resultParts.push(`${savingsLabel}: ${savingsValue.textContent}`);
    }
    if (coveredNotice && !coveredNotice.hidden) resultParts.push(coveredNotice.textContent);
    announceResult(resultParts.filter(Boolean).join('. '));
  }

  function updateFrequencyLabels() {
    const yearly = frequencyToggle ? frequencyToggle.checked : !monthlySavingsTitle;
    monthlyText?.classList.toggle('is-selected', !yearly);
    yearlyText?.classList.toggle('is-selected', yearly);
  }

  scope.addEventListener(`${calculatorType}-plan-update`, (event) => {
    renderPlan(event.detail.result, event.detail);
  });
  frequencyToggle?.addEventListener('change', () => {
    updateFrequencyLabels();
    renderPlan(latestPlanResult);
  });
  updateFrequencyLabels();
  renderPlan(scope[`${calculatorType}PlanResult`], scope[`${calculatorType}PlanInputs`]);
}
