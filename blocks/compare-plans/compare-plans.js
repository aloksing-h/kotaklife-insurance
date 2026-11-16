import { decorateIcons, toClassName } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const MIN_SELECTED = 2;
// up to four plans can be selected, but only three are compared at a time
// (shown next to the current plan); a fourth selection disables Compare Now
const MAX_SELECTED = 4;
const MAX_COMPARED = 3;
const DEFAULT_LABELS = ['Compare Now', 'Starts from', 'Get Now', 'Only three cards can be compared at a time.'];

let blockIdx = 0;

/**
 * Non-empty child elements of a cell.
 * @param {Element} cell
 * @returns {Element[]}
 */
function cellElements(cell) {
  return [...(cell?.children || [])].filter((el) => el.textContent.trim());
}

/**
 * Trimmed texts of a cell: one per child element, or the cell text itself.
 * @param {Element} cell
 * @returns {string[]}
 */
function cellTexts(cell) {
  if (!cell) return [];
  const texts = cell.children.length
    ? cellElements(cell).map((el) => el.textContent.trim())
    : [cell.textContent.trim()];
  return texts.filter(Boolean);
}

/**
 * Normalises a feature label so plans can be matched against the master list.
 * @param {string} label
 * @returns {string}
 */
function featureKey(label) {
  return label.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * List item texts of the first list in a cell.
 * @param {Element} cell
 * @returns {string[]}
 */
function listItems(cell) {
  const list = cell?.querySelector('ul, ol');
  return list ? [...list.children].map((li) => li.textContent.trim()).filter(Boolean) : [];
}

/**
 * Link of a cell; the authored text is kept unless it is just the URL.
 * @param {Element} cell
 * @returns {{ href: string, text: string }}
 */
function readLink(cell) {
  const a = cell?.querySelector('a[href]');
  if (!a) return { href: '', text: '' };
  const text = a.textContent.trim();
  const isUrl = /^(\/|https?:)/.test(text);
  return { href: a.getAttribute('href'), text: isUrl ? '' : text };
}

/**
 * A Current Plan Card row is [name] [features] [price] [link]; a Compare Plan Card
 * row ends with its plan id / selected-by-default cell (always holds true or false).
 * @param {Element} row
 * @returns {boolean}
 */
function isCurrentPlanRow(row) {
  const cells = [...row.children];
  const last = cellTexts(cells[cells.length - 1]);
  if (last.some((value) => value === 'true' || value === 'false')) return false;
  return !row.querySelector('picture') || !!cells[1]?.querySelector('ul, ol');
}

/**
 * Reads a Current Plan Card row.
 * @param {Element} row
 * @returns {object}
 */
function readCurrentPlan(row) {
  const [titleCell, featuresCell, priceCell, linkCell] = [...row.children];
  const titleEl = titleCell?.querySelector('p, h2, h3, h4') || titleCell;
  const link = readLink(linkCell);
  return {
    row,
    titleNodes: titleEl ? [...titleEl.childNodes] : [],
    features: listItems(featuresCell),
    price: priceCell?.textContent.trim() || '',
    href: link.href,
    cta: link.text,
  };
}

/**
 * Builds a selectable plan card from an item row:
 * [plan name + price] [illustration] [features + price + link] [plan id + selected]
 * @param {Element} row
 * @param {string} name checkbox group name
 * @returns {HTMLLIElement}
 */
function buildCard(row, name) {
  const [contentCell, imageCell, compareCell, optionsCell] = [...row.children];
  const card = document.createElement('li');
  card.className = 'compare-plans-card';
  moveInstrumentation(row, card);

  const option = document.createElement('label');
  option.className = 'compare-plans-option';

  const [titleEl, ...rest] = [...(contentCell?.querySelectorAll('p, h3, h4') || [])];
  const titleText = titleEl?.textContent.trim() || '';
  const options = cellTexts(optionsCell);
  const flag = options.find((value) => value === 'true' || value === 'false');
  const id = options.find((value) => value !== flag);

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = name;
  input.value = toClassName(id || titleText);
  input.className = 'compare-plans-checkbox';
  input.checked = flag === 'true';

  const checkmark = document.createElement('span');
  checkmark.className = 'compare-plans-checkmark';
  checkmark.setAttribute('aria-hidden', 'true');

  const content = document.createElement('span');
  content.className = 'compare-plans-content';
  const title = document.createElement('span');
  title.className = 'compare-plans-title';
  if (titleEl) {
    title.append(...titleEl.childNodes);
    content.append(title);
  }
  rest.forEach((el) => {
    if (!el.textContent.trim()) return;
    const price = document.createElement('span');
    price.className = 'compare-plans-price';
    price.append(...el.childNodes);
    content.append(price);
  });

  option.append(input, checkmark, content);

  const picture = imageCell?.querySelector('picture');
  if (picture) {
    const media = document.createElement('span');
    media.className = 'compare-plans-media';
    const img = picture.querySelector('img');
    if (img) {
      img.loading = 'lazy';
      if (!img.alt) img.setAttribute('aria-hidden', 'true');
    }
    media.append(picture);
    option.append(media);
  }

  card.append(option);

  // comparison details: [included features] [price] [buy link]
  const priceEl = cellElements(compareCell)
    .filter((el) => !el.matches('ul, ol') && !el.querySelector('a'))
    .pop();
  const link = readLink(compareCell);
  card.comparison = {
    titleNodes: [...title.childNodes],
    features: listItems(compareCell),
    price: priceEl?.textContent.trim() || '',
    href: link.href,
    cta: link.text,
  };
  return card;
}

/**
 * Builds one comparison card.
 * @param {object} plan
 * @param {string[]} master ordered list of every compared feature
 * @param {string[]} labels [compare, price label, buy button]
 * @param {boolean} current whether this is the current (highlighted) plan
 * @returns {HTMLLIElement}
 */
function buildPlan(plan, master, labels, current) {
  const [, priceLabel, ctaLabel] = labels;
  const item = document.createElement('li');
  item.className = `compare-plans-plan${current ? ' compare-plans-plan-current' : ''}`;

  const title = document.createElement('h3');
  title.className = 'compare-plans-plan-title';
  title.append(...plan.titleNodes.map((node) => node.cloneNode(true)));
  item.append(title);

  const included = new Set(plan.features.map(featureKey));
  const names = [...master];
  // features a plan lists that are not in the master list are still shown as included
  plan.features.forEach((feature) => {
    const key = featureKey(feature);
    if (!names.some((nameText) => featureKey(nameText) === key)) names.push(feature);
  });
  if (names.length) {
    const list = document.createElement('ul');
    list.className = 'compare-plans-features';
    names.forEach((feature) => {
      const has = current || included.has(featureKey(feature));
      const li = document.createElement('li');
      li.className = has ? 'is-included' : 'is-excluded';
      li.innerHTML = `<span class="compare-plans-sr">${has ? 'Included' : 'Not included'}: </span>`;
      li.append(feature);
      list.append(li);
    });
    item.append(list);
  }

  const footer = document.createElement('div');
  footer.className = 'compare-plans-plan-footer';
  if (plan.price) {
    const label = document.createElement('p');
    label.className = 'compare-plans-plan-label';
    label.textContent = priceLabel;
    const price = document.createElement('p');
    price.className = 'compare-plans-plan-price';
    price.textContent = plan.price;
    footer.append(label, price);
  }
  if (plan.href) {
    const cta = document.createElement('a');
    cta.className = 'compare-plans-plan-cta';
    cta.href = '#';
    const ctaText = plan.cta || ctaLabel;
    const named = title.cloneNode(true);
    named.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
    const planName = named.textContent.replace(/\s+/g, ' ').trim();
    cta.innerHTML = `<span></span><span class="icon icon-${current ? 'right-red-filled' : 'right-white-filled'}"></span>`;
    cta.firstElementChild.textContent = ctaText;
    if (planName) cta.setAttribute('aria-label', `${ctaText}: ${planName}`);
    decorateIcons(cta);
    footer.append(cta);
  }
  if (footer.children.length) item.append(footer);
  return item;
}

/**
 * loads and decorates the compare-plans block
 * rows: [heading & subtitle] [labels] [current plan card] [compare plan cards...]
 * @param {Element} block The block element
 */
export default function decorate(block) {
  blockIdx += 1;
  const name = `compare-plans-${blockIdx}`;

  const header = document.createElement('div');
  header.className = 'compare-plans-header';
  const cards = document.createElement('ul');
  cards.className = 'compare-plans-cards';

  const rows = [...block.children];
  const [textRow, labelsRow] = rows.filter((row) => row.children.length === 1);
  const currentPlans = [];
  rows.filter((row) => row.children.length > 1).forEach((row) => {
    if (isCurrentPlanRow(row)) currentPlans.push(readCurrentPlan(row));
    else cards.append(buildCard(row, name));
  });
  const currentPlan = currentPlans[0] || null;

  const textCell = textRow?.firstElementChild;
  if (textCell?.textContent.trim()) {
    moveInstrumentation(textCell, header);
    header.append(...textCell.childNodes);
  }
  const authoredLabels = cellTexts(labelsRow?.firstElementChild);
  const labels = DEFAULT_LABELS.map((fallback, i) => authoredLabels[i] || fallback);
  const [, , , limitMessage] = labels;

  const heading = header.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    heading.id = heading.id || `${name}-heading`;
    cards.setAttribute('aria-labelledby', heading.id);
  }

  // compare bar: live count + Compare Now button
  const bar = document.createElement('div');
  bar.className = 'compare-plans-bar';
  const status = document.createElement('p');
  status.className = 'compare-plans-status';
  status.setAttribute('role', 'status');
  const iconSrc = `${window.hlx.codeBasePath}/icons/compare-list-white.svg`;
  status.innerHTML = `<img src="${iconSrc}" alt="" width="24" height="24"><span class="compare-plans-status-text"></span>`;
  const statusText = status.querySelector('.compare-plans-status-text');

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'compare-plans-cta';
  cta.setAttribute('aria-expanded', 'false');
  if (labelsRow) moveInstrumentation(labelsRow.firstElementChild, cta);
  cta.innerHTML = '<span class="compare-plans-cta-label"></span><span class="icon icon-right-red-filled"></span>';
  [cta.firstElementChild.textContent] = labels;
  decorateIcons(cta);
  bar.append(status, cta);

  // comparison: replaces the plan cards and bar in place, closed with X or Escape
  const compare = document.createElement('div');
  compare.className = 'compare-plans-compare';
  compare.id = `${name}-compare`;
  compare.hidden = true;
  compare.setAttribute('role', 'region');
  if (heading) compare.setAttribute('aria-labelledby', heading.id);
  else compare.setAttribute('aria-label', 'Plan comparison');
  cta.setAttribute('aria-controls', compare.id);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'compare-plans-close';
  close.setAttribute('aria-label', 'Close comparison');
  const plans = document.createElement('ul');
  plans.className = 'compare-plans-table';
  compare.append(close, plans);

  // the current plan card keeps its authoring instrumentation in the comparison
  const currentCard = currentPlan
    ? buildPlan(currentPlan, currentPlan.features, labels, true) : null;
  if (currentCard) moveInstrumentation(currentPlan.row, currentCard);

  const selectedCards = () => [...cards.querySelectorAll('.compare-plans-checkbox:checked')]
    .map((input) => input.closest('.compare-plans-card'));

  const update = () => {
    const inputs = [...cards.querySelectorAll('.compare-plans-checkbox')];
    const count = inputs.filter((input) => input.checked).length;
    inputs.forEach((input) => {
      const card = input.closest('.compare-plans-card');
      card.classList.toggle('is-selected', input.checked);
      // once four plans are selected the other plans are locked until one is cleared
      input.disabled = !input.checked && count >= MAX_SELECTED;
      card.classList.toggle('is-disabled', input.disabled);
    });

    const plansText = `${count} plan${count === 1 ? '' : 's'}`;
    const tooMany = count > MAX_COMPARED;
    if (tooMany) {
      const limit = document.createElement('span');
      limit.className = 'compare-plans-limit';
      limit.textContent = limitMessage;
      statusText.replaceChildren(limit);
    } else {
      statusText.innerHTML = count >= MIN_SELECTED
        ? `<strong class="compare-plans-count">${plansText}</strong> selected for comparison`
        : `<strong class="compare-plans-count">${plansText}</strong> selected, choose at least ${MIN_SELECTED} to compare`;
    }
    cta.setAttribute('aria-disabled', String(count < MIN_SELECTED || tooMany));
  };

  const open = () => {
    const selected = selectedCards().map((card) => card.comparison);
    // without a Current Plan Card the compared features come from the selected plans
    const master = currentPlan?.features.length ? [...currentPlan.features] : [];
    if (!master.length) {
      selected.forEach((plan) => plan.features.forEach((feature) => {
        const key = featureKey(feature);
        if (!master.some((item) => featureKey(item) === key)) master.push(feature);
      }));
    }
    plans.replaceChildren(
      ...[currentCard].filter(Boolean),
      ...selected.map((plan) => buildPlan(plan, master, labels, false)),
    );
    // the grid gets one column per card, so two or three cards stay centred
    compare.style.setProperty('--cp-plan-count', plans.children.length);
    cards.hidden = true;
    bar.hidden = true;
    compare.hidden = false;
    cta.setAttribute('aria-expanded', 'true');
    close.focus({ preventScroll: true });
    // keep the heading clear of the fixed site header
    const nav = document.querySelector('header .nav-wrapper, header nav, header');
    const navBottom = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
    const { top } = block.getBoundingClientRect();
    if (top < navBottom || top > window.innerHeight) {
      window.scrollTo({ top: window.scrollY + top - navBottom - 16, behavior: 'smooth' });
    }
  };

  const hide = () => {
    compare.hidden = true;
    cards.hidden = false;
    bar.hidden = false;
    cta.setAttribute('aria-expanded', 'false');
    cta.focus({ preventScroll: true });
  };

  cards.addEventListener('change', update);
  cta.addEventListener('click', () => {
    if (cta.getAttribute('aria-disabled') !== 'true') open();
  });
  close.addEventListener('click', hide);
  compare.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    }
  });

  block.replaceChildren(...[header, cards, bar, compare].filter((el) => el.children.length));
  update();
}
