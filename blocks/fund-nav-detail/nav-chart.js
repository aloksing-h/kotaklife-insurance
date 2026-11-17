import { loadScript } from '../../scripts/aem.js';

let chartLibraryPromise;

/**
 * Loads the bundled Chart.js once.
 * @returns {Promise<Function>} The Chart constructor
 */
function loadChartLibrary() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!chartLibraryPromise) {
    chartLibraryPromise = loadScript(`${window.hlx?.codeBasePath || ''}/scripts/chart.js`)
      .then(() => window.Chart);
  }
  return chartLibraryPromise;
}

const cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

/**
 * Converts a hex color token to an rgba() string canvas can use.
 * @param {string} hex e.g. #2E90FA or #FFF
 * @param {number} opacity 0-1
 */
function withAlpha(hex, opacity) {
  let value = hex.replace('#', '');
  if (value.length === 3) value = [...value].map((c) => c + c).join('');
  const int = parseInt(value, 16);
  // eslint-disable-next-line no-bitwise
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${opacity})`;
}

/**
 * Indices of the first data point of each month, thinned out so labels never collide.
 * @param {Date[]} dates
 * @param {number} width Chart width in px
 */
function monthTickIndices(dates, width) {
  const starts = dates.reduce((acc, date, index) => {
    if (index === 0 || date.getMonth() !== dates[index - 1].getMonth()) acc.push(index);
    return acc;
  }, []);
  const step = Math.max(1, Math.ceil((starts.length * 64) / Math.max(width, 1)));
  return new Set(starts.filter((_, i) => i % step === 0));
}

const monthLabelPlugin = {
  id: 'fndMonthLabel',
  afterUpdate(chart) {
    const labels = chart.scales.x.getLabelItems();
    const [first] = labels;
    if (!first) return;

    /* Previous first-label-only positioning:
    first.options.textAlign = 'left';
    first.options.translation[0] = chart.scales.x.left + 60;
    */
    const { ctx } = chart;
    ctx.save();
    /* Previous overlap handling:
    ctx.font = first.font.string;
    const firstRight = first.options.translation[0] + ctx.measureText(first.label).width;
    labels.slice(1).forEach((item) => {
      ctx.font = item.font.string;
      const { width } = ctx.measureText(item.label);
      const left = item.options.translation[0]
        - (item.options.textAlign === 'right' ? width : width / 2);
      if (left < firstRight + chart.scales.x.options.ticks.padding) item.label = '';
    });
    */
    const mobile = !window.matchMedia('(min-width: 769px)').matches;
    const widths = labels.map((item) => {
      ctx.font = item.font.string;
      return ctx.measureText(item.label).width;
    });
    let left = chart.scales.x.left + (mobile ? 12 : 60);
    const totalWidth = widths.reduce((sum, width) => sum + width, 0);
    const gap = labels.length > 1
      ? (chart.scales.x.right - left - totalWidth) / (labels.length - 1) : 0;
    labels.forEach((item, index) => {
      item.options.textAlign = 'left';
      item.options.translation[0] = left;
      if (mobile) {
        item.options.translation[1] = chart.scales.x.top + 8;
      }
      left += widths[index] + gap;
    });
    ctx.restore();
  },
};

/**
 * Vertical indicator line and dot for the active (hovered / focused) point.
 */
const indicatorPlugin = {
  id: 'fndIndicator',
  afterDatasetsDraw(chart, args, options) {
    const [active] = chart.getActiveElements();
    if (!active) return;
    const { ctx, chartArea } = chart;
    const { x, y } = active.element;

    const line = ctx.createLinearGradient(0, y, 0, chartArea.bottom);
    line.addColorStop(0, options.lineColor);
    line.addColorStop(1, withAlpha(options.lineColor, 0));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 2;
    ctx.strokeStyle = line;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = options.lineColor;
    ctx.lineWidth = 3;
    ctx.strokeStyle = options.dotRing;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },
};

/**
 * Creates the NAV line chart.
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 * @param {Date[]} options.dates
 * @param {number[]} options.values
 * @param {Function} options.formatMonth Date => axis label
 * @param {Function} options.onTooltip ({ index, x, y } | null) => void, drives the HTML tooltip
 * @returns {Promise<object>} Chart.js instance
 */
export default async function createNavChart(canvas, {
  dates: initialDates, values, formatMonth, onTooltip,
}) {
  const Chart = await loadChartLibrary();
  const host = canvas.closest('.fund-nav-detail') || document.documentElement;
  const lineColor = cssVar(host, '--blue-500') || '#2E90FA';
  // const fillColor = cssVar(host, '--blue-300') || '#84CAFF';
  const fillColor = cssVar(host, '--Decorative-Blue-decorative-blue-400') || '#53B1FD';
  const fillMidColor = cssVar(host, '--Decorative-Blue-decorative-blue-100') || '#D1E9FF';
  const axisColor = cssVar(host, '--border-primary') || '#D5D7DA';
  const labelColor = cssVar(host, '--text-tertiary') || '#535862';
  const white = cssVar(host, '--base-white') || '#FFF';
  const font = { size: 12, family: cssVar(host, '--font-family-manrope') || 'Manrope, sans-serif' };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dates = [...initialDates];
  let ticks = monthTickIndices(dates, canvas.clientWidth);

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        data: values,
        borderColor: lineColor,
        borderWidth: 2,
        borderCapStyle: 'round',
        borderJoinStyle: 'round',
        tension: 0.4,
        // cubicInterpolationMode: 'monotone',
        cubicInterpolationMode: 'default',
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 10,
        fill: 'start',
        backgroundColor: ({ chart: { ctx, chartArea } }) => {
          /* Previous gradient:
          if (!chartArea) return withAlpha(fillColor, 0.2);
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, withAlpha(fillColor, 0.32));
          gradient.addColorStop(1, withAlpha(fillColor, 0));
          return gradient;
          */
          if (!chartArea) return withAlpha(fillColor, 0.33);
          const height = chartArea.bottom - chartArea.top;
          const gradient = ctx.createLinearGradient(
            0,
            chartArea.top - height * 0.0025,
            0,
            chartArea.top + height * 1.0338,
          );
          gradient.addColorStop(0, withAlpha(fillColor, 0.33));
          gradient.addColorStop((0.4812 + 0.0025) / 1.0363, withAlpha(fillMidColor, 0.33));
          gradient.addColorStop(1, withAlpha('#FFF', 0.33));
          return gradient;
        },
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: () => Math.max(2, window.devicePixelRatio || 1),
      animation: reducedMotion ? false : { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 8, right: 4 } },
      onResize: (instance, size) => { ticks = monthTickIndices(dates, size.width); },
      scales: {
        x: {
          grid: { display: false },
          border: { display: true, color: axisColor },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            padding: 10,
            color: labelColor,
            font,
            callback(value, index) {
              return ticks.has(index) ? formatMonth(dates[index]) : null;
            },
          },
        },
        y: {
          grace: '8%',
          grid: { display: false },
          border: { display: true, color: axisColor },
          ticks: {
            maxTicksLimit: 7,
            padding: 12,
            color: labelColor,
            font,
            callback: (value) => Number(value.toFixed(2)).toString(),
          },
        },
      },
      plugins: {
        legend: { display: false },
        fndIndicator: { lineColor, dotRing: white },
        tooltip: {
          enabled: false,
          external: ({ tooltip }) => {
            if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
              onTooltip(null);
              return;
            }
            onTooltip({
              index: tooltip.dataPoints[0].dataIndex,
              x: tooltip.caretX,
              y: tooltip.caretY,
            });
          },
        },
      },
    },
    // plugins: [indicatorPlugin],
    plugins: [indicatorPlugin, monthLabelPlugin],
  });

  chart.setNavData = (nextDates, nextValues) => {
    dates.splice(0, dates.length, ...nextDates);
    ticks = monthTickIndices(dates, chart.width);
    chart.data.labels = dates;
    chart.data.datasets[0].data = nextValues;
    chart.setActiveElements([]);
    chart.tooltip.setActiveElements([], { x: 0, y: 0 });
    chart.update(reducedMotion ? 'none' : undefined);
  };

  /** Activates a point (keyboard navigation), or clears it with -1. */
  chart.activatePoint = (index) => {
    if (index < 0) {
      chart.setActiveElements([]);
      chart.tooltip.setActiveElements([], { x: 0, y: 0 });
    } else {
      const point = chart.getDatasetMeta(0).data[index];
      chart.setActiveElements([{ datasetIndex: 0, index }]);
      chart.tooltip.setActiveElements([{ datasetIndex: 0, index }], { x: point.x, y: point.y });
    }
    chart.update('none');
  };

  return chart;
}
