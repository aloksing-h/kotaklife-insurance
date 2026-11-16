import { moveInstrumentation } from '../../scripts/scripts.js';

let blockCount = 0;

/**
 * Returns the trimmed text of each non-empty child element of a cell.
 * @param {Element} cell
 * @returns {string[]}
 */
function cellTexts(cell) {
  if (!cell) return [];
  const children = [...cell.children];
  const texts = children.length
    ? children.map((el) => el.textContent.trim())
    : [cell.textContent.trim()];
  return texts.filter(Boolean);
}

/**
 * Builds one metric (value + label).
 * @param {string} label
 * @returns {{ metric: HTMLDivElement, value: HTMLParagraphElement }}
 */
function buildMetric(label) {
  const metric = document.createElement('div');
  metric.className = 'fund-highlight-metric';
  const value = document.createElement('p');
  value.className = 'fund-highlight-value';
  const caption = document.createElement('p');
  caption.className = 'fund-highlight-caption';
  caption.textContent = label;
  metric.append(value, caption);
  return { metric, value };
}

/**
 * loads and decorates the fund-highlight block
 * rows: [heading & description] [fund name + date] [metric labels] [periods...]
 * @param {Element} block The block element
 */
export default function decorate(block) {
  blockCount += 1;
  const id = `fund-highlight-${blockCount}`;
  const rows = [...block.children];
  const singles = rows.filter((row) => row.children.length === 1);
  const items = rows.filter((row) => row.children.length > 1);
  const [textRow, cardRow, labelsRow] = singles;

  const header = document.createElement('div');
  header.className = 'fund-highlight-header';
  const textCell = textRow?.firstElementChild;
  if (textCell) {
    moveInstrumentation(textCell, header);
    header.append(...[...textCell.children].filter((el) => el.textContent.trim()));
  }

  const card = document.createElement('div');
  card.className = 'fund-highlight-card';

  const [name, date] = cellTexts(cardRow?.firstElementChild);
  if (name || date) {
    const head = document.createElement('div');
    head.className = 'fund-highlight-head';
    if (name) {
      const title = document.createElement('h3');
      title.className = 'fund-highlight-title';
      title.textContent = name;
      head.append(title);
    }
    if (date) {
      const asOn = document.createElement('p');
      asOn.className = 'fund-highlight-date';
      asOn.textContent = date;
      head.append(asOn);
    }
    card.append(head);
  }

  const periods = items.map((row) => {
    const [label, returns, benchmark] = [...row.children].map((cell) => cell.textContent.trim());
    return {
      row, label, returns, benchmark,
    };
  }).filter((period) => period.label || period.returns || period.benchmark);

  if (periods.length) {
    const [returnsLabel = 'Fund returns', benchmarkLabel = 'Bench mark'] = cellTexts(labelsRow?.firstElementChild);
    const panel = document.createElement('div');
    panel.className = 'fund-highlight-metrics';
    panel.id = `${id}-panel`;
    const returnsMetric = buildMetric(returnsLabel);
    const benchmarkMetric = buildMetric(benchmarkLabel);
    panel.append(returnsMetric.metric, benchmarkMetric.metric);
    card.append(panel);

    const tabs = document.createElement('div');
    tabs.className = 'fund-highlight-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', name ? `${name} return period` : 'Return period');

    const buttons = periods.map((period, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fund-highlight-tab';
      button.id = `${id}-tab-${i}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panel.id);
      button.textContent = period.label || `${i + 1}`;
      moveInstrumentation(period.row, button);
      tabs.append(button);
      return button;
    });

    const select = (index, focus = false) => {
      buttons.forEach((button, i) => {
        const active = i === index;
        button.setAttribute('aria-selected', active);
        button.tabIndex = active ? 0 : -1;
      });
      returnsMetric.value.textContent = periods[index].returns;
      benchmarkMetric.value.textContent = periods[index].benchmark;
      panel.setAttribute('aria-labelledby', buttons[index].id);
      if (focus) buttons[index].focus();
    };

    buttons.forEach((button, i) => button.addEventListener('click', () => select(i)));
    tabs.addEventListener('keydown', (e) => {
      const current = buttons.indexOf(document.activeElement);
      if (current < 0) return;
      const last = buttons.length - 1;
      const next = {
        ArrowRight: current === last ? 0 : current + 1,
        ArrowLeft: current === 0 ? last : current - 1,
        Home: 0,
        End: last,
      }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(next, true);
    });

    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-live', 'polite');
    card.append(tabs);
    select(0);
  }

  block.replaceChildren(...[header, card].filter((el) => el.children.length));
}
