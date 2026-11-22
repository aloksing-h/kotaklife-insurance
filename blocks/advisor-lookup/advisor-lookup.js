/*
 * Advisor Lookup: How do I "Know your Life Advisor".
 * Figma How do I 1:4199 (desktop) / 1:4274 (mobile), result 1:4162 / 1:4235.
 * A centred heading, a search field for the advisor ID and a hint; a search shows the
 * number of results and the advisor card (photo, name, ID, status, gender, type, date of
 * appointment, valid till), or a message when no advisor has that ID.
 *
 * Authored rows (Universal Editor), one cell each, in model order (LABELS).
 * Data: the "source" setting is either
 * - a URL with {id} (an API answering with the advisor as JSON, or { data: [advisor] }), or
 * - a spreadsheet JSON (/path/advisors.json) whose rows are searched by their id column.
 * Advisor fields: id, name, photo, status, gender, type, appointmentDate, validTill.
 * The ID searched is kept in the URL (?advisor=), so Back and shared links work.
 */
import { moveInstrumentation } from '../../scripts/scripts.js';

const LABELS = [
  'text', 'placeholder', 'searchLabel', 'submitLabel', 'hint', 'resultsLabel', 'emptyMessage',
  'invalidMessage', 'errorMessage', 'idLabel', 'genderLabel', 'typeLabel', 'appointmentLabel',
  'validLabel', 'photoLabel', 'source',
];
// used when an author leaves a label empty, so every control keeps a name
const FALLBACK = {
  placeholder: 'eg. 98765412',
  searchLabel: 'Life Advisor ID',
  submitLabel: 'Search',
  resultsLabel: '{count} results found : {id}',
  emptyMessage: 'No Life Advisor was found with the ID {id}. Please check the ID and try again.',
  invalidMessage: 'Please enter a valid Life Advisor ID, using numbers only.',
  errorMessage: 'We could not search right now. Please try again later.',
  idLabel: 'ID',
  genderLabel: 'Gender',
  typeLabel: 'Type',
  appointmentLabel: 'Date of Appointment',
  validLabel: 'Valid till',
  photoLabel: 'Photo of {name}',
};
const PARAM = 'advisor';
const ID_PATTERN = /^\d{4,12}$/;

let blockCount = 0;

const text = (cell) => cell?.textContent.replace(/\s+/g, ' ').trim() || '';

function element(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content) el.textContent = content;
  return el;
}

/** Reads the authored rows into labels (the heading and hint cells keep their markup). */
function readRows(block) {
  const labels = {};
  [...block.children].forEach((row, i) => {
    const key = LABELS[i];
    if (!key) return;
    const cell = row.firstElementChild;
    if (key === 'text' || key === 'hint') labels[key] = cell;
    else if (key === 'source') labels.source = cell?.querySelector('a[href]')?.getAttribute('href') || text(cell);
    else labels[key] = text(cell);
  });
  Object.entries(FALLBACK).forEach(([key, value]) => { labels[key] = labels[key] || value; });
  return labels;
}

/** A value of a row, whichever way the column is written (appointmentDate, Appointment Date). */
function pick(row, ...names) {
  const keys = Object.keys(row);
  const plain = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = keys.find((k) => names.some((name) => plain(k) === plain(name)));
  return key ? String(row[key] ?? '').trim() : '';
}

const toAdvisor = (row) => ({
  id: pick(row, 'id', 'advisorId', 'agentId', 'code'),
  name: pick(row, 'name', 'advisorName', 'agentName'),
  photo: pick(row, 'photo', 'image', 'photoUrl'),
  status: pick(row, 'status'),
  gender: pick(row, 'gender'),
  type: pick(row, 'type', 'advisorType'),
  appointmentDate: pick(row, 'appointmentDate', 'dateOfAppointment'),
  validTill: pick(row, 'validTill', 'validUntil'),
});

/**
 * Finds the advisor with that ID through the configured source.
 * @returns {Promise<object|null>} the advisor, or null when there is none
 */
async function findAdvisor(source, id) {
  if (!source) throw new Error('No advisor source configured');
  const url = source.includes('{id}') ? source.replace('{id}', encodeURIComponent(id)) : source;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Advisor search failed: ${response.status}`);
  const json = await response.json();
  const rows = (Array.isArray(json) && json)
    || json.data || json[':names']?.flatMap((name) => json[name]?.data || [])
    || [json];
  const advisor = rows.map(toAdvisor).find((row) => row.id === id);
  return advisor || null;
}

/** The authored text with {count}, {id} and {name} filled in. */
const fill = (template, values) => template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const labels = readRows(block);
  blockCount += 1;
  const uid = `advisor-lookup-${blockCount}`;

  const header = element('div', 'advisor-lookup-header');
  if (labels.text && text(labels.text)) {
    moveInstrumentation(labels.text, header);
    header.append(...labels.text.childNodes);
    header.querySelector('h1, h2, h3, h4, h5, h6')?.classList.add('advisor-lookup-title');
  }

  // search: a form, so Enter and the search button both send it
  const form = element('form', 'advisor-lookup-form');
  form.setAttribute('role', 'search');
  form.noValidate = true;
  const field = element('div', 'advisor-lookup-field');
  const input = element('input', 'advisor-lookup-input');
  input.type = 'search';
  input.id = `${uid}-input`;
  input.name = PARAM;
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.enterKeyHint = 'search';
  input.placeholder = labels.placeholder;
  input.setAttribute('aria-label', labels.searchLabel);
  const submit = element('button', 'advisor-lookup-submit');
  submit.type = 'submit';
  submit.setAttribute('aria-label', labels.submitLabel);
  submit.innerHTML = `<img src="${window.hlx.codeBasePath}/icons/search-grey.svg" alt="" width="20" height="20">`;
  field.append(submit, input);
  const hint = element('div', 'advisor-lookup-hint');
  hint.id = `${uid}-hint`;
  if (labels.hint && text(labels.hint)) {
    moveInstrumentation(labels.hint, hint);
    hint.append(...labels.hint.childNodes);
    input.setAttribute('aria-describedby', hint.id);
  }
  form.append(field);

  const results = element('div', 'advisor-lookup-results');
  results.setAttribute('aria-live', 'polite');
  block.replaceChildren(header, form, hint, results);

  const showMessage = (message, type) => {
    const p = element('p', `advisor-lookup-message advisor-lookup-message-${type}`, message);
    results.replaceChildren(p);
    hint.hidden = type !== 'invalid';
  };

  const card = (advisor) => {
    const article = element('article', 'advisor-lookup-card');
    article.setAttribute('aria-labelledby', `${uid}-name`);
    const photo = element('div', 'advisor-lookup-photo');
    if (advisor.photo) {
      const img = element('img');
      img.src = advisor.photo;
      img.alt = fill(labels.photoLabel, { name: advisor.name });
      img.width = 134;
      img.height = 134;
      img.loading = 'lazy';
      photo.append(img);
    } else {
      photo.classList.add('is-empty');
      photo.setAttribute('aria-hidden', 'true');
      // initials when there is no photo (titles such as MR are left out)
      const words = advisor.name.split(/\s+/)
        .filter((w) => /^[a-z]/i.test(w) && !/^(mr|mrs|ms|dr)\.?$/i.test(w));
      photo.textContent = words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
    }
    const main = element('div', 'advisor-lookup-main');
    const top = element('div', 'advisor-lookup-top');
    const name = element('h3', 'advisor-lookup-name', advisor.name);
    name.id = `${uid}-name`;
    const id = element('p', 'advisor-lookup-id');
    id.append(element('span', 'advisor-lookup-id-label', `${labels.idLabel} : `), element('span', '', advisor.id));
    top.append(name, id);
    if (advisor.status) top.append(element('span', 'advisor-lookup-status', advisor.status));
    const details = element('dl', 'advisor-lookup-details');
    [
      [labels.genderLabel, advisor.gender],
      [labels.typeLabel, advisor.type],
      [labels.appointmentLabel, advisor.appointmentDate],
      [labels.validLabel, advisor.validTill],
    ].filter(([, value]) => value).forEach(([label, value]) => {
      const item = element('div', 'advisor-lookup-detail');
      item.append(element('dt', '', label), element('dd', '', value));
      details.append(item);
    });
    main.append(top, details);
    article.append(photo, main);
    return article;
  };

  let request = 0;
  const search = async (id, { push = true } = {}) => {
    const value = id.trim();
    if (!ID_PATTERN.test(value)) {
      input.setAttribute('aria-invalid', 'true');
      showMessage(labels.invalidMessage, 'invalid');
      return;
    }
    input.removeAttribute('aria-invalid');
    if (push) {
      const url = new URL(window.location.href);
      url.searchParams.set(PARAM, value);
      window.history.pushState({ [PARAM]: value }, '', url);
    }
    request += 1;
    const current = request;
    block.setAttribute('aria-busy', 'true');
    try {
      const advisor = await findAdvisor(labels.source, value);
      if (current !== request) return;
      if (!advisor) {
        showMessage(fill(labels.emptyMessage, { id: value }), 'empty');
        return;
      }
      const count = element('p', 'advisor-lookup-count');
      const [before, after] = fill(labels.resultsLabel, { count: 1, id: '\u0000' }).split('\u0000');
      count.append(before, element('strong', '', value), after || '');
      results.replaceChildren(count, card(advisor));
      hint.hidden = true;
    } catch {
      if (current === request) showMessage(labels.errorMessage, 'error');
    } finally {
      if (current === request) block.removeAttribute('aria-busy');
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    search(input.value);
  });
  input.addEventListener('search', () => {
    // the field's clear button: back to the start
    if (input.value) return;
    input.removeAttribute('aria-invalid');
    results.replaceChildren();
    hint.hidden = false;
  });
  const fromUrl = () => {
    const id = new URL(window.location.href).searchParams.get(PARAM) || '';
    input.value = id;
    if (id) search(id, { push: false });
    else {
      results.replaceChildren();
      hint.hidden = false;
    }
  };
  window.addEventListener('popstate', fromUrl);
  fromUrl();
}
