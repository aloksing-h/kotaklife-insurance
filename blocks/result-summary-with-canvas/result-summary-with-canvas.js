import createResultAnnouncer from '../calculators/result-announcer.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { loadScript } from '../../scripts/aem.js';

const DEFAULTS = {
  resultLabel: 'You may get',
  summaryTemplate: 'If you invest {investmentAmount} {frequency} for {investmentYears} years at {rate}% p.a.',
  chartLabel: 'Your returns',
  ctaLabel: 'Invest Now',
};

const charts = new WeakMap();
let chartLibraryPromise;

function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!chartLibraryPromise) {
    chartLibraryPromise = loadScript(`${window.hlx.codeBasePath}/scripts/chart.js`)
      .then(() => {
        if (!window.Chart) throw new Error('Chart.js failed to initialize.');
        return window.Chart;
      })
      .catch((error) => {
        chartLibraryPromise = undefined;
        throw error;
      });
  }
  return chartLibraryPromise;
}

function formatAmount(value) {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const absoluteAmount = Math.abs(safeAmount);
  if (absoluteAmount >= 10000000) {
    return `${(safeAmount / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
  }
  if (absoluteAmount >= 100000) {
    return `${(safeAmount / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
  }
  return Math.round(safeAmount).toLocaleString('en-IN');
}

function formatCurrency(value) {
  return `\u20B9 ${formatAmount(value)}`;
}

function formatExactCurrency(value) {
  return `\u20B9 ${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 })}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function getFrequencyLabel(frequency) {
  return {
    monthly: 'monthly',
    12: 'monthly',
    4: 'quarterly',
    2: 'every six months',
    1: 'yearly',
  }[frequency] || '';
}

export default function decorate(block) {
  const authoredRows = [...block.children];
  const readText = (index, fallback) => authoredRows[index]?.textContent.trim() || fallback;
  const authoredCalculatorType = readText(0, '');
  const isPpfSection = Boolean(block.closest('.ppf-calculator'));
  const hasCalculatorTypeField = ['compound', 'ulip', 'fd', 'rd', 'sip', 'ppf']
    .includes(authoredCalculatorType);
  let calculatorType = 'compound';
  if (isPpfSection) calculatorType = 'ppf';
  else if (hasCalculatorTypeField) calculatorType = authoredCalculatorType;
  const isCompound = calculatorType === 'compound';
  const isUlip = calculatorType === 'ulip';
  const isFd = calculatorType === 'fd';
  const isRd = calculatorType === 'rd';
  const isSip = calculatorType === 'sip';
  const isPpf = calculatorType === 'ppf';
  const isDeposit = isFd || isRd || isSip || isPpf;
  const formatDepositCurrency = (value) => {
    if (!isRd && !isSip) return formatExactCurrency(value);
    const fractionDigits = isRd ? 2 : 0;
    return `\u20B9 ${Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })}`;
  };
  let fieldOffset = hasCalculatorTypeField ? 1 : 0;
  let ctaLabelIndex = hasCalculatorTypeField ? 5 : 4;
  let ctaLinkIndex = hasCalculatorTypeField ? 6 : 5;
  let instrumentationRows = hasCalculatorTypeField ? [1, 2, 4, 3, 5, 6] : [0, 1, 3, 2, 4, 5];
  if (isUlip) {
    fieldOffset = 7;
    ctaLabelIndex = 10;
    ctaLinkIndex = 11;
    instrumentationRows = [7, 8, 9, 3, 10, 11];
    // Older published ULIP markup puts its summary before the invested-series label.
    if (/\{(?:investmentAmount|totalInvested)\}/.test(readText(7, ''))) {
      fieldOffset = 6;
      instrumentationRows = [6, 7, 8, 9, 10, 11];
    }
  } else if (isDeposit) {
    instrumentationRows = [1, 2, 4, 3, 5, 6];
  } else if (isCompound) {
    instrumentationRows = [1, 2, 4, 3, 5, 6];
  }
  const link = authoredRows[ctaLinkIndex]?.querySelector('a');
  const ctaHref = link?.getAttribute('href')?.trim() || '';
  let resultLabel = readText(fieldOffset, isUlip ? '' : DEFAULTS.resultLabel);
  let summaryTemplate = readText(fieldOffset + 1, isUlip ? '' : DEFAULTS.summaryTemplate);
  let chartLabel = readText(
    isUlip ? fieldOffset + 2 : fieldOffset + 3,
    isUlip ? '' : DEFAULTS.chartLabel,
  );
  let investedChartLabel = isUlip
    ? readText(instrumentationRows[3], '') : readText(3, 'Amount Invested');
  if (isUlip) {
    summaryTemplate = summaryTemplate.replace(
      /\{investmentAmount\}\s+monthly\b/g,
      '{investmentAmount} {frequency}',
    );
  }
  if (isDeposit) {
    if (resultLabel === DEFAULTS.resultLabel) {
      resultLabel = isSip || isPpf ? 'Maturity Value' : 'Total Value';
    }
    if (summaryTemplate === DEFAULTS.summaryTemplate) {
      if (isRd || isSip) {
        summaryTemplate = 'If you invest {investmentAmount} monthly for {investmentYears} years at {rate}% p.a.';
      } else if (isPpf) {
        summaryTemplate = 'If you invest {investmentAmount} yearly for {investmentYears} years at {rate}% p.a.';
      } else {
        summaryTemplate = 'If you invest {investmentAmount} for {investmentYears} years at {rate}% p.a.';
      }
    }
    if (chartLabel === DEFAULTS.chartLabel) {
      chartLabel = isSip ? 'Estimated Returns' : 'Est. Returns';
    }
    investedChartLabel = readText(3, isSip || isPpf ? 'Total Investment' : 'Invested Amount');
  } else if (isCompound) {
    investedChartLabel = readText(3, 'Amount Invested');
  }
  if (isCompound) {
    if (chartLabel === DEFAULTS.chartLabel) chartLabel = 'Future Value';
  }
  const ctaLabel = readText(ctaLabelIndex, isUlip ? '' : DEFAULTS.ctaLabel);

  block.innerHTML = `
    <div class="result-card">
      <div class="result-total">
        <p class="result-label"></p>
        <p class="result-amount">--</p>
        <p class="investment-summary"></p>
      </div>
      <div class="result-chart">
        <div class="chart-legends">
          <button class="chart-legend" type="button" aria-pressed="true">
            <span class="chart-legend-dot" aria-hidden="true"></span>
            <span class="chart-legend-copy">
              <span class="chart-legend-label">Future value</span>
              <span class="chart-legend-value" hidden></span>
            </span>
          </button>
          <button class="chart-legend chart-legend-invested" type="button" aria-pressed="true" hidden>
            <span class="chart-legend-dot" aria-hidden="true"></span>
            <span class="chart-legend-copy">
              <span class="chart-legend-label">Amount invested</span>
              <span class="chart-legend-value" hidden></span>
            </span>
          </button>
        </div>
        <div class="chart-plot">
          <canvas class="chart-canvas" role="img" aria-label=""></canvas>
        </div>
      </div>
      <a class="result-cta"><span class="cta-label"></span></a>
    </div>`;

  const resultLabelElement = block.querySelector('.result-label');
  const summaryElement = block.querySelector('.investment-summary');
  const amountElement = block.querySelector('.result-amount');
  const announceResult = createResultAnnouncer(block);
  const chartLegends = [...block.querySelectorAll('.chart-legend')];
  const chartLabelElements = [...block.querySelectorAll('.chart-legend-label')];
  const chartValueElements = [...block.querySelectorAll('.chart-legend-value')];
  const chartCanvas = block.querySelector('.chart-canvas');
  const resultChart = block.querySelector('.result-chart');
  const cta = block.querySelector('.result-cta');
  const seriesVisible = [true, true];
  block.classList.toggle('fd-pie', isDeposit);
  chartLegends[0].classList.toggle('chart-legend-returns', isUlip || isCompound);

  resultLabelElement.hidden = isUlip && !resultLabel;
  summaryElement.hidden = isSip || (isUlip && !summaryTemplate);
  chartLegends[0].hidden = isUlip && !chartLabel;
  chartLegends[1].hidden = (!isUlip && !isDeposit && !isCompound) || !investedChartLabel;
  resultChart.hidden = isUlip && !chartLabel && !investedChartLabel;
  if (isDeposit) resultChart.hidden = true;
  cta.hidden = isUlip && (!ctaLabel || !ctaHref);
  chartLabelElements[0].textContent = isDeposit ? investedChartLabel : chartLabel;
  chartLabelElements[1].textContent = isDeposit ? chartLabel : investedChartLabel;
  chartLegends.forEach((chartLegend, index) => {
    chartLegend.addEventListener('click', () => {
      seriesVisible[index] = !seriesVisible[index];
      chartLegend.setAttribute('aria-pressed', String(seriesVisible[index]));
      const datasetIndex = Number(chartLegend.dataset.datasetIndex);
      if (!isDeposit && !Number.isInteger(datasetIndex)) return;
      const chart = charts.get(chartCanvas);
      if (chart) {
        if (isDeposit) chart.toggleDataVisibility(index);
        else chart.setDatasetVisibility(datasetIndex, seriesVisible[index]);
        chart.update('none');
      }
    });
  });

  resultLabelElement.textContent = resultLabel;
  chartCanvas.setAttribute('aria-label', chartLabel || resultLabel);
  cta.querySelector('.cta-label').textContent = ctaLabel;
  if (ctaHref) cta.href = ctaHref;
  else cta.setAttribute('aria-disabled', 'true');

  let instrumentationTargets = [
    resultLabelElement,
    summaryElement,
    chartLabelElements[0],
    chartLabelElements[1],
    cta.querySelector('.cta-label'),
    cta,
  ];
  if (isUlip) {
    instrumentationTargets = [
      resultLabelElement,
      summaryElement,
      chartLabelElements[0],
      chartLabelElements[1],
      cta.querySelector('.cta-label'),
      cta,
    ];
  } else if (isDeposit) {
    instrumentationTargets = [
      resultLabelElement,
      summaryElement,
      chartLabelElements[1],
      chartLabelElements[0],
      cta.querySelector('.cta-label'),
      cta,
    ];
  } else if (isCompound) {
    instrumentationTargets = [
      resultLabelElement,
      summaryElement,
      chartLabelElements[0],
      chartLabelElements[1],
      cta.querySelector('.cta-label'),
      cta,
    ];
  }
  instrumentationTargets.forEach((target, index) => {
    if (authoredRows[instrumentationRows[index]]) {
      moveInstrumentation(authoredRows[instrumentationRows[index]], target);
    }
  });

  async function updateLineChart(canvas, label, points) {
    const Chart = await loadChartJs();
    const existingChart = charts.get(canvas);
    const chartPoints = isUlip && points.length ? [
      {
        year: points[0].year - 1,
        balance: 0,
        investedAmount: 0,
        returns: 0,
      },
      ...points,
    ] : points;
    const labels = chartPoints.map((point, index) => {
      if (!isUlip) return String(point.year);
      return index ? `${index}Y` : '';
    });
    const styles = getComputedStyle(block);
    const lineColor = styles.getPropertyValue('--info-800').trim();
    const hasReturnsSeries = !isUlip || Boolean(chartLabel);
    const hasInvestedSeries = (isUlip && Boolean(investedChartLabel)
      && chartPoints.some((point) => Number.isFinite(Number(point.investedAmount))
        && Number.isFinite(Number(point.returns))))
      || (isCompound && Boolean(investedChartLabel)
        && chartPoints.some((point) => Number.isFinite(Number(point.investedAmount))));
    const series = [];
    if (isUlip && hasReturnsSeries) {
      series.push({
        label: chartLabel,
        field: 'balance',
        color: '#1E4679',
        fillStartColor: 'rgba(30, 70, 121, 0.24)',
        fillEndColor: 'rgba(30, 70, 121, 0.05)',
        legendIndex: 0,
      });
    }
    if (isUlip && hasInvestedSeries) {
      series.push({
        label: investedChartLabel,
        field: 'investedAmount',
        color: '#E1122D',
        fillStartColor: 'rgba(225, 18, 45, 0.20)',
        fillEndColor: 'rgba(225, 18, 45, 0.04)',
        legendIndex: 1,
      });
    }
    if (isCompound && hasReturnsSeries) {
      series.push({
        label: chartLabel,
        field: 'balance',
        color: '#1E4679',
        fillStartColor: 'rgba(30, 70, 121, 0.24)',
        fillEndColor: 'rgba(30, 70, 121, 0.05)',
        legendIndex: 0,
      });
    }
    if (isCompound && hasInvestedSeries) {
      series.push({
        label: investedChartLabel,
        field: 'investedAmount',
        color: '#E1122D',
        fillStartColor: 'rgba(225, 18, 45, 0.20)',
        fillEndColor: 'rgba(225, 18, 45, 0.04)',
        legendIndex: 1,
      });
    }
    if (!isUlip && !isCompound && hasReturnsSeries) {
      series.push({
        label: chartLabel,
        field: 'balance',
        color: lineColor,
        type: 'line',
        legendIndex: 0,
      });
    }
    chartLegends[0].hidden = !hasReturnsSeries;
    chartLegends[1].hidden = !hasInvestedSeries;
    resultChart.hidden = isUlip && !hasReturnsSeries && !hasInvestedSeries;
    const datasets = series.map(({
      label: seriesLabel, field, color, fillStartColor, fillEndColor, legendIndex,
    }, index) => {
      chartLegends[legendIndex].dataset.datasetIndex = String(index);
      return {
        label: seriesLabel,
        data: chartPoints.map((point) => Number(point[field])),
        hidden: !seriesVisible[legendIndex],
        yAxisID: 'y',
        borderColor: color,
        backgroundColor: fillStartColor ? ({ chart: chartInstance }) => {
          const { chartArea, ctx } = chartInstance;
          if (!chartArea) return fillStartColor;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, fillStartColor);
          gradient.addColorStop(1, fillEndColor);
          return gradient;
        } : color,
        borderWidth: isUlip || isCompound ? 2 : 3,
        fill: fillStartColor ? 'origin' : false,
        cubicInterpolationMode: 'monotone',
        tension: 0.35,
        pointBackgroundColor: color,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointRadius: isUlip || isCompound ? 0 : 5,
        pointHoverRadius: isUlip || isCompound ? 5 : 6,
      };
    });
    const yAxisMin = 0;

    if (existingChart) {
      existingChart.data.labels = labels;
      existingChart.data.datasets = datasets;
      existingChart.options.scales.y.min = yAxisMin;
      datasets.forEach((dataset, index) => {
        existingChart.setDatasetVisibility(index, !dataset.hidden);
      });
      existingChart.update('none');
      return;
    }

    const gridColor = styles.getPropertyValue('--gray-400').trim();
    const tickColor = styles.getPropertyValue('--Text-text-secondary').trim() || '#414651';
    const amountFontSize = parseFloat(styles.getPropertyValue('--Font-size-Disclaimer')) || 10;
    const amountLineHeight = styles.getPropertyValue('--Line-height-Disclaimer').trim() || '12px';
    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            axis: isUlip || isCompound ? 'x' : 'xy',
            intersect: false,
            callbacks: {
              title: (contexts) => {
                if (isUlip) return '';
                const context = contexts[0];
                if (!context) return '';
                const title = context.chart.data.labels[context.dataIndex] || '';
                return isCompound ? `Year: ${title}` : title;
              },
              label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false, drawTicks: false },
            border: { display: false },
            afterBuildTicks: isUlip ? (scale) => {
              const totalYears = scale.getLabels().length - 1;
              const tickCount = Math.min(4, totalYears);
              const yearTicks = new Set(Array.from(
                { length: tickCount },
                (_, index) => {
                  const year = ((index + 1) * totalYears) / tickCount;
                  const lowerYear = Math.floor(year);
                  return year - lowerYear === 0.5
                    ? lowerYear + (lowerYear % 2) : Math.round(year);
                },
              ));
              scale.ticks = scale.ticks.filter((tick) => yearTicks.has(tick.value));
            } : undefined,
            ticks: {
              autoSkip: !isUlip,
              maxRotation: 0,
              padding: () => (window.matchMedia('(min-width: 900px)').matches ? 17 : 8),
              color: '#414651',
              font: {
                family: styles.fontFamily,
                size: 10,
                weight: 500,
                lineHeight: '12px',
              },
            },
          },
          y: {
            min: yAxisMin,
            grid: { display: true, color: gridColor, borderDash: [4, 4] },
            border: { display: false },
            ticks: {
              count: 5,
              color: tickColor,
              callback: formatAmount,
              font: {
                family: styles.fontFamily,
                size: amountFontSize,
                style: 'normal',
                weight: 500,
                lineHeight: amountLineHeight,
              },
            },
          },
        },
      },
    });
    charts.set(canvas, chart);
  }

  async function updatePieChart(canvas, principal, interest) {
    const Chart = await loadChartJs();
    const existingChart = charts.get(canvas);
    const principalColor = '#1E4679';
    const interestColor = '#E1122D';
    const labels = [investedChartLabel || 'Investment Amount', chartLabel || 'Interest Earned'];
    const data = [principal, interest];
    const dataset = {
      data,
      backgroundColor: [principalColor, interestColor],
      borderWidth: 0,
      hoverOffset: 0,
    };

    if (existingChart) {
      existingChart.data.labels = labels;
      existingChart.data.datasets = [dataset];
      data.forEach((value, index) => {
        if (!existingChart.getDataVisibility(index)) existingChart.toggleDataVisibility(index);
      });
      existingChart.update();
      return;
    }

    const chart = new Chart(canvas, {
      type: 'pie',
      data: { labels, datasets: [dataset] },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        animation: {
          duration: 350,
          easing: 'easeOutCubic',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (contexts) => contexts[0]?.label || '',
              label: (context) => formatDepositCurrency(context.raw),
            },
          },
        },
      },
    });
    charts.set(canvas, chart);
  }

  let pendingChartUpdate;
  let chartIsVisible = !('IntersectionObserver' in window);
  let chartUpdateQueued = false;
  let pieUpdateTimer;

  function flushChartUpdate() {
    chartUpdateQueued = false;
    if (!chartIsVisible || !pendingChartUpdate) return;

    const {
      canvas,
      label,
      points,
      principal,
      interest,
    } = pendingChartUpdate;
    pendingChartUpdate = undefined;
    const update = isDeposit
      ? updatePieChart(canvas, principal, interest)
      : updateLineChart(canvas, label, points);
    update
      .catch(() => chartCanvas.setAttribute('aria-label', chartLabel));
  }

  function queueChartUpdate(chartUpdate) {
    pendingChartUpdate = chartUpdate;
    if (!chartIsVisible) return;
    if (isDeposit && charts.has(chartCanvas)) {
      window.clearTimeout(pieUpdateTimer);
      pieUpdateTimer = window.setTimeout(() => {
        pieUpdateTimer = undefined;
        flushChartUpdate();
      }, 120);
      return;
    }
    if (chartUpdateQueued) return;

    chartUpdateQueued = true;
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(flushChartUpdate, { timeout: 1000 });
    } else {
      window.setTimeout(flushChartUpdate, 0);
    }
  }

  function scheduleChartUpdate(canvas, label, points) {
    queueChartUpdate({ canvas, label, points });
  }

  function schedulePieChartUpdate(canvas, principal, interest) {
    queueChartUpdate({ canvas, principal, interest });
  }

  function updateSummary(inputs, result) {
    const totalInvested = result?.totalInvested ?? result?.investedAmount;
    const values = {
      investmentAmount: formatExactCurrency(
        inputs.monthlyInvestment ?? inputs.investmentAmount,
      ),
      totalInvested: Number.isFinite(totalInvested) ? formatExactCurrency(totalInvested) : '',
      frequency: isUlip && inputs.investmentMode === 'one-time'
        ? 'once' : getFrequencyLabel(inputs.frequency),
      investmentYears: inputs.investmentYears,
      holdingYears: inputs.holdingYears,
      rate: inputs.rate,
      periodicInvestment: inputs.periodicInvestment === undefined
        ? '' : formatExactCurrency(inputs.periodicInvestment),
    };
    const safeTemplate = escapeHTML(summaryTemplate);
    summaryElement.innerHTML = safeTemplate.replace(/\{([a-zA-Z]+)\}/g, (match, key) => {
      if (!Object.prototype.hasOwnProperty.call(values, key)) return match;
      const value = escapeHTML(values[key]);
      return ['investmentAmount', 'totalInvested'].includes(key)
        ? `<strong>${value}</strong>` : value;
    });
  }

  function updateResult(inputs, result) {
    if (!inputs || !result) return;
    if (isCompound && result.errors?.length) return;
    const validationErrors = isCompound && Array.isArray(result.errors) ? result.errors : [];
    const finalAmount = Number(result.finalAmount);
    const formattedAmount = Math.round(Number.isFinite(finalAmount) ? finalAmount : 0).toLocaleString('en-IN');
    amountElement.textContent = `\u20B9 ${formattedAmount}`;
    amountElement.setAttribute('aria-label', `${resultLabel}: ${amountElement.textContent}`);
    updateSummary(inputs, result);
    const yearOrderInvalid = isCompound
      && Number(inputs.investmentYears) > Number(inputs.holdingYears);
    if (validationErrors.length && !yearOrderInvalid) {
      summaryElement.textContent += ` ${validationErrors.join(' ')}`;
      summaryElement.setAttribute('role', 'alert');
    } else {
      summaryElement.removeAttribute('role');
    }
    const outputSummary = summaryElement.hidden ? '' : summaryElement.textContent.trim();
    announceResult([
      `${resultLabel}: ${amountElement.textContent}`,
      outputSummary,
    ].filter(Boolean).join('. '));
    if (isCompound) resultChart.hidden = false;
    const points = result.yearlyData || [];
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const chartDescription = [
      `${chartLabel} chart.`,
      firstPoint && `Starting value: ${formatCurrency(firstPoint.balance)}.`,
      lastPoint && `Value after ${lastPoint.year} years: ${formatCurrency(lastPoint.balance)}.`,
      lastPoint && investedChartLabel
        && `${investedChartLabel}: ${formatCurrency(lastPoint.investedAmount)}.`,
    ].filter(Boolean).join(' ');
    chartCanvas.setAttribute('aria-label', chartDescription || chartLabel || resultLabel);
    scheduleChartUpdate(chartCanvas, chartLabel, result.yearlyData);
  }

  function updateDepositResult(detail) {
    if (!detail) return;
    const inputs = detail.inputs || detail;
    const result = detail.result || detail;
    if (!detail.result && detail.errors?.length) {
      amountElement.textContent = '0';
      summaryElement.textContent = detail.errors.join(' ');
      summaryElement.setAttribute('role', 'alert');
      resultChart.hidden = true;
      chartValueElements.forEach((value) => {
        value.textContent = '';
        value.hidden = true;
      });
      return;
    }
    const monthlyDepositTotal = Number.isFinite(inputs.monthlyInvestment)
      ? inputs.monthlyInvestment * inputs.investmentYears * 12 : undefined;
    const principal = Number(
      result.investedAmount ?? result.investmentAmount
        ?? monthlyDepositTotal ?? inputs.investmentAmount,
    );
    const maturityValue = Number(result.totalValue ?? result.maturityAmount ?? result.finalAmount);
    const interest = Number(result.estimatedReturns ?? result.interestAmount
      ?? result.totalReturns ?? maturityValue - principal);
    if (![principal, maturityValue, interest].every(Number.isFinite)
      || principal < 0 || maturityValue < 0 || interest < 0) return;

    amountElement.textContent = formatDepositCurrency(maturityValue);
    amountElement.setAttribute('aria-label', `${resultLabel}: ${amountElement.textContent}`);
    updateSummary(inputs);
    summaryElement.removeAttribute('role');
    const outputSummary = summaryElement.hidden ? '' : summaryElement.textContent.trim();
    announceResult([
      `${resultLabel}: ${amountElement.textContent}`,
      outputSummary,
    ].filter(Boolean).join('. '));
    chartValueElements[0].textContent = formatDepositCurrency(principal);
    chartValueElements[1].textContent = formatDepositCurrency(interest);
    chartValueElements.forEach((value) => { value.hidden = false; });
    chartLegends.forEach((legend) => legend.setAttribute('aria-pressed', 'true'));
    seriesVisible.fill(true);
    resultChart.hidden = false;
    chartCanvas.setAttribute('aria-label', `${investedChartLabel}: ${formatDepositCurrency(principal)}. ${chartLabel}: ${formatDepositCurrency(interest)}. ${resultLabel}: ${formatDepositCurrency(maturityValue)}.`);
    schedulePieChartUpdate(chartCanvas, principal, interest);
  }

  let calculatorClass = '.compound-calculator';
  if (isFd) calculatorClass = '.fd-calculator';
  if (isRd) calculatorClass = '.rd-calculator';
  if (isSip) calculatorClass = '.sip-calculator';
  if (isPpf) calculatorClass = '.ppf-calculator';
  const scope = block.closest(calculatorClass) || block.closest('.section') || document;
  const ulipScope = block.closest('.ulip-calculator') || block.closest('.section') || document;
  if ('IntersectionObserver' in window) {
    const chartObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      chartIsVisible = true;
      chartObserver.disconnect();
      if (pendingChartUpdate) queueChartUpdate(pendingChartUpdate);
    });
    chartObserver.observe(chartCanvas);
  }

  if (isDeposit) {
    const prefix = calculatorType;
    const eventName = `${prefix}-plan-update`;
    scope.addEventListener(eventName, (event) => updateDepositResult(event.detail));
    updateDepositResult({
      inputs: scope[`${prefix}PlanInputs`],
      result: scope[`${prefix}PlanResult`],
    });
  } else {
    scope.addEventListener('compound-plan-update', (event) => {
      updateResult(event.detail, event.detail);
    });
    ulipScope.addEventListener('ulip-plan-update', (event) => {
      updateResult(event.detail, event.detail);
    });
    updateResult(scope.compoundPlanInputs, scope.compoundPlanResult);
    updateResult(ulipScope.ulipPlanInputs, ulipScope.ulipPlanResult);
  }
}
