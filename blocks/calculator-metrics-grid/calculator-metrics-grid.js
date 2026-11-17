import { getCalculatorScope } from '../calculators/calculator-controller.js';
import createResultAnnouncer from '../calculators/result-announcer.js';

export default function decorate(block) {
  const rows = [...block.children];
  const getText = (index, fallback) => rows[index]?.textContent.trim() || fallback;
  const fireNumberLabel = getText(1, 'Your F.I.R.E number');
  const snapshotTitle = getText(2, 'FIRE snapshot');
  const expensesTodayLabel = getText(3, 'Amount expenses today');
  const retirementExpenseLabel = getText(4, 'Expenses at retirement');
  const leanFireLabel = getText(5, 'Lean FIRE');
  const fatFireLabel = getText(6, 'FAT fire (50)');
  const leanFireTooltip = getText(7, '15 times your annual expenses at retirement.');
  const fatFireTooltip = getText(8, '50 times your annual expenses at retirement.');
  const hasNpsCalculator = Boolean(block.closest('.nps-calculator'));
  const hasFireCalculator = Boolean(block.closest('.fire-calculator'));
  const hasSwpCalculator = Boolean(block.closest('.swp-calculator'));
  const hasBmiCalculator = Boolean(block.closest('.bmi-calculator'));
  const hasGratuityCalculator = Boolean(block.closest('.gratuity-calculator'));
  const hasHraCalculator = Boolean(block.closest('.hra-calculator'));
  const authoredType = getText(0, '').toLowerCase();
  const hasAuthoredType = ['fire', 'nps', 'swp', 'bmi', 'gratuity'].includes(authoredType);
  const renderFire = hasAuthoredType ? authoredType === 'fire'
    : hasFireCalculator || (!hasNpsCalculator && !hasSwpCalculator && !hasBmiCalculator
      && !hasGratuityCalculator && !hasHraCalculator);
  const renderNps = hasAuthoredType ? authoredType === 'nps'
    : hasNpsCalculator || (!hasFireCalculator && !hasSwpCalculator && !hasBmiCalculator
      && !hasGratuityCalculator && !hasHraCalculator);
  const renderSwp = hasAuthoredType ? authoredType === 'swp' : hasSwpCalculator;
  const renderBmi = hasAuthoredType ? authoredType === 'bmi' : hasBmiCalculator;
  const renderGratuity = hasAuthoredType ? authoredType === 'gratuity' : hasGratuityCalculator;
  const bmiLabels = {
    underweight: getText(25, 'Underweight'),
    normal: getText(26, 'Normal'),
    overweight: getText(27, 'Overweight'),
    obese: getText(28, 'Obese'),
  };
  const gratuityResultLabel = getText(29, 'Gratuity Amount');
  const npsInvestedLabel = getText(9, 'Invested Amount');
  const npsWealthLabel = getText(10, 'Pension Wealth');
  const npsLumpsumLabel = getText(11, 'Lumpsum Amount');
  const npsPensionLabel = getText(12, 'Monthly Pension');
  const fireCtaLabel = getText(13, '');
  const fireCtaHref = rows[14]?.querySelector('a')?.getAttribute('href')?.trim() || '';
  const npsCtaLabel = getText(15, '');
  const npsCtaHref = rows[16]?.querySelector('a')?.getAttribute('href')?.trim() || '';
  const swpInvestmentLabel = getText(17, 'Total Investment');
  const swpWithdrawnLabel = getText(18, 'Total Withdrawn');
  const swpTenureLabel = getText(19, 'After a');
  const swpBalanceLabel = getText(20, 'Remaining Balance');
  const swpCtaLabel = getText(21, '');
  const swpCtaHref = rows[22]?.querySelector('a')?.getAttribute('href')?.trim() || '';
  const hasItems = Boolean(expensesTodayLabel || retirementExpenseLabel
    || leanFireLabel || fatFireLabel);

  if (!fireNumberLabel && !snapshotTitle && !hasItems && !hasFireCalculator
    && !hasNpsCalculator && !hasSwpCalculator && !hasGratuityCalculator && !hasHraCalculator
    && !renderSwp && !renderGratuity) {
    block.replaceChildren();
    return;
  }

  block.innerHTML = !renderFire ? '' : `
    <section class="metrics-grid-surface" data-calculator-view="fire" aria-label="FIRE result summary">
      ${fireNumberLabel ? `
      <header class="metrics-grid-hero">
        <span class="metrics-grid-hero-icon" aria-hidden="true">
          <img src="/icons/fire-number-icons.svg" alt="" aria-hidden="true">
        </span>
        <div class="metrics-grid-hero-copy">
          <p class="head-title"></p>
          <p class="metrics-grid-hero-value" data-metric="standard-fire-target">--</p>
          <p class="metrics-grid-hero-caption" data-metric="standard-fire-caption"></p>
        </div>
      </header>
      ` : ''}
      ${fireNumberLabel && (snapshotTitle || hasItems) ? '<div class="metrics-grid-divider" aria-hidden="true"></div>' : ''}
      ${snapshotTitle ? '<h3 class="metrics-grid-title"></h3>' : ''}
      ${hasItems ? `
      <div class="metrics-grid-items">
        ${expensesTodayLabel ? `
        <div class="metrics-grid-item">
          <div class="metrics-grid-item-heading">
            <img src="/icons/amount-expenses-icon.svg" alt="" aria-hidden="true">
            <p class="metrics-grid-label" data-metric="expenses-today-label"></p>
          </div>
          <p class="metrics-grid-value" data-metric="yearly-expense-today">--</p>
        </div>
        ` : ''}
        ${retirementExpenseLabel ? `
        <div class="metrics-grid-item">
          <div class="metrics-grid-item-heading">
            <img src="/icons/expense-age-icon.svg" alt="" aria-hidden="true">
            <p class="metrics-grid-label" data-metric="retirement-expense-label"></p>
          </div>
          <p class="metrics-grid-value" data-metric="yearly-expense-at-retirement">--</p>
        </div>
        ` : ''}
        ${leanFireLabel ? `
        <div class="metrics-grid-item">
          <div class="metrics-grid-item-heading">
            <img src="/icons/lean-fire-icon.svg" alt="" aria-hidden="true">
            <p class="metrics-grid-label">
              <span data-metric="lean-fire-label"></span>
              ${leanFireTooltip ? `<button class="metrics-grid-info" data-metric="lean-fire-info" type="button">
                <img src="/icons/information-icon.svg" alt="" aria-hidden="true">
                <span class="metrics-grid-tooltip" data-metric="lean-fire-tooltip" role="tooltip"></span>
              </button>` : ''}
            </p>
          </div>
          <p class="metrics-grid-value" data-metric="lean-fire-target">--</p>
        </div>
        ` : ''}
        ${fatFireLabel ? `
        <div class="metrics-grid-item">
          <div class="metrics-grid-item-heading">
            <img src="/icons/fat-fire-icon.svg" alt="" aria-hidden="true">
            <p class="metrics-grid-label">
              <span data-metric="fat-fire-label"></span>
              ${fatFireTooltip ? `<button class="metrics-grid-info" data-metric="fat-fire-info" type="button">
                <img src="/icons/information-icon.svg" alt="" aria-hidden="true">
                <span class="metrics-grid-tooltip" data-metric="fat-fire-tooltip" role="tooltip"></span>
              </button>` : ''}
            </p>
          </div>
          <p class="metrics-grid-value" data-metric="fat-fire-target">--</p>
        </div>
        ` : ''}
      </div>
      ` : ''}
    </section>
    ${fireCtaLabel && fireCtaHref ? '<a class="metrics-grid-cta" data-calculator-view="fire"><span class="cta-label"></span></a>' : ''}`;

  const fireCta = block.querySelector('.metrics-grid-cta[data-calculator-view="fire"]');
  if (fireCta) {
    fireCta.href = fireCtaHref;
    fireCta.querySelector('.cta-label').textContent = fireCtaLabel;
  }

  if (renderNps) {
    block.insertAdjacentHTML('beforeend', `
    <section class="metrics-grid-surface" data-calculator-view="nps" aria-label="NPS result summary" hidden>
      <header class="metrics-grid-hero">
        <span class="metrics-grid-hero-icon" aria-hidden="true">
          <img src="/icons/fire-number-icons.svg" alt="" aria-hidden="true">
        </span>
        <div class="metrics-grid-hero-copy">
          <p class="head-title" data-metric="nps-invested-label"></p>
          <p class="metrics-grid-hero-value" data-metric="nps-invested-amount">--</p>
        </div>
      </header>
      <div class="metrics-grid-divider" aria-hidden="true"></div>
      <div class="metrics-grid-items">
        <div class="metrics-grid-item">
          <div class="metrics-grid-item-heading">
            <img src="/icons/amount-expenses-icon.svg" alt="" aria-hidden="true">
            <p class="metrics-grid-label" data-metric="nps-wealth-label"></p>
          </div>
          <p class="metrics-grid-value" data-metric="nps-pension-wealth">--</p>
        </div>
        <div class="metrics-grid-item">
          <div class="metrics-grid-item-heading">
            <img src="/icons/lean-fire-icon.svg" alt="" aria-hidden="true">
            <p class="metrics-grid-label" data-metric="nps-lumpsum-label"></p>
          </div>
          <p class="metrics-grid-value" data-metric="nps-lumpsum-amount">--</p>
        </div>
        <div class="metrics-grid-item">
          <div class="metrics-grid-item-heading">
            <img src="/icons/fat-fire-icon.svg" alt="" aria-hidden="true">
            <p class="metrics-grid-label" data-metric="nps-pension-label"></p>
          </div>
          <p class="metrics-grid-value" data-metric="nps-monthly-pension">--</p>
        </div>
      </div>
    </section>
    <a class="metrics-grid-cta" data-calculator-view="nps" hidden><span class="cta-label"></span></a>`);
  }

  const npsCta = block.querySelector('.metrics-grid-cta[data-calculator-view="nps"]');
  if (npsCta && npsCtaLabel && npsCtaHref) {
    npsCta.href = npsCtaHref;
    npsCta.querySelector('.cta-label').textContent = npsCtaLabel;
  } else if (npsCta) {
    npsCta.remove();
  }

  if (renderSwp) {
    block.insertAdjacentHTML('beforeend', `
    <section class="metrics-grid-surface" data-calculator-view="swp"
      aria-label="SWP result summary" hidden>
      <header class="metrics-grid-hero">
        <span class="metrics-grid-hero-icon" aria-hidden="true">
          <img src="/icons/fire-number-icons.svg" alt="" aria-hidden="true">
        </span>
        <div class="metrics-grid-hero-copy">
          <p class="head-title" data-metric="swp-investment-label"></p>
          <p class="metrics-grid-hero-value" data-metric="swp-investment">--</p>
        </div>
      </header>
      <div class="metrics-grid-divider" aria-hidden="true"></div>
      <div class="metrics-grid-items">
        <div class="metrics-grid-item">
          <div class="metrics-grid-item-heading">
            <img src="/icons/amount-expenses-icon.svg" alt="" aria-hidden="true">
            <p class="metrics-grid-label" data-metric="swp-withdrawal-label"></p>
          </div>
          <p class="metrics-grid-value" data-metric="swp-monthly-withdrawal">--</p>
        </div>
        <div class="metrics-grid-item">
          <div class="metrics-grid-item-heading">
            <img src="/icons/expense-age-icon.svg" alt="" aria-hidden="true">
            <p class="metrics-grid-label" data-metric="swp-balance-label"></p>
          </div>
          <p class="metrics-grid-value" data-metric="swp-final-balance">--</p>
        </div>
        <div class="metrics-grid-item">
          <div class="metrics-grid-item-heading">
            <img src="/icons/lean-fire-icon.svg" alt="" aria-hidden="true">
            <p class="metrics-grid-label" data-metric="swp-tenure-label"></p>
          </div>
          <p class="metrics-grid-value" data-metric="swp-tenure">--</p>
        </div>
      </div>
      <p class="metrics-grid-notice" data-metric="swp-notice" hidden></p>
    </section>
    <a class="metrics-grid-cta" data-calculator-view="swp" hidden>
      <span class="cta-label"></span>
    </a>`);
  }

  const swpCta = block.querySelector('.metrics-grid-cta[data-calculator-view="swp"]');
  if (swpCta && swpCtaLabel && swpCtaHref) {
    swpCta.href = swpCtaHref;
    swpCta.querySelector('.cta-label').textContent = swpCtaLabel;
  } else if (swpCta) {
    swpCta.remove();
  }

  if (renderBmi) {
    block.insertAdjacentHTML('beforeend', `
      <section class="metrics-grid-surface" data-calculator-view="bmi"
        aria-label="BMI result summary">
        <div class="metrics-grid-items">
          <div class="metrics-grid-item">
            <p class="metrics-grid-label" data-metric="bmi-label"></p>
            <p class="metrics-grid-value" data-metric="bmi-value">--</p>
          </div>
          <div class="metrics-grid-item">
            <p class="metrics-grid-label" data-metric="bmi-category-label"></p>
            <p class="metrics-grid-value" data-metric="bmi-category">--</p>
          </div>
        </div>
      </section>`);
  }

  if (renderGratuity) {
    block.insertAdjacentHTML('beforeend', `
      <section class="metrics-grid-surface metrics-grid-gratuity"
        data-calculator-view="gratuity" aria-label="Gratuity result summary">
        <header class="metrics-grid-hero">
          <div class="metrics-grid-hero-copy">
            <p class="head-title" data-metric="gratuity-result-label"></p>
            <p class="metrics-grid-hero-value" data-metric="gratuity-amount">--</p>
          </div>
        </header>
      </section>`);
  }

  const formatCurrency = (value) => `₹ ${Math.round(value).toLocaleString('en-IN')}`;
  const formatOneDecimalCurrency = (value) => `₹ ${value.toLocaleString('en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`;
  const metric = (name) => block.querySelector(`[data-metric="${name}"]`);
  const setMetric = (name, value) => {
    const element = metric(name);
    if (!element) return;
    element.textContent = value;
    if (element.matches('.metrics-grid-value, .metrics-grid-hero-value')) {
      const label = element.closest('.metrics-grid-item')?.querySelector('.metrics-grid-label')
        || element.closest('.metrics-grid-hero-copy')?.querySelector('h2');
      const labelText = label?.querySelector(':scope > [data-metric]')?.textContent.trim()
        || label?.textContent.trim();
      if (labelText) {
        element.setAttribute('aria-label', `${labelText}: ${value}`);
      }
    }
  };
  const announceResult = createResultAnnouncer(block);
  const announceVisibleMetrics = () => {
    const activeView = block.querySelector('.metrics-grid-surface:not([hidden])');
    if (!activeView) return;
    const values = [...activeView.querySelectorAll(
      '.metrics-grid-hero-value, .metrics-grid-value',
    )].map((element) => element.getAttribute('aria-label') || element.textContent.trim());
    const notice = activeView.querySelector('.metrics-grid-notice');
    if (notice && !notice.hidden) values.push(notice.textContent.trim());
    announceResult(values.filter(Boolean).join('. '));
  };
  setMetric('gratuity-result-label', gratuityResultLabel);
  const showView = (viewName) => {
    block.querySelectorAll('[data-calculator-view]').forEach((view) => {
      view.hidden = view.dataset.calculatorView !== viewName;
    });
  };
  function updateFireLabels() {
    const fireHeading = block.querySelector('[data-calculator-view="fire"] .head-title');
    if (fireHeading) {
      fireHeading.textContent = fireNumberLabel;
    }
    const fireTitle = block.querySelector('[data-calculator-view="fire"] .metrics-grid-title');
    if (fireTitle) {
      fireTitle.textContent = snapshotTitle;
    }
    setMetric('expenses-today-label', expensesTodayLabel);
    setMetric('retirement-expense-label', retirementExpenseLabel);
    setMetric('lean-fire-label', leanFireLabel);
    setMetric('fat-fire-label', fatFireLabel);
    setMetric('lean-fire-tooltip', leanFireTooltip);
    setMetric('fat-fire-tooltip', fatFireTooltip);
    const leanInfo = metric('lean-fire-info');
    if (leanInfo) leanInfo.setAttribute('aria-label', `${leanFireLabel}: ${leanFireTooltip}`);
    const fatInfo = metric('fat-fire-info');
    if (fatInfo) fatInfo.setAttribute('aria-label', `${fatFireLabel}: ${fatFireTooltip}`);
  }
  function updateNpsLabels() {
    setMetric('nps-invested-label', npsInvestedLabel);
    setMetric('nps-wealth-label', npsWealthLabel);
    setMetric('nps-lumpsum-label', npsLumpsumLabel);
    setMetric('nps-pension-label', npsPensionLabel);
  }
  function updateSwpLabels() {
    setMetric('swp-investment-label', swpInvestmentLabel);
    setMetric('swp-withdrawal-label', swpWithdrawnLabel);
    setMetric('swp-balance-label', swpBalanceLabel);
    setMetric('swp-tenure-label', swpTenureLabel);
  }
  updateFireLabels();
  updateNpsLabels();
  updateSwpLabels();
  setMetric('bmi-label', getText(23, 'Your BMI'));
  setMetric('bmi-category-label', getText(24, 'Category'));

  function updateBmiMetrics({ result }) {
    showView('bmi');
    const valid = Number.isFinite(result?.bmi) && Object.hasOwn(bmiLabels, result.category);
    setMetric('bmi-value', valid ? result.bmi.toFixed(1) : '--');
    setMetric('bmi-category', valid ? bmiLabels[result.category] : '--');
    const category = metric('bmi-category');
    if (category) {
      if (valid) category.dataset.category = result.category;
      else delete category.dataset.category;
    }
    announceVisibleMetrics();
  }

  function updateGratuityMetrics({ result }) {
    showView('gratuity');
    setMetric('gratuity-amount', Number.isFinite(result?.gratuityAmount)
      ? formatOneDecimalCurrency(result.gratuityAmount) : '--');
    announceVisibleMetrics();
  }

  function updateFireMetrics({ result, retireAge, monthlyExpense }) {
    showView('fire');
    updateFireLabels();
    setMetric('retirement-expense-label', Number.isFinite(Number(retireAge))
      ? `${retirementExpenseLabel} (${retireAge})` : retirementExpenseLabel);
    if (!result?.isValid) {
      [
        'standard-fire-target',
        'yearly-expense-at-retirement',
        'lean-fire-target',
        'fat-fire-target',
      ].forEach((name) => setMetric(name, '--'));
      const yearlyExpenseToday = Number(monthlyExpense) * 12;
      setMetric('yearly-expense-today', Number.isFinite(yearlyExpenseToday)
        && yearlyExpenseToday > 0 ? formatCurrency(yearlyExpenseToday) : '--');
      setMetric('standard-fire-caption', '');
      announceVisibleMetrics();
      return;
    }

    setMetric('standard-fire-target', formatCurrency(result.standardFireTarget));
    setMetric('standard-fire-caption', `${(result.standardFireTarget / 10000000).toFixed(2)} crore`);
    setMetric('yearly-expense-today', formatCurrency(result.yearlyExpenseToday));
    setMetric('yearly-expense-at-retirement', formatCurrency(result.yearlyExpenseAtRetirement));
    setMetric('lean-fire-target', formatCurrency(result.leanFireTarget));
    setMetric('fat-fire-target', formatCurrency(result.fatFireTarget));
    announceVisibleMetrics();
  }

  function updateNpsMetrics({ result }) {
    showView('nps');
    updateNpsLabels();
    if (!result) {
      [
        'nps-invested-amount',
        'nps-pension-wealth',
        'nps-lumpsum-amount',
        'nps-monthly-pension',
      ].forEach((name) => setMetric(name, '--'));
      announceVisibleMetrics();
      return;
    }

    setMetric('nps-invested-amount', formatCurrency(result.investedAmount));
    setMetric('nps-pension-wealth', formatCurrency(result.pensionWealth));
    setMetric('nps-lumpsum-amount', formatCurrency(result.lumpsumAmount));
    setMetric('nps-monthly-pension', formatCurrency(result.monthlyPension));
    announceVisibleMetrics();
  }

  function updateSwpMetrics({ result, errors = [] }) {
    showView('swp');
    updateSwpLabels();
    const notice = metric('swp-notice');
    if (!result) {
      [
        ['swp-investment', formatCurrency(0)],
        ['swp-monthly-withdrawal', `${formatCurrency(0)}`],
        ['swp-final-balance', formatCurrency(0)],
        ['swp-tenure', '0 year'],
      ].forEach(([name, value]) => setMetric(name, value));
      if (notice) {
        notice.textContent = errors.join(' ');
        notice.hidden = !notice.textContent;
      }
      announceVisibleMetrics();
      return;
    }

    setMetric('swp-investment', formatCurrency(result.investmentAmount));
    setMetric(
      'swp-monthly-withdrawal',
      `${formatCurrency(result.monthlyWithdrawal)}`,
    );
    setMetric('swp-final-balance', formatCurrency(result.remainingBalance));
    setMetric('swp-tenure', `${result.investmentYears} year`);
    if (notice) {
      notice.textContent = result.isExhausted
        ? `The investment corpus is exhausted in month ${result.exhaustionMonth}, before the selected tenure ends.`
        : '';
      notice.hidden = !notice.textContent;
    }
    announceVisibleMetrics();
  }

  const fireScope = block.closest('.fire-calculator') || block.closest('.section') || document;
  const npsScope = block.closest('.nps-calculator') || block.closest('.section') || document;
  const swpScope = block.closest('.swp-calculator') || block.closest('.section') || document;
  const bmiScope = getCalculatorScope(block, 'bmi');
  const gratuityScope = block.closest('.gratuity-calculator')
    || block.closest('.section') || document;
  if (renderBmi) {
    bmiScope.addEventListener('bmi-plan-update', (event) => updateBmiMetrics(event.detail));
  }
  if (renderFire) {
    fireScope.addEventListener('fire-plan-update', (event) => updateFireMetrics(event.detail));
  }
  if (renderNps) {
    npsScope.addEventListener('nps-plan-update', (event) => updateNpsMetrics(event.detail));
  }
  if (renderSwp) {
    swpScope.addEventListener('swp-plan-update', (event) => updateSwpMetrics(event.detail));
  }
  if (renderGratuity) {
    gratuityScope.addEventListener(
      'gratuity-plan-update',
      (event) => updateGratuityMetrics(event.detail),
    );
  }
  if (renderBmi) {
    updateBmiMetrics({ result: bmiScope.bmiPlanResult });
  } else if (renderNps && npsScope.npsPlanInputs) {
    updateNpsMetrics({ result: npsScope.npsPlanResult });
  } else if (renderFire && fireScope.firePlanInputs) {
    updateFireMetrics({ ...fireScope.firePlanInputs, result: fireScope.firePlanResult });
  } else if (renderSwp && swpScope.swpPlanInputs) {
    updateSwpMetrics({ result: swpScope.swpPlanResult });
  } else if (renderGratuity && gratuityScope.gratuityPlanInputs) {
    updateGratuityMetrics({ result: gratuityScope.gratuityPlanResult });
  } else {
    let initialView = renderFire ? 'fire' : 'nps';
    if (renderSwp) initialView = 'swp';
    if (renderGratuity) initialView = 'gratuity';
    if (renderBmi) initialView = 'bmi';
    showView(initialView);
  }
}
