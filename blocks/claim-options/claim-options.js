/*
 * Claim Options Block
 * Claims page "Track/update claim section" (Figma 11104:14496 desktop, 11104:14619 mobile).
 * A section heading and three Claim Card items: File a claim, Track a claim, Update a claim.
 * A Track option linking to #form-type (e.g. #group-claim) opens the Contact Form of that
 * type from the same section in place of the cards (Figma 11104:14504 / 11104:14634).
 */

import { moveInstrumentation } from '../../scripts/scripts.js';
import { connectFormTrigger } from '../contact-form/contact-form.js';

const TYPES = ['file', 'track', 'update'];

function icon(name) {
  const span = document.createElement('span');
  span.className = `claim-options-icon claim-options-icon-${name}`;
  span.setAttribute('aria-hidden', 'true');
  return span;
}

/**
 * Builds a pill button (label and arrow) from an authored link.
 * @param {HTMLAnchorElement} source
 * @returns {HTMLAnchorElement}
 */
function buildButton(source) {
  const button = document.createElement('a');
  button.className = 'claim-options-button';
  button.href = source.getAttribute('href');
  if (source.title) button.title = source.title;
  const label = document.createElement('span');
  label.className = 'claim-options-button-label';
  label.textContent = source.textContent.trim();
  const arrow = document.createElement('span');
  arrow.className = 'claim-options-button-arrow';
  arrow.append(icon('arrow'));
  button.append(label, arrow);
  return button;
}

/**
 * Builds a Track option tile (icon, label, chevron) from an authored link.
 * Links to the group form, or labelled "Group", get the group icon.
 * @param {HTMLAnchorElement} source
 * @returns {HTMLAnchorElement}
 */
function buildChoice(source) {
  const href = source.getAttribute('href');
  const text = source.textContent.trim();
  const choice = document.createElement('a');
  choice.className = 'claim-options-choice';
  choice.href = href;
  if (source.title) choice.title = source.title;
  const isGroup = /group/i.test(href) || /group/i.test(text);
  const label = document.createElement('span');
  label.className = 'claim-options-choice-label';
  label.textContent = text;
  const chevron = document.createElement('span');
  chevron.className = 'claim-options-chevron';
  chevron.append(icon('chevron'));
  choice.append(icon(isGroup ? 'group' : 'individual'), label, chevron);
  return choice;
}

/**
 * Builds one claim card from an authored item row: [type] [illustration] [text] [links]
 * @param {Element} row
 * @param {(trigger: HTMLAnchorElement, type: string, card: Element) => void} onFormLink
 * @returns {HTMLDivElement}
 */
function buildCard(row, onFormLink) {
  const [typeCell, imageCell, textCell, linksCell] = row.children;
  const value = typeCell?.textContent.trim().toLowerCase();
  const type = TYPES.includes(value) ? value : TYPES[0];

  const card = document.createElement('div');
  card.className = `claim-options-card claim-options-${type}`;
  moveInstrumentation(row, card);

  const content = document.createElement('div');
  content.className = 'claim-options-content';
  [...(textCell?.children || [])].forEach((element) => {
    if (element.matches('h1, h2, h3, h4, h5, h6')) element.classList.add('claim-options-card-title');
    else if (element.matches('ul, ol')) element.classList.add('claim-options-points');
    else element.classList.add('claim-options-description');
    content.append(element);
  });
  card.append(content);

  const links = [...(linksCell?.querySelectorAll('a[href]') || [])];
  if (type === 'track' && links.length) {
    const list = document.createElement('ul');
    list.className = 'claim-options-choices';
    links.forEach((source) => {
      const item = document.createElement('li');
      const choice = buildChoice(source);
      item.append(choice);
      list.append(item);
      const formType = source.getAttribute('href').match(/^#([\w-]+)$/)?.[1];
      if (formType) onFormLink(choice, formType, card);
    });
    card.append(list);
  } else if (links.length) {
    const actions = document.createElement('div');
    actions.className = 'claim-options-actions';
    actions.append(buildButton(links[0]));
    card.append(actions);
  }

  const picture = imageCell?.querySelector('picture');
  if (picture) {
    const illustration = document.createElement('div');
    illustration.className = 'claim-options-illustration';
    const img = picture.querySelector('img');
    if (img) {
      img.loading = 'lazy';
      // a decorative illustration stays out of the accessibility tree
      if (!img.getAttribute('alt')) img.alt = '';
    }
    illustration.append(picture);
    card.append(illustration);
  }
  return card;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const textRow = rows.find((row) => row.children.length === 1);
  const itemRows = rows.filter((row) => row.children.length > 1);

  // section heading and description
  const header = document.createElement('div');
  header.className = 'claim-options-header';
  const textCell = textRow?.firstElementChild;
  const heading = textCell?.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    heading.classList.add('claim-options-title');
    header.append(heading);
  }
  const lead = document.createElement('div');
  lead.className = 'claim-options-lead';
  lead.append(...(textCell?.childNodes || []));
  if (lead.textContent.trim()) header.append(lead);

  const body = document.createElement('div');
  body.className = 'claim-options-body';
  const formLinks = [];
  const onFormLink = (trigger, type, card) => formLinks.push({ trigger, type, card });
  const cards = itemRows.map((row) => buildCard(row, onFormLink));
  body.append(...cards);
  block.replaceChildren(header, body);

  if (!formLinks.length) return;

  // the form authored in this section opens in the place of the Track card
  const formWrapper = block.closest('.section')?.querySelector(':scope > .contact-form-wrapper');
  const trackCard = cards.find((card) => card.classList.contains('claim-options-track'));
  if (formWrapper) {
    formWrapper.classList.add('claim-options-form');
    if (trackCard) trackCard.after(formWrapper);
    else body.append(formWrapper);
  }

  formLinks.forEach(({ trigger, type, card }) => connectFormTrigger(type, trigger, {
    content: card,
    onOpen: () => block.classList.add('claim-options-form-open'),
    onClose: () => block.classList.remove('claim-options-form-open'),
  }));
}
