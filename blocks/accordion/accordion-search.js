/*
 * Accordion, style "FAQ with search" (faq-search): Policy FAQs (Figma How do I 1:3826 desktop,
 * 1:3866 mobile). A search field above the questions; typing shows only the questions whose
 * question or answer contains every word typed. Loaded by accordion.js only for this style.
 */

const TEXT = {
  placeholder: 'Search...',
  label: 'Search questions',
  empty: 'No questions match your search.',
  results: (count) => `${count} ${count === 1 ? 'question' : 'questions'} found`,
};

let searchCount = 0;

const fold = (value) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const toTerms = (value) => fold(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * @param {Element} block the decorated accordion block
 */
export default function decorateSearch(block) {
  searchCount += 1;
  const rows = [...block.children].filter((row) => row.querySelector('.accordion-item'));
  const entries = rows.map((row) => ({ row, text: fold(row.textContent.replace(/\s+/g, ' ')) }));

  const search = document.createElement('div');
  search.className = 'accordion-search';
  const field = document.createElement('label');
  field.className = 'accordion-search-field';
  const iconEl = document.createElement('img');
  iconEl.className = 'accordion-search-icon';
  iconEl.src = `${window.hlx.codeBasePath}/icons/search-grey.svg`;
  iconEl.alt = '';
  iconEl.width = 20;
  iconEl.height = 20;
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'accordion-search-input';
  input.id = `accordion-search-${searchCount}`;
  input.placeholder = TEXT.placeholder;
  input.autocomplete = 'off';
  input.enterKeyHint = 'search';
  input.setAttribute('aria-label', TEXT.label);
  field.append(iconEl, input);
  const status = document.createElement('p');
  status.className = 'accordion-search-status';
  status.setAttribute('role', 'status');
  const empty = document.createElement('p');
  empty.className = 'accordion-search-empty';
  empty.textContent = TEXT.empty;
  empty.hidden = true;
  search.append(field, status);
  block.before(search);
  block.after(empty);
  if (!block.id) {
    block.id = `accordion-search-list-${searchCount}`;
    input.setAttribute('aria-controls', block.id);
  }

  let timer;
  const apply = () => {
    const terms = toTerms(input.value);
    const searching = terms.length > 0;
    let found = 0;
    entries.forEach(({ row, text }) => {
      const match = terms.every((term) => text.includes(term));
      row.classList.toggle('faq-search-miss', searching && !match);
      if (!searching || match) found += 1;
    });
    block.classList.toggle('is-searching', searching);
    empty.hidden = !searching || found > 0;
    status.textContent = searching ? TEXT.results(found) : '';
  };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 200);
  });
  input.addEventListener('search', apply);
}
