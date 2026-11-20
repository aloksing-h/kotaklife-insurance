/*
 * Global search overlay behaviour (the "global-search" section of the
 * /modals/global-search fragment, decorated by custom-rte.js).
 * Figma Search page 1:1604 / 1:2022 (open), 1:1732 / 1:2089 (on type).
 * - the field is a search form: Enter or the arrow button opens the results page with ?q=
 * - a clear button appears once something is typed; the field turns red (Figma "on type")
 * - a trending search opens the results page for that keyword
 * - an empty or blank search does nothing; a search is sent only once
 */

/** The results page URL for a keyword (spaces and special characters encoded). */
export function searchUrl(resultsPath, query) {
  const url = new URL(resultsPath, window.location.href);
  url.searchParams.set('q', query);
  url.searchParams.delete('page');
  return url.origin === window.location.origin ? `${url.pathname}${url.search}` : url.href;
}

const normalise = (value) => value.replace(/\s+/g, ' ').trim();

export default function initGlobalSearch(container, { resultsPath }) {
  const field = container.querySelector('.search-field-wrap');
  const input = field?.querySelector('.search-inp');
  const submit = field?.querySelector('.search-submit-btn');
  if (!field || !input || !submit) return;

  // the field becomes a search form, so Enter and the arrow button both submit it
  const form = document.createElement('form');
  form.className = field.className;
  form.setAttribute('role', 'search');
  form.action = resultsPath;
  form.method = 'get';
  form.noValidate = true;
  form.append(...field.childNodes);
  field.replaceWith(form);

  input.type = 'search';
  input.name = 'q';
  input.autocomplete = 'off';
  input.enterKeyHint = 'search';
  input.spellcheck = false;
  // focused when the overlay opens (the mobile keyboard opens with it)
  input.autofocus = true;

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'search-clear-btn';
  clear.setAttribute('aria-label', 'Clear search');
  clear.hidden = true;
  submit.before(clear);

  // on the results page the overlay starts with the current keyword
  const current = new URL(window.location.href);
  const resultsUrl = new URL(resultsPath, window.location.href);
  if (current.pathname === resultsUrl.pathname) {
    input.value = current.searchParams.get('q') || '';
    // selected when the overlay opens, so typing replaces it
    input.addEventListener('focus', () => input.select(), { once: true });
  }

  const update = () => {
    const hasValue = input.value !== '';
    form.classList.toggle('has-value', hasValue);
    clear.hidden = !hasValue;
  };
  update();

  let sent = false;
  const search = (value) => {
    const query = normalise(value);
    if (!query) {
      input.value = '';
      update();
      input.focus();
      return;
    }
    if (sent) return;
    sent = true;
    window.location.assign(searchUrl(resultsPath, query));
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    search(input.value);
  });
  input.addEventListener('input', update);
  clear.addEventListener('click', () => {
    input.value = '';
    update();
    input.focus();
  });
  container.querySelectorAll('.trending-tag-btn').forEach((tag) => {
    tag.addEventListener('click', () => {
      input.value = tag.textContent.trim();
      update();
      search(input.value);
    });
  });
  // back from the results page (page cache): the overlay can search again
  window.addEventListener('pageshow', () => { sent = false; });
}
