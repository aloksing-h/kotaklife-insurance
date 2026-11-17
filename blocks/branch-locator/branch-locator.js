/*
 * Branch Locator Block
 * Section heading, a map and a search panel (Near Me, pincode, or state and city), then the
 * matching branches as cards with pages. Branches come from the data adapter
 * (branch-data.js) and the map from the map adapter (branch-map.js), so the client API and
 * a map provider can be connected later without changing this block.
 */

import { createBranchSource, directionsUrl } from './branch-data.js';
import { createMap } from './branch-map.js';

// interface wording of the controls and messages
const UI = {
  nearMe: 'Near Me',
  locating: 'Finding your location',
  pincode: 'Search by pincode',
  or: 'or',
  state: 'State',
  city: 'City',
  search: 'Search',
  directions: 'Get Directions',
  newTab: '(opens in a new tab)',
  share: 'Share branch details',
  shareEmail: 'Share branch details via email',
  shareWhatsApp: 'Share branch details via WhatsApp',
  shareCopy: 'Copy branch details',
  copiedSuccess: 'Branch details copied successfully',
  call: (number) => `Call ${number}`,
  copied: (name) => `Address of ${name} copied`,
  copyFailed: 'Could not copy the address',
  found: (count) => `${count} ${count === 1 ? 'branch' : 'branches'} found`,
  results: (place, count) => `Showing results for ${place}. ${UI.found(count)}`,
  nearby: (count) => `Showing branches near you. ${UI.found(count)}`,
  pincodeNearby: (pincode, count) => `No branch at ${pincode}. Showing branches nearby. ${UI.found(count)}`,
  none: 'No branches found. Try another pincode, state or city.',
  noneNear: 'No branches found near you. Search by pincode, or choose your state and city.',
  needInput: 'Enter a 6-digit pincode, or choose a state.',
  invalidPincode: 'Please enter a valid 6-digit pincode.',
  loading: 'Loading branch details',
  searching: 'Searching for branches',
  unavailable: 'Branch details are not available right now. Please try again later.',
  retry: 'Try again',
  locationDenied: 'Location sharing is turned off. Search by pincode, or choose your state and city.',
  locationFailed: 'We could not find your location. Search by pincode, or choose your state and city.',
  pages: 'Branch results pages',
  previous: 'Previous page',
  next: 'Next page',
  page: (number) => `Page ${number}`,
};

const PAGE_SIZE = 6;

// the prototype's dissolve to the results: about 550ms with Figma's ease out
const DISSOLVE = { duration: 550, easing: 'cubic-bezier(0, 0, 0.58, 1)' };

let locatorCount = 0;
let closeActiveSharePopup = null;

function icon(name) {
  const span = document.createElement('span');
  span.className = `branch-locator-icon branch-locator-icon-${name}`;
  span.setAttribute('aria-hidden', 'true');
  return span;
}

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

/**
 * Shows new results with a cross-fade of the page, like the prototype. Without view
 * transitions the results fade in; with reduced motion they appear at once.
 * @param {Function} update the DOM change
 * @param {Element} shown the results, for the fallback fade
 */
function dissolve(update, shown) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  if (document.startViewTransition) {
    const root = document.documentElement;
    root.classList.add('branch-locator-dissolve');
    document.startViewTransition(update).finished
      .catch(() => {})
      .finally(() => root.classList.remove('branch-locator-dissolve'));
    return;
  }
  update();
  shown.animate([{ opacity: 0 }, { opacity: 1 }], DISSOLVE);
}

/**
 * Builds a select with a floating label.
 * @param {string} id
 * @param {string} label
 * @returns {{ wrapper: HTMLElement, select: HTMLSelectElement }}
 */
function buildSelect(id, label) {
  const wrapper = element('div', 'branch-locator-select');
  const select = document.createElement('select');
  select.id = id;
  select.className = 'branch-locator-input';
  select.append(new Option(label, ''));
  const labelEl = element('label', 'branch-locator-label', label);
  labelEl.htmlFor = id;
  select.addEventListener('change', () => {
    wrapper.classList.toggle('branch-locator-filled', Boolean(select.value));
  });
  wrapper.append(select, labelEl, icon('chevron'));
  return { wrapper, select };
}

function setOptions(select, values) {
  const placeholder = select.options[0].text;
  select.replaceChildren(
    new Option(placeholder, ''),
    ...values.map((value) => new Option(value, value)),
  );
  select.closest('.branch-locator-select')?.classList.remove('branch-locator-filled');
}

/**
 * Returns the page numbers to show, with null where pages are left out.
 * @param {number} current
 * @param {number} total
 * @returns {(number|null)[]}
 */
function pageList(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, null, total];
  if (current >= total - 2) return [1, null, total - 2, total - 1, total];
  return [1, null, current, null, total];
}

/**
 * The name, address and phone numbers of a branch.
 * @param {object} branch
 * @param {string} heading the tag of the name
 * @returns {HTMLElement}
 */
function cardContent(branch, heading) {
  const content = element('div', 'branch-locator-card-content');
  content.append(element(heading, 'branch-locator-name', branch.name));
  if (branch.address) {
    const address = element('p', 'branch-locator-address');
    address.append(icon('location'), element('span', '', branch.address));
    content.append(address);
  }
  if (branch.phones.length) {
    const phones = element('p', 'branch-locator-phones');
    branch.phones.forEach((number) => {
      const link = element('a', 'branch-locator-phone');
      link.href = `tel:${number.replace(/[^\d+]/g, '')}`;
      link.setAttribute('aria-label', UI.call(number));
      link.append(icon('phone'), element('span', '', number));
      phones.append(link);
    });
    content.append(phones);
  }
  return content;
}

function directionsLink(branch) {
  const directions = element('a', 'branch-locator-directions');
  directions.href = directionsUrl(branch);
  directions.target = '_blank';
  directions.rel = 'noopener';
  const arrow = element('span', 'branch-locator-directions-arrow');
  arrow.append(icon('arrow'));
  directions.append(
    element('span', 'branch-locator-directions-label', UI.directions),
    element('span', 'branch-locator-visually-hidden', ` ${UI.newTab}`),
    arrow,
  );
  return directions;
}

/**
 * Returns a plain-text summary of a branch's details for sharing.
 * @param {object} branch
 * @returns {string}
 */
function branchShareText(branch) {
  return [branch.name, branch.address, ...branch.phones].filter(Boolean).join('\n');
}

/**
 * Builds the share popup for a branch card.
 * Returns the popup element and an open/close controller.
 * @param {object} branch
 * @param {HTMLButtonElement} shareBtn
 * @param {HTMLElement} statusEl
 */
function buildSharePopup(branch, shareBtn, statusEl) {
  const popup = element('div', 'branch-locator-share-popup');
  popup.setAttribute('role', 'group');
  popup.setAttribute('aria-label', 'Share options');
  popup.hidden = true;

  // --- Email ---
  const emailBtn = element('button', 'branch-locator-share-action');
  emailBtn.type = 'button';
  emailBtn.setAttribute('aria-label', 'Share branch details via email');
  const emailIcon = element('span', 'branch-locator-share-icon branch-locator-share-icon-email');
  emailIcon.setAttribute('aria-hidden', 'true');
  emailBtn.append(emailIcon);
  emailBtn.addEventListener('click', () => {
    const subject = encodeURIComponent(`Branch: ${branch.name}`);
    const body = encodeURIComponent(branchShareText(branch));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  });

  // --- WhatsApp ---
  const waBtn = element('button', 'branch-locator-share-action');
  waBtn.type = 'button';
  waBtn.setAttribute('aria-label', 'Share branch details via WhatsApp');
  const waIcon = element('span', 'branch-locator-share-icon branch-locator-share-icon-whatsapp');
  waIcon.setAttribute('aria-hidden', 'true');
  waBtn.append(waIcon);
  waBtn.addEventListener('click', () => {
    const text = encodeURIComponent(branchShareText(branch));
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
  });

  // --- Copy ---
  const copyBtn = element('button', 'branch-locator-share-action');
  copyBtn.type = 'button';
  copyBtn.setAttribute('aria-label', 'Copy branch details');
  const copyIcon = element('span', 'branch-locator-share-icon branch-locator-share-icon-copy');
  copyIcon.setAttribute('aria-hidden', 'true');
  copyBtn.append(copyIcon);

  // copy confirmation tooltip
  const copyConfirm = element('span', 'branch-locator-share-copied');
  copyConfirm.setAttribute('aria-hidden', 'true');
  copyConfirm.textContent = 'Copied!';
  copyBtn.append(copyConfirm);

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(branchShareText(branch));
      copyBtn.classList.add('branch-locator-share-copied-active');
      statusEl.textContent = 'Branch details copied successfully';
      setTimeout(() => {
        copyBtn.classList.remove('branch-locator-share-copied-active');
        statusEl.textContent = '';
      }, 2000);
    } catch {
      statusEl.textContent = 'Could not copy the address';
    }
  });

  popup.append(emailBtn, waBtn, copyBtn);

  // keyboard: arrow keys navigate between actions; Escape closes
  const actions = [emailBtn, waBtn, copyBtn];
  popup.addEventListener('keydown', (e) => {
    const idx = actions.indexOf(document.activeElement);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      actions[(idx + 1) % actions.length].focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      actions[(idx - 1 + actions.length) % actions.length].focus();
    } else if (e.key === 'Escape') {
      closePopup(); // eslint-disable-line no-use-before-define
      shareBtn.focus();
    }
  });

  let popupGeneration = 0;

  function closePopup({ immediate = false } = {}) {
    popupGeneration += 1;
    if (closeActiveSharePopup === closePopup) closeActiveSharePopup = null;
    popup.classList.remove('branch-locator-share-popup-open');
    shareBtn.setAttribute('aria-expanded', 'false');
    if (immediate) {
      popup.hidden = true;
      popup.classList.remove('branch-locator-share-popup-above');
      return;
    }
    const onEnd = () => {
      if (!popup.classList.contains('branch-locator-share-popup-open')) {
        popup.hidden = true;
        popup.classList.remove('branch-locator-share-popup-above');
      }
      popup.removeEventListener('transitionend', onEnd);
    };
    popup.addEventListener('transitionend', onEnd);
  }

  function openPopup({ focus = true, above = false } = {}) {
    if (closeActiveSharePopup && closeActiveSharePopup !== closePopup) {
      closeActiveSharePopup({ immediate: true });
    }
    closeActiveSharePopup = closePopup;
    popupGeneration += 1;
    const generation = popupGeneration;
    popup.hidden = false;
    shareBtn.setAttribute('aria-expanded', 'true');

    requestAnimationFrame(() => {
      if (generation !== popupGeneration) return;
      if (above) {
        popup.classList.add('branch-locator-share-popup-above');
      } else {
        // determine whether to open below or above based on available viewport space
        const btnRect = shareBtn.getBoundingClientRect();
        const popupHeight = popup.offsetHeight || 54; // Figma spec: 54px
        const spaceBelow = window.innerHeight - btnRect.bottom;
        const spaceAbove = btnRect.top;
        const gap = 8;

        if (spaceBelow >= popupHeight + gap || spaceBelow >= spaceAbove) {
          popup.classList.remove('branch-locator-share-popup-above');
        } else {
          popup.classList.add('branch-locator-share-popup-above');
        }
      }

      popup.classList.add('branch-locator-share-popup-open');
      if (focus) emailBtn.focus();
    });
  }

  return { popup, openPopup, closePopup };
}

/**
 * Builds the share button and its floating popup.
 * @param {object} branch
 * @param {HTMLElement} [statusEl]
 * @returns {HTMLElement}
 */
function shareControl(branch, statusEl) {
  const shareWrapper = element('div', 'branch-locator-share-wrapper');
  const share = element('button', 'branch-locator-share');
  share.type = 'button';
  share.setAttribute('aria-label', 'Share branch details');
  share.setAttribute('aria-expanded', 'false');
  share.setAttribute('aria-haspopup', 'true');
  share.append(icon('share'));

  const { popup, openPopup, closePopup } = buildSharePopup(branch, share, statusEl);
  share.setAttribute('aria-controls', popup.id || '');

  shareWrapper.addEventListener('pointerenter', () => {
    // const mobile = window.matchMedia('(max-width: 599px)').matches;
    // openPopup({ focus: false, above: mobile });
    const mobile = window.matchMedia('(max-width: 599px)').matches;
    openPopup({ focus: false, above: mobile });
  });
  share.addEventListener('click', () => {
    const mobile = window.matchMedia('(max-width: 599px)').matches;
    openPopup({ focus: false, above: mobile });
  });
  shareWrapper.addEventListener('pointerleave', () => {
    if (!popup.hidden) closePopup();
  });

  shareWrapper.append(share, popup);
  return shareWrapper;
}

/**
 * Builds one branch card.
 * @param {object} branch
 * @param {HTMLElement} statusEl live region for screen reader announcements
 * @returns {HTMLLIElement}
 */
function buildCard(branch, statusEl) {
  const li = element('li', 'branch-locator-card');
  li.dataset.branch = branch.id;
  const actions = element('div', 'branch-locator-card-actions');
  actions.append(directionsLink(branch), shareControl(branch, statusEl));
  li.append(cardContent(branch, 'h3'), actions);
  return li;
}

/**
 * The branch card shown over the map for a pin.
 * @param {object} branch
 * @param {HTMLElement} [statusEl]
 * @returns {HTMLElement}
 */
function buildMapCard(branch, statusEl) {
  const card = element('div', 'branch-locator-map-card');
  const actions = element('div', 'branch-locator-card-actions');
  actions.append(directionsLink(branch), shareControl(branch, statusEl));
  card.append(cardContent(branch, 'p'), actions);
  return card;
}

/**
 * Reads the authored rows: heading, search panel text, data URL and map image.
 * @param {Element} block
 */
function readConfig(block) {
  const cells = [...block.children].map((row) => row.firstElementChild || row);
  const imageCell = cells.find((cell) => cell.querySelector('picture, img'));
  const sourceCell = cells.find((cell) => cell !== imageCell
    && (cell.querySelector('a[href]') || /^(https?:\/\/|\/)\S+$/.test(cell.textContent.trim())));
  const [textCell, finderCell] = cells.filter((cell) => cell !== imageCell && cell !== sourceCell);
  const source = sourceCell?.querySelector('a[href]')?.getAttribute('href')
    || sourceCell?.textContent.trim() || '';
  return {
    textCell,
    finderCell,
    source,
    image: imageCell?.querySelector('picture') || imageCell?.querySelector('img'),
  };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const {
    textCell, finderCell, source, image,
  } = readConfig(block);
  locatorCount += 1;
  const id = `branch-locator-${locatorCount}`;

  // heading and description
  const header = element('div', 'branch-locator-header');
  header.append(...(textCell?.childNodes || []));
  header.querySelector('h1, h2, h3, h4, h5, h6')?.classList.add('branch-locator-title');

  // map and search panel
  const finder = element('div', 'branch-locator-finder');
  const mapArea = element('div', 'branch-locator-map');
  const panel = element('div', 'branch-locator-panel');

  const intro = element('div', 'branch-locator-intro');
  intro.append(...(finderCell?.childNodes || []));

  const form = element('form', 'branch-locator-form');
  form.setAttribute('role', 'search');
  form.noValidate = true;
  const titleEl = intro.firstElementChild;
  if (titleEl) {
    titleEl.id = `${id}-search-title`;
    form.setAttribute('aria-labelledby', titleEl.id);
  }

  const nearMe = element('button', 'branch-locator-near-me');
  nearMe.type = 'button';
  nearMe.append(icon('location'), element('span', '', UI.nearMe));

  const fields = element('div', 'branch-locator-fields');
  const pincodeWrap = element('div', 'branch-locator-pincode');
  const pincode = document.createElement('input');
  pincode.type = 'text';
  pincode.id = `${id}-pincode`;
  pincode.className = 'branch-locator-input';
  pincode.inputMode = 'numeric';
  pincode.maxLength = 6;
  pincode.autocomplete = 'postal-code';
  pincode.placeholder = UI.pincode;
  const pincodeLabel = element('label', 'branch-locator-visually-hidden', UI.pincode);
  pincodeLabel.htmlFor = pincode.id;
  pincodeWrap.append(icon('search'), pincodeLabel, pincode);

  const divider = element('p', 'branch-locator-or');
  divider.append(element('span', '', UI.or));
  const area = element('div', 'branch-locator-area');
  const stateField = buildSelect(`${id}-state`, UI.state);
  const cityField = buildSelect(`${id}-city`, UI.city);
  cityField.select.disabled = true;
  area.append(stateField.wrapper, cityField.wrapper);
  fields.append(pincodeWrap, divider, area);

  const error = element('p', 'branch-locator-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  pincode.setAttribute('aria-describedby', error.id);

  const search = element('button', 'branch-locator-search');
  search.type = 'submit';
  const searchArrow = element('span', 'branch-locator-search-arrow');
  searchArrow.append(icon('arrow'));
  search.append(element('span', 'branch-locator-search-label', UI.search), searchArrow);

  form.append(nearMe, fields, error, search);
  panel.append(intro, form);
  finder.append(mapArea, panel);

  // results
  const results = element('div', 'branch-locator-results');
  const summary = element('p', 'branch-locator-summary');
  summary.id = `${id}-summary`;
  summary.tabIndex = -1;
  summary.setAttribute('aria-live', 'polite');
  const list = element('ul', 'branch-locator-list');
  list.setAttribute('aria-labelledby', summary.id);
  list.hidden = true;
  const pagination = element('nav', 'branch-locator-pagination');
  pagination.setAttribute('aria-label', UI.pages);
  pagination.hidden = true;
  results.append(summary, list, pagination);

  const status = element('p', 'branch-locator-visually-hidden');
  status.setAttribute('role', 'status');

  block.replaceChildren(header, finder, results, status);

  // results and pages
  let current = [];
  let map = null;
  let showPage;

  // the map, through the map adapter; a pin shows its card in the list
  const selectBranch = (branch) => {
    const index = current.findIndex((item) => item.id === branch.id);
    if (index < 0) return;
    if (!list.querySelector(`[data-branch="${branch.id}"]`)) {
      showPage(Math.floor(index / PAGE_SIZE) + 1, false);
    }
    list.querySelectorAll('.branch-locator-card-active')
      .forEach((card) => card.classList.remove('branch-locator-card-active'));
    const card = list.querySelector(`[data-branch="${branch.id}"]`);
    card?.classList.add('branch-locator-card-active');
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  createMap(mapArea, {
    image,
    onSelect: selectBranch,
    renderPopup: (branch) => buildMapCard(branch, status),
  })
    .then((created) => {
      map = created;
      mapArea.classList.toggle('branch-locator-map-interactive', created.interactive);
      if (current.length) map.showBranches(current);
    });

  // branch data, through the data adapter
  const branchSource = createBranchSource(source);
  const controls = [nearMe, pincode, stateField.select, search];
  const setBusy = (busy) => {
    block.classList.toggle('branch-locator-busy', busy);
    results.setAttribute('aria-busy', String(busy));
  };
  let loadStates;
  const showUnavailable = () => {
    block.classList.add('branch-locator-unavailable');
    current = [];
    map?.reset();
    list.replaceChildren();
    list.hidden = true;
    pagination.hidden = true;
    const retry = element('button', 'branch-locator-retry', UI.retry);
    retry.type = 'button';
    retry.addEventListener('click', () => loadStates());
    summary.replaceChildren(document.createTextNode(`${UI.unavailable} `), retry);
  };
  loadStates = () => {
    block.classList.remove('branch-locator-unavailable');
    controls.forEach((control) => { control.disabled = true; });
    setBusy(true);
    summary.textContent = UI.loading;
    return branchSource.states().then((states) => {
      setOptions(stateField.select, states);
      controls.forEach((control) => { control.disabled = false; });
      summary.textContent = '';
    }).catch(showUnavailable).finally(() => setBusy(false));
  };

  const updateReady = () => {
    const ready = /^[1-9]\d{5}$/.test(pincode.value.trim()) || Boolean(stateField.select.value);
    form.classList.toggle('branch-locator-ready', ready);
  };
  pincode.addEventListener('input', () => {
    pincode.value = pincode.value.replace(/\D/g, '');
    if (pincode.value) {
      stateField.select.value = '';
      stateField.wrapper.classList.remove('branch-locator-filled');
      setOptions(cityField.select, []);
      cityField.select.disabled = true;
    }
    error.textContent = '';
    pincode.removeAttribute('aria-invalid');
    updateReady();
  });
  stateField.select.addEventListener('change', async () => {
    const state = stateField.select.value;
    if (state) {
      pincode.value = '';
      pincode.removeAttribute('aria-invalid');
    }
    setOptions(cityField.select, []);
    cityField.select.disabled = true;
    error.textContent = '';
    updateReady();
    if (!state) return;
    try {
      const cities = await branchSource.cities(state);
      if (stateField.select.value !== state) return;
      setOptions(cityField.select, cities);
      cityField.select.disabled = !cities.length;
    } catch {
      // without its cities the state can still be searched
    }
  });
  cityField.select.addEventListener('change', () => {
    if (cityField.select.value) {
      pincode.value = '';
      pincode.removeAttribute('aria-invalid');
    }
    error.textContent = '';
    updateReady();
  });

  // share a branch: popup is now self-contained in buildCard / buildSharePopup

  showPage = (page, focus) => {
    const total = Math.ceil(current.length / PAGE_SIZE);
    const start = (page - 1) * PAGE_SIZE;
    const cards = current.slice(start, start + PAGE_SIZE).map((branch) => {
      const card = buildCard(branch, status);
      const highlight = () => map?.focusBranch(branch);
      const release = () => map?.blurBranch?.(branch);
      card.addEventListener('click', (event) => {
        if (event.target.closest('a, button, .branch-locator-share-wrapper')) return;
        map?.focusBranch(branch, { select: true });
      });
      card.addEventListener('mouseenter', highlight);
      card.addEventListener('focusin', highlight);
      card.addEventListener('mouseleave', release);
      card.addEventListener('focusout', (event) => {
        if (!card.contains(event.relatedTarget)) release();
      });
      return card;
    });
    list.replaceChildren(...cards);
    list.hidden = !cards.length;

    pagination.replaceChildren();
    pagination.hidden = total < 2;
    if (total > 1) {
      const items = element('ul', 'branch-locator-pages');
      const pageButton = (label, target, className, content) => {
        const li = document.createElement('li');
        const button = element('button', className);
        button.type = 'button';
        button.setAttribute('aria-label', label);
        if (target === page && className === 'branch-locator-page') {
          button.setAttribute('aria-current', 'page');
        }
        button.disabled = target < 1 || target > total;
        button.append(content);
        button.addEventListener('click', () => showPage(target, true));
        li.append(button);
        return li;
      };
      items.append(pageButton(UI.previous, page - 1, 'branch-locator-page-step', icon('chevron-left')));
      pageList(page, total).forEach((number) => {
        if (number === null) {
          const gap = element('li', 'branch-locator-page-gap', '…');
          gap.setAttribute('aria-hidden', 'true');
          items.append(gap);
        } else {
          items.append(pageButton(UI.page(number), number, 'branch-locator-page', document.createTextNode(number)));
        }
      });
      items.append(pageButton(UI.next, page + 1, 'branch-locator-page-step', icon('chevron-right')));
      pagination.append(items);
    }
    if (focus) {
      summary.focus({ preventScroll: true });
      results.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };
  const showResults = (found, text, mapOptions) => dissolve(() => {
    current = found;
    summary.textContent = text;
    block.classList.remove('branch-locator-unavailable');
    block.classList.add('branch-locator-has-results');
    map?.showBranches(found, mapOptions);
    showPage(1, false);
  }, results);

  // one search at a time: the answer to an older search is dropped
  let searchCount = 0;
  const runSearch = async (find) => {
    searchCount += 1;
    const ticket = searchCount;
    setBusy(true);
    status.textContent = UI.searching;
    try {
      const [found, text, mapOptions] = await find();
      if (ticket !== searchCount) return;
      status.textContent = '';
      showResults(found, text, mapOptions);
    } catch {
      if (ticket !== searchCount) return;
      status.textContent = '';
      showUnavailable();
    } finally {
      if (ticket === searchCount) setBusy(false);
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const pin = pincode.value.trim();
    const state = stateField.select.value;
    const city = cityField.select.value;
    if (pin && !/^[1-9]\d{5}$/.test(pin)) {
      error.textContent = UI.invalidPincode;
      pincode.setAttribute('aria-invalid', 'true');
      pincode.focus();
      return;
    }
    if (!pin && !state) {
      error.textContent = UI.needInput;
      pincode.focus();
      return;
    }
    error.textContent = '';
    pincode.removeAttribute('aria-invalid');
    if (pin) {
      runSearch(async () => {
        const match = await branchSource.byPincode(pin);
        const count = match.branches.length;
        if (!count) return [[], UI.none];
        const text = match.exact ? UI.results(pin, count) : UI.pincodeNearby(pin, count);
        return [match.branches, text];
      });
      return;
    }
    runSearch(async () => {
      const found = await branchSource.byArea(state, city);
      const place = city ? `${state}, ${city}` : state;
      return [found, found.length ? UI.results(place, found.length) : UI.none];
    });
  });

  // Near Me: the visitor's location, if they allow it
  if (!navigator.geolocation) nearMe.hidden = true;
  nearMe.addEventListener('click', () => {
    nearMe.disabled = true;
    nearMe.setAttribute('aria-busy', 'true');
    status.textContent = UI.locating;
    error.textContent = '';
    const done = () => {
      nearMe.disabled = false;
      nearMe.removeAttribute('aria-busy');
      status.textContent = '';
    };
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      done();
      const location = { latitude: coords.latitude, longitude: coords.longitude };
      map?.showUser(location);
      runSearch(async () => {
        const found = await branchSource.near(location);
        return [found, found.length ? UI.nearby(found.length) : UI.noneNear, { withUser: true }];
      });
    }, (geoError) => {
      done();
      error.textContent = geoError.code === geoError.PERMISSION_DENIED
        ? UI.locationDenied : UI.locationFailed;
    }, { timeout: 10000, maximumAge: 300000 });
  });

  updateReady();
  loadStates();
}
