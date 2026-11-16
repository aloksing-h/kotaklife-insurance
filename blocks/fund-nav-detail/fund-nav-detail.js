import { loadCSS } from '../../scripts/aem.js';
import {
  div, p, h2, button, span, input, label, table, thead, tbody, tr, th, td, domEl,
} from '../../scripts/dom-helpers.js';
import initDatePicker from '../../scripts/date-picker.js';
import fetchFundNav from './nav-data.js';

/* Authorable settings (key-value block) and their fallbacks */
const AUTHORED_DEFAULTS = {
  defaultRange: 'ytd', // date picker: initial range
  dateColumnLabel: 'Date', // list view: date column header
  navColumnLabel: 'NAV', // list view: NAV column header
};

/* Fixed UI text and icons (code). Fund name, ID, NAV values, dates and the disclaimer are
   dynamic and come from the NAV data (see nav-data.js). */
const UI = {
  historicLabel: 'Historic Graph from {from} to {to}',
  navLabel: 'NAV',
  asOnLabel: 'as on {date}',
  returnsLabel: 'Fund 5 year returns',
  dateRangeLabel: 'Select date range',
  listViewLabel: 'List view',
  graphViewLabel: 'Graph view',
  downloadLabel: 'Download',
  pdfLabel: 'Download as PDF',
  excelLabel: 'Download as Excel',
  listIcon: 'list-view',
  graphIcon: 'graph-view',
  downloadIcon: 'download',
};

/* Authored page with the Fund NAV Detail block; its settings are used when a NAV card opens
   the view in a modal. Looked up next to the current page first, then at the site root. */
const SETTINGS_PAGE = 'fund-nav-detail-demo';

/* Most points the chart draws; longer ranges plot evenly spaced real NAV values */
// const MAX_PLOTTED_POINTS = 120;
/* Keep the trend curve smooth with real NAV samples; list and exports retain all values. */
const MAX_PLOTTED_POINTS = 24;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let pageConfig;
let fragmentConfigPromise;
let instanceCount = 0;

/* ---------- formatting ---------- */

const pad = (n) => String(n).padStart(2, '0');
const parseIsoDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const formatDot = (date) => `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
const formatMonth = (date) => `${MONTHS[date.getMonth()]} ’${String(date.getFullYear()).slice(-2)}`;
const formatAsOn = (date) => `${MONTHS[date.getMonth()]}-${pad(date.getDate())}-${date.getFullYear()}`;
const formatLong = (date) => date.toLocaleDateString('en-US', {
  weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
});
const formatNav = (value) => value.toFixed(4);
const fill = (template, values) => Object.entries(values)
  .reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Parses "DD.MM.YYYY" into a Date, or null */
function parseDot(text) {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return date.getDate() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getFullYear() === Number(match[3]) ? date : null;
}

/* ---------- authored config ---------- */

/**
 * Reads the key-value rows of an authored block.
 * @param {Element} block
 * @returns {object}
 */
function readConfig(block) {
  const keys = Object.fromEntries(Object.keys(AUTHORED_DEFAULTS)
    .map((key) => [key.toLowerCase(), key]));
  const config = {};
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    if (!keyCell || !valueCell) return;
    const key = keys[keyCell.textContent.trim().toLowerCase().replace(/[^a-z0-9]/g, '')];
    if (!key) return;
    const value = valueCell.textContent.trim();
    if (value) config[key] = value;
  });
  return config;
}

/** Reads the settings block from an authored page, or null */
async function fetchPageConfig(path) {
  try {
    const resp = await fetch(`${path}.plain.html`);
    if (!resp.ok) return null;
    const holder = document.createElement('div');
    holder.innerHTML = await resp.text();
    const block = holder.querySelector('.fund-nav-detail');
    return block ? readConfig(block) : null;
  } catch {
    return null;
  }
}

/** Authored config for the modal: block on this page, else the settings page, else defaults */
async function getConfig() {
  if (pageConfig) return pageConfig;
  if (!fragmentConfigPromise) {
    const folder = window.location.pathname.replace(/\/[^/]*$/, '');
    const paths = [...new Set([`${folder}/${SETTINGS_PAGE}`, `/${SETTINGS_PAGE}`])];
    fragmentConfigPromise = paths.reduce(
      (found, path) => found.then((config) => config || fetchPageConfig(path)),
      Promise.resolve(null),
    ).then((config) => config || {});
  }
  return fragmentConfigPromise;
}

function iconUrl(name, fallback) {
  const clean = (name || '').replace(/:/g, '').trim();
  const icon = /^[a-z0-9-]+$/i.test(clean) ? clean : fallback;
  return `${window.hlx?.codeBasePath || ''}/icons/${icon}.svg`;
}

/** Icon drawn with a CSS mask, so it takes the button's text color in every state */
const maskIcon = (name, fallback) => span({
  class: 'fnd-icon',
  'aria-hidden': 'true',
  style: `--fnd-icon-url: url('${iconUrl(name, fallback)}')`,
});

/** Evenly spaced real data points (always keeps the last one) */
function samplePoints(points, max) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

/* ---------- date ranges ---------- */

function rangeFor(key, first, last) {
  const from = new Date(last);
  const months = {
    '1m': 1, '3m': 3, '6m': 6, '1y': 12, '3y': 36, '5y': 60,
  };
  if (key === 'all') return [first, last];
  if (months[key]) {
    const day = from.getDate();
    from.setDate(1);
    from.setMonth(from.getMonth() - months[key]);
    const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
    from.setDate(Math.min(day, lastDay));
  } else {
    from.setMonth(0, 1);
  }
  return [from < first ? first : from, last];
}

/* ---------- rendering ---------- */

/**
 * Renders the fund NAV detail view into a block element.
 * @param {Element} block
 * @param {object} authored Authored config
 * @param {{id?: string, name?: string, code?: string}} fund
 * @returns {{titleId: string, destroy: Function}}
 */
function renderFundNavDetail(block, authored, fund) {
  const config = { ...UI, ...AUTHORED_DEFAULTS, ...authored };
  instanceCount += 1;
  const id = (part) => `fnd-${instanceCount}-${part}`;
  const state = {
    view: 'graph', points: [], visible: [], plotted: [], chart: null, activeIndex: -1,
  };

  /* header */
  const title = h2({ class: 'fnd-title', id: id('title') }, fund.name || '');
  const code = p({ class: 'fnd-code' }, fund.code || '');

  const dateInput = input({
    class: 'fnd-date-input',
    id: id('date'),
    type: 'text',
    role: 'combobox',
    'aria-autocomplete': 'none',
    // inputmode: 'numeric',
    inputmode: 'text',
    disabled: '',
    autocomplete: 'off',
    placeholder: 'DD.MM.YYYY - DD.MM.YYYY',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    'aria-describedby': `${id('date-hint')} ${id('date-error')}`,
  });
  const dateError = p({ class: 'fnd-date-error', id: id('date-error'), 'aria-live': 'polite' });
  const dateToggle = button({
    class: 'fnd-date-toggle',
    type: 'button',
    disabled: '',
    title: config.dateRangeLabel,
    'aria-label': config.dateRangeLabel,
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    'aria-controls': id('calendar'),
  }, span({ class: 'fnd-date-icon', 'aria-hidden': 'true' }));
  let pickerOpener = dateToggle;
  const dateField = div(
    { class: 'fnd-date date-field' },
    label({ class: 'sr-only', for: id('date') }, config.dateRangeLabel),
    dateInput,
    // span({ class: 'fnd-date-icon', 'aria-hidden': 'true' }),
    dateToggle,
    span({ class: 'sr-only', id: id('date-hint') }, 'Format DD.MM.YYYY - DD.MM.YYYY'),
    dateError,
  );

  const viewButton = (view, text, icon, fallback) => button({
    class: 'fnd-icon-btn fnd-view-btn',
    type: 'button',
    'data-view': view,
    'aria-pressed': String(view === state.view),
    'aria-controls': id(`${view}-panel`),
  }, maskIcon(icon, fallback), span({ class: 'sr-only' }, text));
  const listButton = viewButton('list', config.listViewLabel, config.listIcon, UI.listIcon);
  const graphButton = viewButton('graph', config.graphViewLabel, config.graphIcon, UI.graphIcon);

  const downloadToggle = button({
    class: 'fnd-icon-btn fnd-download-btn',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': id('download-menu'),
  }, maskIcon(config.downloadIcon, UI.downloadIcon), span({ class: 'sr-only' }, config.downloadLabel));
  const downloadOption = (format, text) => button({
    class: 'fnd-download-option', type: 'button', 'data-format': format,
  }, text);
  const downloadMenu = div(
    {
      class: 'fnd-download-menu', id: id('download-menu'), role: 'group', 'aria-label': config.downloadLabel, hidden: '',
    },
    downloadOption('pdf', config.pdfLabel),
    downloadOption('xlsx', config.excelLabel),
  );

  const header = div(
    { class: 'fnd-header' },
    div({ class: 'fnd-heading' }, title, code),
    dateField,
    div({ class: 'fnd-views', role: 'group', 'aria-label': 'View' }, listButton, graphButton),
    span({ class: 'fnd-divider', 'aria-hidden': 'true' }),
    div({ class: 'fnd-download' }, downloadToggle, downloadMenu),
  );

  /* graph panel */
  const canvas = domEl('canvas', {
    class: 'fnd-canvas', role: 'img', tabindex: '0', 'aria-describedby': id('chart-help'),
  });
  const tooltipDate = p({ class: 'fnd-tooltip-date' });
  const tooltipValue = p({ class: 'fnd-tooltip-value' });
  const tooltip = div({ class: 'fnd-tooltip', 'aria-hidden': 'true', hidden: '' }, tooltipDate, tooltipValue);
  const live = p({ class: 'sr-only', 'aria-live': 'polite' });
  const caption = p({ class: 'fnd-caption' });
  const navValue = p({ class: 'fnd-summary-value' });
  const navDate = p({ class: 'fnd-summary-note' });
  const returnsValue = p({ class: 'fnd-summary-value' });
  const chartBox = div({ class: 'fnd-chart' }, canvas, tooltip);
  const graphPanel = div(
    { class: 'fnd-panel fnd-graph', id: id('graph-panel') },
    chartBox,
    p({ class: 'sr-only', id: id('chart-help') }, 'Use the left and right arrow keys to read NAV values by date. The list view shows all values as a table.'),
    live,
    caption,
    div(
      { class: 'fnd-summary' },
      div({ class: 'fnd-summary-item' }, p({ class: 'fnd-summary-label' }, config.navLabel), navValue, navDate),
      div({ class: 'fnd-summary-item' }, returnsValue, p({ class: 'fnd-summary-note' }, fund.summary?.fundReturnLabel || config.returnsLabel)),
    ),
  );

  /* list panel */
  const tableCaption = domEl('caption', { class: 'sr-only' });
  const rowsBody = tbody();
  const listPanel = div(
    { class: 'fnd-panel fnd-list', id: id('list-panel'), hidden: '' },
    div(
      {
        class: 'fnd-table-wrap', role: 'region', tabindex: '0', 'aria-labelledby': id('table-caption'),
      },
      table(
        { class: 'fnd-table' },
        tableCaption,
        thead(tr(
          th({ scope: 'col' }, config.dateColumnLabel),
          th({ scope: 'col' }, config.navColumnLabel),
        )),
        rowsBody,
      ),
    ),
  );
  tableCaption.id = id('table-caption');

  const disclaimer = div({ class: 'fnd-disclaimer' });
  const status = p({ class: 'fnd-status', role: 'status' });

  block.replaceChildren(header, graphPanel, listPanel, disclaimer, status);
  block.setAttribute('aria-busy', 'true');

  /* ---------- behaviour ---------- */

  const announce = (text) => {
    live.textContent = '';
    window.requestAnimationFrame(() => { live.textContent = text; });
  };

  const showTooltip = (info) => {
    if (!info) {
      tooltip.hidden = true;
      return;
    }
    const [date, value] = state.plotted[info.index] || [];
    if (!date) return;
    tooltipDate.textContent = formatLong(date);
    tooltipValue.textContent = formatNav(value);
    tooltip.hidden = false;
    const pointX = canvas.offsetLeft + info.x;
    const pointY = canvas.offsetTop + info.y;
    const arrowHeight = parseFloat(getComputedStyle(tooltip, '::after').height);
    const half = tooltip.offsetWidth / 2;
    // const left = Math.min(Math.max(info.x, half), chartBox.clientWidth - half);
    // const above = info.y - tooltip.offsetHeight - 16;
    const left = Math.min(Math.max(pointX, half), chartBox.clientWidth - half);
    const above = pointY - tooltip.offsetHeight - arrowHeight;
    tooltip.classList.toggle('is-below', above < 0);
    tooltip.style.left = `${left}px`;
    // tooltip.style.top = `${above < 0 ? info.y + 16 : above}px`;
    // tooltip.style.setProperty('--fnd-arrow-x', `${info.x - left + half}px`);
    tooltip.style.top = `${above < 0 ? pointY + arrowHeight : above}px`;
    tooltip.style.setProperty('--fnd-arrow-x', `${pointX - left + half}px`);
  };

  const describeChart = () => {
    const values = state.visible.map(([, v]) => v);
    if (!values.length) {
      canvas.setAttribute('aria-label', 'No NAV data for the selected dates');
      return;
    }
    const [from] = state.visible[0];
    const [to, latest] = state.visible[state.visible.length - 1];
    canvas.setAttribute('aria-label', `NAV of ${title.textContent} from ${formatDot(from)} to ${formatDot(to)}: `
      + `lowest ${formatNav(Math.min(...values))}, highest ${formatNav(Math.max(...values))}, latest ${formatNav(latest)}.`);
  };

  /* Chart.js loads only once the graph is on screen; one creation at a time */
  const ensureChart = () => {
    if (state.destroyed || state.chart || state.chartPromise || !state.inView
      || state.view !== 'graph' || !state.plotted.length) return;
    state.chartPromise = import('./nav-chart.js')
      .then(({ default: createNavChart }) => createNavChart(canvas, {
        dates: state.plotted.map(([date]) => date),
        values: state.plotted.map(([, value]) => value),
        formatMonth,
        onTooltip: showTooltip,
      }))
      .then((chart) => {
        if (state.destroyed) {
          chart.destroy();
          return;
        }
        state.chart = chart;
        // the range may have changed while the library was loading
        chart.setNavData(state.plotted.map(([d]) => d), state.plotted.map(([, v]) => v));
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('[fund-nav-detail] chart failed', error);
      });
  };
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      state.inView = true;
      observer.disconnect();
      ensureChart();
    }
  }, { rootMargin: '200px' });
  observer.observe(chartBox);

  const applyRange = (from, to) => {
    state.from = from;
    state.to = to;
    state.visible = state.points.filter(([date]) => date >= from && date <= to);
    state.plotted = samplePoints(state.visible, MAX_PLOTTED_POINTS);
    state.activeIndex = -1;
    dateInput.value = `${formatDot(from)} - ${formatDot(to)}`;
    caption.textContent = fill(config.historicLabel, { from: formatDot(from), to: formatDot(to) });
    tableCaption.textContent = `${title.textContent}: ${caption.textContent}`;

    const frag = document.createDocumentFragment();
    state.visible.forEach(([date, value]) => {
      frag.append(tr(td(formatDot(date)), td(formatNav(value))));
    });
    rowsBody.replaceChildren(frag);

    describeChart();
    showTooltip(null);
    if (state.chart) {
      state.chart.setNavData(state.plotted.map(([d]) => d), state.plotted.map(([, v]) => v));
    } else {
      ensureChart();
    }
  };

  const setView = (view) => {
    state.view = view;
    [listButton, graphButton].forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.view === view)));
    graphPanel.hidden = view !== 'graph';
    listPanel.hidden = view !== 'list';
    if (view === 'graph') {
      if (state.chart) state.chart.resize();
      else ensureChart();
    }
  };
  [listButton, graphButton].forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));

  /* keyboard reading of the chart */
  canvas.addEventListener('keydown', (event) => {
    const last = state.plotted.length - 1;
    if (!state.chart || last < 0) return;
    const steps = {
      ArrowRight: 1, ArrowLeft: -1, PageUp: 7, PageDown: -7,
    };
    let next = state.activeIndex;
    if (event.key in steps) {
      const start = next < 0 ? last : next;
      next = Math.min(last, Math.max(0, start + steps[event.key]));
    } else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else if (event.key === 'Escape') next = -1;
    else return;
    event.preventDefault();
    state.activeIndex = next;
    state.chart.activatePoint(next);
    if (next >= 0) {
      const [date, value] = state.plotted[next];
      announce(`${formatLong(date)}, ${config.navLabel} ${formatNav(value)}`);
    }
  });
  canvas.addEventListener('blur', () => {
    if (state.chart && state.activeIndex >= 0) {
      state.activeIndex = -1;
      state.chart.activatePoint(-1);
    }
  });

  /* download menu */
  const closeMenu = (focusToggle) => {
    if (downloadMenu.hidden) return;
    downloadMenu.hidden = true;
    downloadToggle.setAttribute('aria-expanded', 'false');
    if (focusToggle) downloadToggle.focus();
  };
  const openMenu = () => {
    downloadMenu.hidden = false;
    downloadToggle.setAttribute('aria-expanded', 'true');
    downloadMenu.querySelector('button').focus();
  };
  downloadToggle.addEventListener('click', () => (downloadMenu.hidden ? openMenu() : closeMenu(true)));
  downloadToggle.parentElement.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !downloadMenu.hidden) {
      event.stopPropagation(); // keep the dialog open, close only the menu
      event.preventDefault();
      closeMenu(true);
    }
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && !downloadMenu.hidden) {
      event.preventDefault();
      const options = [...downloadMenu.querySelectorAll('button')];
      const index = options.indexOf(document.activeElement);
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus();
    }
  });
  downloadToggle.parentElement.addEventListener('focusout', (event) => {
    if (!downloadToggle.parentElement.contains(event.relatedTarget)) closeMenu(false);
  });
  const onDocumentClick = (event) => {
    if (!downloadToggle.parentElement.contains(event.target)) closeMenu(false);
  };
  document.addEventListener('click', onDocumentClick);

  downloadMenu.addEventListener('click', async (event) => {
    const option = event.target.closest('[data-format]');
    if (!option || !state.visible.length) return;
    const { format } = option.dataset;
    closeMenu(true);
    status.textContent = `Preparing ${format === 'pdf' ? config.pdfLabel : config.excelLabel} download`;
    downloadToggle.setAttribute('aria-disabled', 'true');
    try {
      const { downloadPdf, downloadExcel } = await import('./nav-export.js');
      const rangeText = `${formatDot(state.from)} - ${formatDot(state.to)}`;
      const data = {
        fileName: `${slug(title.textContent)}-nav-${formatDot(state.from)}-to-${formatDot(state.to)}`.replace(/\./g, '-'),
        title: title.textContent,
        code: code.textContent,
        rangeText: caption.textContent || rangeText,
        columns: [config.dateColumnLabel, config.navColumnLabel],
        rows: state.visible.map(([date, value]) => [formatDot(date), value]),
        disclaimer: disclaimer.textContent.trim(),
      };
      if (format === 'pdf') {
        if (state.chart && state.view === 'graph') {
          data.chartImage = state.chart.toBase64Image('image/png', 1);
          data.chartRatio = canvas.height / canvas.width;
        }
        await downloadPdf(data);
      } else {
        await downloadExcel(data);
      }
      status.textContent = 'Download ready';
    } catch (error) {
      status.textContent = 'Sorry, the download could not be created. Please try again.';
      // eslint-disable-next-line no-console
      console.error('[fund-nav-detail] download failed', error);
    } finally {
      downloadToggle.removeAttribute('aria-disabled');
    }
  });

  /* date range input */
  const pendingError = p({ class: 'fnd-range-error', id: id('range-error'), 'aria-live': 'polite' });
  const rangeHint = span({ class: 'sr-only', id: id('range-hint') }, 'Enter dates as DD.MM.YYYY. Apply confirms the selected range.');
  const rangeStatus = p({ class: 'sr-only', role: 'status', 'aria-atomic': 'true' });
  const rangeInput = (part) => input({
    class: 'fnd-range-input',
    id: id(part),
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    placeholder: 'DD.MM.YYYY',
    // 'aria-describedby': id('range-error'),
    'aria-describedby': `${id('range-hint')} ${id('range-error')}`,
    'aria-required': 'true',
  });
  const fromInput = rangeInput('from');
  const toInput = rangeInput('to');
  // const applyButton = button({ class: 'fnd-range-apply', type: 'button' }, 'Apply');
  const applyButton = button({
    class: 'fnd-range-apply', type: 'button', 'aria-label': 'Apply selected NAV date range',
  }, 'Apply');
  const presets = [
    ['1m', '1 Month'], ['1y', '1 year'], ['3y', '3 Years'], ['5y', '5 Years'],
  ];
  const presetButtons = presets.map(([key, text]) => button({
    class: 'fnd-range-preset', type: 'button', 'data-range': key, 'aria-pressed': 'false',
  }, text));
  const presetGroup = div(
    { class: 'fnd-range-presets', role: 'group', 'aria-label': 'Date range presets' },
    ...presetButtons,
  );
  const rangeFooter = div(
    { class: 'fnd-range-footer' },
    div(
      { class: 'fnd-range-fields' },
      label({ for: fromInput.id }, 'From'),
      fromInput,
      label({ for: toInput.id }, 'To'),
      toInput,
    ),
    applyButton,
    pendingError,
    rangeHint,
    rangeStatus,
  );
  const setPendingError = (message) => {
    pendingError.textContent = message;
    [fromInput, toInput].forEach((field) => {
      if (message) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    });
  };
  const clearPresetSelection = () => {
    presetButtons.forEach((preset) => preset.setAttribute('aria-pressed', 'false'));
  };
  const setPendingDates = (dates) => {
    fromInput.value = dates[0] ? formatDot(dates[0]) : '';
    toInput.value = dates[1] ? formatDot(dates[1]) : '';
    setPendingError('');
  };
  const rangeError = (from, to) => {
    const first = state.points[0]?.[0];
    const last = state.points[state.points.length - 1]?.[0];
    if (!first || !last) return 'NAV dates are not available yet.';
    if (!from || !to) return 'Enter both dates as DD.MM.YYYY.';
    if (from > to) return 'From date must not be after To date.';
    if (from < first || to > last) {
      return `Choose dates between ${formatDot(first)} and ${formatDot(last)}.`;
    }
    return '';
  };
  const setPickerDates = (dates) => {
    state.picker?.setDate(dates, false);
    if (dates[0]) state.picker?.jumpToDate(dates[0], true);
  };
  const applyPendingRange = () => {
    const from = parseDot(fromInput.value);
    const to = parseDot(toInput.value);
    const error = rangeError(from, to);
    setPendingError(error);
    if (error) {
      // (!from ? fromInput : toInput).focus();
      const first = state.points[0]?.[0];
      const invalidFrom = !from || (first && from < first) || (to && from > to);
      (invalidFrom ? fromInput : toInput).focus();
      return;
    }
    dateError.textContent = '';
    dateInput.removeAttribute('aria-invalid');
    state.typedRange = undefined;
    applyRange(from, to);
    setPickerDates([from, to]);
    state.picker?.close();
    // dateInput.focus({ preventScroll: true });
    pickerOpener.focus({ preventScroll: true });
    announce(`NAV date range applied from ${formatLong(from)} to ${formatLong(to)}.`);
  };
  applyButton.addEventListener('click', applyPendingRange);
  presetButtons.forEach((preset) => {
    preset.addEventListener('click', () => {
      // const dates = rangeFor(preset.dataset.range, state.points[0][0],
      //   state.points[state.points.length - 1][0]);
      const dates = rangeFor(
        preset.dataset.range,
        state.points[0][0],
        state.points[state.points.length - 1][0],
      );
      setPendingDates(dates);
      setPickerDates(dates);
      clearPresetSelection();
      preset.setAttribute('aria-pressed', 'true');
      rangeStatus.textContent = `Pending range from ${formatLong(dates[0])} to ${formatLong(dates[1])}.`;
    });
  });
  [fromInput, toInput].forEach((field) => {
    field.addEventListener('input', (event) => {
      clearPresetSelection();
      setPendingError('');
      if (!event.inputType || event.isComposing) return;
      const caret = field.selectionStart ?? field.value.length;
      const digitsBefore = field.value.slice(0, caret).replace(/\D/g, '').length;
      const digits = field.value.replace(/\D/g, '').slice(0, 8);
      const formatted = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
        .filter(Boolean).join('.');
      if (field.value === formatted) return;
      field.value = formatted;
      const positions = [...formatted.matchAll(/\d/g)].map((match) => match.index + 1);
      const nextCaret = positions[digitsBefore - 1] ?? 0;
      field.setSelectionRange(nextCaret, nextCaret);
    });
    field.addEventListener('change', () => {
      const from = parseDot(fromInput.value);
      const to = parseDot(toInput.value);
      const error = rangeError(from, to);
      setPendingError(error);
      if (!error) setPickerDates([from, to]);
    });
  });
  const setDateError = (message) => {
    dateError.textContent = message;
    if (message) dateInput.setAttribute('aria-invalid', 'true');
    else dateInput.removeAttribute('aria-invalid');
  };
  const applyTypedRange = () => {
    const [fromText = '', toText = ''] = dateInput.value.split(/\s+(?:-|to)\s+/);
    const from = parseDot(fromText);
    const to = parseDot(toText);
    const error = rangeError(from, to);
    if (error) {
      setDateError(error);
      return false;
    }
    setDateError('');
    applyRange(from, to);
    return true;
  };
  const syncTypedRange = () => {
    if (state.typedRange === undefined) return true;
    dateInput.value = state.typedRange;
    if (!applyTypedRange()) return false;
    state.typedRange = undefined;
    return true;
  };
  // dateInput.addEventListener('keydown', (event) => {
  //   if (event.key === 'Enter') {
  //     event.preventDefault();
  //     if (applyTypedRange()) state.picker?.setDate([state.from, state.to], false);
  //   } else if (event.key === 'ArrowDown' && event.altKey) {
  //     event.preventDefault();
  //     state.picker?.open();
  //   }
  // });
  dateInput.addEventListener('input', (event) => {
    if (!event.inputType || event.isComposing) return;
    const text = dateInput.value;
    state.typedRange = text;
    const caret = dateInput.selectionStart ?? text.length;
    const digitsBeforeCaret = text.slice(0, caret).replace(/\D/g, '').length;
    const parts = text.split(/\s*(?:-|to)\s*/i);
    if (parts.length > 2) return;
    const formatPart = (part) => {
      if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(part.trim())) return part.trim();
      const digits = part.replace(/\D/g, '').slice(0, 8);
      return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
        .filter(Boolean).join('.');
    };
    const compactDigits = parts[0].replace(/\D/g, '');
    if (parts.length === 1 && compactDigits.length > 8) {
      parts.splice(0, 1, compactDigits.slice(0, 8), compactDigits.slice(8, 16));
    }
    const formatted = parts.map(formatPart).join(' - ');
    if (formatted === text) return;
    const digitPositions = [...formatted.matchAll(/\d/g)].map((match) => match.index + 1);
    const nextCaret = caret === text.length
      ? formatted.length : (digitPositions[digitsBeforeCaret - 1] ?? 0);
    dateInput.value = formatted;
    state.typedRange = formatted;
    dateInput.setSelectionRange(nextCaret, nextCaret);
  });
  dateInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (applyTypedRange()) {
        state.typedRange = undefined;
        state.picker?.setDate([state.from, state.to], false);
        state.picker?.close();
      }
    } else if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      state.picker?.open();
    }
  }, true);
  dateToggle.addEventListener('click', () => {
    if (!state.picker) return;
    pickerOpener = dateToggle;
    if (state.picker.isOpen) state.picker.close();
    else state.picker.open();
  });
  dateField.addEventListener('keydown', (event) => {
    if (!state.picker?.isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      state.picker.close();
      // dateInput.focus({ preventScroll: true });
      pickerOpener.focus({ preventScroll: true });
    } else if (event.key === 'Enter' && event.target.matches('.fnd-range-input')) {
      event.preventDefault();
      event.stopPropagation();
      applyPendingRange();
    } else if (event.key === ' ' && event.target.matches('.flatpickr-day')) {
      event.preventDefault();
      event.stopPropagation();
      if (event.target.getAttribute('aria-disabled') !== 'true') event.target.click();
    } else if (event.key === 'Tab' && state.picker.calendarContainer.contains(event.target)) {
      const calendar = state.picker.calendarContainer;
      const activeDay = event.target.matches('.flatpickr-day') ? event.target
        : calendar.querySelector('.flatpickr-day.selected:not(.flatpickr-disabled)')
          || calendar.querySelector('.flatpickr-day:not(.flatpickr-disabled)');
      const controls = [
        state.picker.prevMonthNav, state.picker.nextMonthNav, activeDay,
        ...presetButtons, fromInput, toInput, applyButton,
      ].filter((control) => control && !control.disabled
        && control.getAttribute('aria-disabled') !== 'true' && control.getClientRects().length);
      const current = controls.indexOf(event.target);
      if (current === -1) return;
      const next = current + (event.shiftKey ? -1 : 1);
      event.stopPropagation();
      if (next < 0 || next >= controls.length) {
        state.picker.close();
        pickerOpener.focus({ preventScroll: true });
      } else {
        event.preventDefault();
        controls[next].focus({ preventScroll: true });
      }
    }
  }, true);

  /* ---------- data ---------- */

  const load = async () => {
    try {
      const data = await fetchFundNav(fund);
      if (state.destroyed) return;
      title.textContent = data.name;
      code.textContent = data.code;
      state.points = data.history.map(([iso, value]) => [parseIsoDate(iso), Number(value)]);
      navValue.textContent = fund.summary?.navValue || `₹${formatNav(Number(data.nav))}`;
      const navOn = formatAsOn(parseIsoDate(data.navDate));
      navDate.textContent = fund.summary?.navDate || fill(config.asOnLabel, { date: navOn });
      returnsValue.textContent = fund.summary?.fundReturn || `${Number(data.returns5y).toFixed(1)}%`;
      disclaimer.textContent = data.disclaimer || '';
      disclaimer.hidden = !data.disclaimer;

      const first = state.points[0][0];
      const last = state.points[state.points.length - 1][0];
      const [from, to] = rangeFor(config.defaultRange, first, last);
      applyRange(from, to);

      state.picker = await initDatePicker(dateInput, {
        mode: 'range',
        dateFormat: 'd.m.Y',
        headerMode: 'label',
        ariaDateFormat: 'l, F j, Y',
        monthSelectorType: 'static',
        altInput: false,
        allowInput: true,
        closeOnSelect: false,
        minDate: first,
        maxDate: last,
        defaultDate: [from, to],
        locale: { rangeSeparator: ' - ', firstDayOfWeek: 0 },
        onDayCreate: (dates, text, instance, day) => {
          day.textContent = String(day.dateObj.getDate()).padStart(2, '0');
          day.setAttribute('role', 'button');
          day.setAttribute('aria-disabled', String(day.classList.contains('flatpickr-disabled')));
          const selected = day.classList.contains('selected') || day.classList.contains('inRange');
          day.setAttribute('aria-pressed', String(selected));
          if (day.classList.contains('today')) day.setAttribute('aria-current', 'date');
        },
        onChange: (dates) => {
          setPendingDates(dates);
          clearPresetSelection();
          rangeStatus.textContent = dates.length === 2
            ? `Pending range from ${formatLong(dates[0])} to ${formatLong(dates[1])}.`
            : 'Start date selected. Choose an end date.';
        },
        onOpen: (dates, text, instance) => {
          const validInput = syncTypedRange();
          instance.setDate([state.from, state.to], false);
          instance.jumpToDate(state.from, true);
          if (validInput) setDateError('');
          else dateInput.value = state.typedRange;
          setPendingDates([state.from, state.to]);
          clearPresetSelection();
          dateInput.setAttribute('aria-expanded', 'true');
          dateToggle.setAttribute('aria-expanded', 'true');
          pickerOpener = document.activeElement === dateInput ? dateInput : dateToggle;
          const calendar = instance.calendarContainer;
          const isDesktop = window.matchMedia('(min-width: 769px)').matches;
          if (isDesktop) {
            calendar.style.right = '0px';
            calendar.style.left = 'auto';
          } else {
            calendar.style.left = '0px';
            calendar.style.right = 'auto';
          }
          const { left, right } = calendar.getBoundingClientRect();
          const offset = Math.max(12 - left, Math.min(0, window.innerWidth - 12 - right));
          if (isDesktop) {
            calendar.style.right = `${-offset}px`;
          } else {
            calendar.style.left = `${offset}px`;
          }
          queueMicrotask(() => {
            if (!instance.isOpen || state.destroyed) return;
            const selectedDay = calendar.querySelector('.flatpickr-day.selected:not(.flatpickr-disabled)')
              || calendar.querySelector('.flatpickr-day:not(.flatpickr-disabled):not(.prevMonthDay)');
            (selectedDay || fromInput).focus({ preventScroll: true });
          });
        },
        onClose: (dates, text, instance) => {
          const validInput = syncTypedRange();
          instance.setDate([state.from, state.to], false);
          if (validInput) setDateError('');
          else dateInput.value = state.typedRange;
          setPendingDates([state.from, state.to]);
          dateInput.setAttribute('aria-expanded', 'false');
          dateToggle.setAttribute('aria-expanded', 'false');
          dateToggle.setAttribute('aria-label', `${config.dateRangeLabel}. Selected ${formatLong(state.from)} to ${formatLong(state.to)}.`);
          rangeStatus.textContent = '';
          if (instance.calendarContainer.contains(document.activeElement)) {
            pickerOpener.focus({ preventScroll: true });
          }
        },
      });
      if (state.destroyed) {
        state.picker?.destroy();
        return;
      }
      if (!state.picker) throw new Error('NAV date picker did not initialize');
      const calendar = state.picker.calendarContainer;
      calendar.classList.add('fnd-range-calendar');
      calendar.id = id('calendar');
      calendar.setAttribute('role', 'dialog');
      calendar.setAttribute('aria-label', config.dateRangeLabel);
      calendar.setAttribute('aria-describedby', rangeHint.id);
      calendar.append(presetGroup, rangeFooter);
      calendar.addEventListener('keydown', (event) => {
        if (event.target.closest('.fnd-range-footer, .fnd-range-presets')) {
          event.stopPropagation();
        }
      }, true);
      dateInput.setAttribute('aria-controls', calendar.id);
      dateInput.parentElement.append(dateToggle);
      dateInput.disabled = false;
      dateToggle.disabled = false;
      dateToggle.setAttribute('aria-label', `${config.dateRangeLabel}. Selected ${formatLong(state.from)} to ${formatLong(state.to)}.`);
      rangeHint.textContent = `Dates between ${formatLong(first)} and ${formatLong(last)}. Enter dates as DD.MM.YYYY. Apply confirms the range.`;
      setPendingDates([state.from, state.to]);
      dateInput.value = `${formatDot(state.from)} - ${formatDot(state.to)}`;
      status.textContent = '';
    } catch (error) {
      status.textContent = 'NAV data is not available right now. Please try again later.';
      // eslint-disable-next-line no-console
      console.error('[fund-nav-detail] data load failed', error);
    } finally {
      block.removeAttribute('aria-busy');
    }
  };
  load();

  return {
    titleId: title.id,
    destroy: () => {
      state.destroyed = true;
      observer.disconnect();
      document.removeEventListener('click', onDocumentClick);
      state.picker?.destroy();
      state.chart?.destroy();
    },
  };
}

const inlineViews = new WeakMap();

export function closeFundNavDetail(container) {
  const view = inlineViews.get(container);
  view?.destroy?.();
  view?.block?.remove();
  inlineViews.delete(container);
  container.classList.remove('nav-modal-active');
  container.closest('.cards-container').classList.remove('nav-modal');
}

/**
 * Renders the NAV detail in a supplied container, or opens it in a modal.
 * @param {{id?: string, name?: string, code?: string}} fund
 * @param {Element} [container] Optional parent for the inline NAV detail block.
 */
export async function openFundNavDetail(fund = {}, container = null) {
  const inlineView = container ? {} : null;
  if (container) {
    closeFundNavDetail(container);
    inlineViews.set(container, inlineView);
  }
  const [config] = await Promise.all([
    getConfig(),
    loadCSS(`${window.hlx.codeBasePath}/blocks/fund-nav-detail/fund-nav-detail.css`),
  ]);
  if (container && inlineViews.get(container) !== inlineView) return;
  const block = div({ class: 'fund-nav-detail block', 'data-block-name': 'fund-nav-detail' });
  if (container) {
    container.append(block);
    container.classList.add('nav-modal-active');
    container.closest('.cards-container').classList.add('nav-modal');
    const view = renderFundNavDetail(block, config, fund);
    Object.assign(inlineView, view, { block });
    const title = block.querySelector(`#${view.titleId}`);
    title.setAttribute('tabindex', '-1');
    title.focus({ preventScroll: true });
    return;
  }
  const { createModal } = await import('../modal/modal.js');
  const { block: modalBlock, showModal } = await createModal([block]);
  const dialog = modalBlock.querySelector('dialog');
  dialog.classList.add('fund-nav-detail-dialog');
  const { titleId, destroy } = renderFundNavDetail(block, config, fund);
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.addEventListener('close', destroy, { once: true });
  showModal();
  // start on the fund name (announced first) instead of ringing the close button
  const title = block.querySelector(`#${titleId}`);
  title.setAttribute('tabindex', '-1');
  title.focus({ preventScroll: true });
}

/**
 * Inline block: renders the fund from `?fund=<id>`, or the first fund.
 * Inside a hidden section it only provides the authored settings to the modal view.
 * @param {Element} block
 */
export default function decorate(block) {
  const config = readConfig(block);
  pageConfig = config;
  block.textContent = '';
  if (block.closest('.dsp-none')) return;
  const fundId = new URLSearchParams(window.location.search).get('fund');
  renderFundNavDetail(block, config, fundId ? { id: fundId } : {});
}
