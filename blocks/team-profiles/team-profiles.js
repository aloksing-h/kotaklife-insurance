import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/*
 * Team Profiles: Leadership page "Board of Directors" and "Management Team".
 * Figma Leadership 2:1033 / 2:1061 (desktop), 2:1004 / 2:1152 (mobile), open profile
 * 2:1119 and the cards layout 8:2420.
 *
 * Authored rows (Universal Editor):
 *   4 label rows (1 cell each): close, previous, next, team list
 *   Team Group rows (2 cells): team name, optional anchor
 *   Profile rows (5 cells): portrait, name, designation, short description, biography
 * The profiles after a Team Group belong to that team. With no Team Group the profiles
 * are shown as one grid with no tabs, so the block works on any page.
 */

const LABELS = ['closeLabel', 'previousLabel', 'nextLabel', 'groupLabel'];
// used only when an author clears a label, so every control keeps an accessible name
const FALLBACK = {
  closeLabel: 'Close', previousLabel: 'Previous', nextLabel: 'Next', groupLabel: 'Teams',
};
const MOBILE = window.matchMedia('(width < 900px)');
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

let blockCount = 0;

const text = (cell) => cell?.textContent.trim() || '';
const hasContent = (cell) => !!cell && (text(cell) !== '' || !!cell.querySelector('img'));

function element(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content) el.textContent = content;
  return el;
}

function icon(name) {
  const span = element('span', `team-profiles-icon team-profiles-icon-${name}`);
  span.setAttribute('aria-hidden', 'true');
  return span;
}

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Reads the authored rows into labels, teams and profiles. */
function readRows(block) {
  const labels = {};
  const teams = [];
  let labelIndex = 0;
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length === 1 && labelIndex < LABELS.length) {
      labels[LABELS[labelIndex]] = text(cells[0]);
      labelIndex += 1;
    } else if (cells.length === 2) {
      teams.push({
        row, title: text(cells[0]), anchor: slug(text(cells[1])), profiles: [],
      });
    } else if (cells.length >= 3) {
      if (!teams.length) {
        teams.push({
          row: null, title: '', anchor: '', profiles: [],
        });
      }
      const [image, name, designation, summary, bio] = cells;
      teams[teams.length - 1].profiles.push({
        row,
        img: image?.querySelector('img'),
        name: text(name),
        designation: text(designation),
        summary: hasContent(summary) ? summary : null,
        bio: hasContent(bio) ? bio : null,
      });
    }
  });
  LABELS.forEach((key) => { labels[key] = labels[key] || FALLBACK[key]; });
  return { labels, teams: teams.filter((team) => team.profiles.length) };
}

function portrait(img, alt, width) {
  if (!img) return null;
  return createOptimizedPicture(img.getAttribute('src'), alt, false, [{ width }]);
}

/** One profile card; the name is the button that opens the profile. */
function buildCard(profile, headingLevel, detailId) {
  const card = element('li', 'team-profiles-card');
  if (profile.row) moveInstrumentation(profile.row, card);
  const box = element('div', 'team-profiles-card-box');

  const visual = element('div', 'team-profiles-visual');
  const picture = portrait(profile.img, profile.img?.getAttribute('alt') || profile.name, '480');
  if (picture) visual.append(picture);
  else visual.classList.add('is-empty');

  const name = element(`h${headingLevel}`, 'team-profiles-name');
  const opens = !!(profile.bio || profile.summary);
  if (opens) {
    const button = element('button', 'team-profiles-open', profile.name);
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', detailId);
    name.append(button);
    box.append(icon('arrow'));
    card.classList.add('is-interactive');
    profile.button = button;
  } else {
    name.textContent = profile.name;
  }

  const textBox = element('div', 'team-profiles-text');
  textBox.append(name);
  if (profile.designation) {
    textBox.append(element('p', 'team-profiles-designation', profile.designation));
  }
  if (profile.summary) {
    const summary = element('div', 'team-profiles-summary');
    summary.append(...profile.summary.cloneNode(true).childNodes);
    textBox.append(summary);
  }
  box.prepend(visual);
  box.append(textBox);
  card.append(box);
  return card;
}

/** The open profile: one panel per block, moved into the team being shown. */
function buildDetail(id, labels) {
  const detail = element('section', 'team-profiles-detail');
  detail.id = id;
  detail.hidden = true;
  const panel = element('div', 'team-profiles-detail-panel');
  const visual = element('div', 'team-profiles-detail-visual');
  const heading = element('div', 'team-profiles-detail-heading');
  const name = element('h3', 'team-profiles-detail-name');
  name.id = `${id}-name`;
  name.tabIndex = -1;
  const designation = element('p', 'team-profiles-detail-designation');
  heading.append(name, designation);
  detail.setAttribute('aria-labelledby', name.id);

  const close = element('button', 'team-profiles-close');
  close.type = 'button';
  close.setAttribute('aria-label', labels.closeLabel);
  close.append(icon('close'));

  const bio = element('div', 'team-profiles-detail-bio');
  panel.append(visual, heading, close, bio);

  const nav = element('div', 'team-profiles-detail-nav');
  const previous = element('button', 'team-profiles-step team-profiles-previous');
  previous.type = 'button';
  previous.setAttribute('aria-label', labels.previousLabel);
  previous.append(icon('previous'));
  const next = element('button', 'team-profiles-step team-profiles-next');
  next.type = 'button';
  next.setAttribute('aria-label', labels.nextLabel);
  next.append(icon('next'));
  nav.append(previous, next);

  // announces the profile shown after previous / next (focus stays on the arrow)
  const status = element('p', 'team-profiles-visually-hidden');
  status.setAttribute('role', 'status');

  detail.append(panel, nav, status);
  return {
    detail, visual, name, designation, bio, close, previous, next, status,
  };
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const { labels, teams } = readRows(block);
  if (!teams.length) return;
  blockCount += 1;
  const uid = `team-profiles-${blockCount}`;
  const tabbed = teams.length > 1 || !!teams[0].title;
  const headingLevel = teams.some((team) => team.title) ? 3 : 2;
  const parts = buildDetail(`${uid}-profile`, labels);

  const layout = element('div', 'team-profiles-layout');
  const body = element('div', 'team-profiles-body');
  const tabs = [];
  const panels = [];

  teams.forEach((team, index) => {
    const panel = element('div', 'team-profiles-team');
    panel.id = team.anchor || `${uid}-team-${index + 1}`;
    if (team.row) moveInstrumentation(team.row, panel);
    if (team.title) {
      const title = element('h2', 'team-profiles-visually-hidden', team.title);
      panel.append(title);
    }
    const list = element('ul', 'team-profiles-list');
    team.profiles.forEach((profile) => {
      list.append(buildCard(profile, headingLevel, parts.detail.id));
    });
    panel.append(list);
    team.list = list;
    panels.push(panel);
    body.append(panel);
  });

  // team tabs: side tabs on desktop, a dropdown (the same tabs under a toggle) on mobile
  let nav = null;
  let toggle = null;
  let tablist = null;
  if (tabbed) {
    nav = element('div', 'team-profiles-nav');
    toggle = element('button', 'team-profiles-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    const toggleLabel = element('span', 'team-profiles-toggle-label');
    toggle.append(toggleLabel, icon('chevron'));
    tablist = element('div', 'team-profiles-tabs');
    tablist.id = `${uid}-tabs`;
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-orientation', 'vertical');
    tablist.setAttribute('aria-label', labels.groupLabel);
    toggle.setAttribute('aria-controls', tablist.id);
    toggle.setAttribute('aria-label', labels.groupLabel);
    teams.forEach((team, index) => {
      const tab = element('button', 'team-profiles-tab');
      tab.type = 'button';
      tab.id = `${panels[index].id}-tab`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panels[index].id);
      tab.append(element('span', 'team-profiles-tab-label', team.title), icon('tab'));
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', tab.id);
      tabs.push(tab);
      tablist.append(tab);
    });
    nav.append(toggle, tablist);
    layout.append(nav);
  } else {
    layout.classList.add('is-single');
  }
  layout.append(body);
  block.replaceChildren(layout);

  // state
  let activeTeam = 0;
  let open = null; // { team, index }

  const scrollBehavior = () => (REDUCED_MOTION.matches ? 'auto' : 'smooth');
  const bringIntoView = (el) => {
    const { top } = el.getBoundingClientRect();
    if (top < 0 || top > window.innerHeight * 0.6) {
      el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }
  };

  function fillDetail(team, index) {
    const profile = teams[team].profiles[index];
    const picture = portrait(profile.img, '', '480');
    parts.visual.replaceChildren(...(picture ? [picture] : []));
    parts.visual.classList.toggle('is-empty', !picture);
    parts.name.textContent = profile.name;
    parts.designation.textContent = profile.designation;
    parts.designation.hidden = !profile.designation;
    const source = profile.bio || profile.summary;
    parts.bio.replaceChildren(...source.cloneNode(true).childNodes);
    // previous / next stay within the team, over the profiles that can be opened
    const openable = teams[team].profiles.map((p, i) => (p.button ? i : -1)).filter((i) => i >= 0);
    const position = openable.indexOf(index);
    parts.previous.disabled = position <= 0;
    parts.next.disabled = position === openable.length - 1;
    parts.previous.dataset.target = openable[position - 1] ?? '';
    parts.next.dataset.target = openable[position + 1] ?? '';
  }

  function openProfile(team, index, { focus = 'heading' } = {}) {
    const profile = teams[team].profiles[index];
    if (!profile?.button) return;
    if (open) teams[open.team].profiles[open.index].button.setAttribute('aria-expanded', 'false');
    fillDetail(team, index);
    // moved only when the team changes: moving it would drop the focus on the arrows
    if (parts.detail.parentElement !== panels[team]) panels[team].append(parts.detail);
    teams[team].list.hidden = true;
    parts.detail.hidden = false;
    profile.button.setAttribute('aria-expanded', 'true');
    open = { team, index };
    block.classList.add('is-open');
    if (focus === 'heading') {
      parts.name.focus({ preventScroll: true });
      bringIntoView(parts.detail);
    }
  }

  function closeProfile({ restoreFocus = true } = {}) {
    if (!open) return;
    const { button } = teams[open.team].profiles[open.index];
    button.setAttribute('aria-expanded', 'false');
    parts.detail.hidden = true;
    teams[open.team].list.hidden = false;
    block.classList.remove('is-open');
    open = null;
    parts.status.textContent = '';
    if (restoreFocus) {
      button.focus({ preventScroll: true });
      bringIntoView(button.closest('.team-profiles-card'));
    }
  }

  function step(direction) {
    if (!open) return;
    const control = direction > 0 ? parts.next : parts.previous;
    const target = Number.parseInt(control.dataset.target, 10);
    if (Number.isNaN(target)) return;
    openProfile(open.team, target, { focus: 'none' });
    const profile = teams[open.team].profiles[target];
    parts.status.textContent = [profile.name, profile.designation].filter(Boolean).join(', ');
    // an arrow that is now disabled cannot keep focus: move it to the other arrow
    if (control.disabled) (direction > 0 ? parts.previous : parts.next).focus();
  }

  function setToggleOpen(expanded) {
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', String(expanded));
    nav.classList.toggle('is-expanded', expanded);
  }

  function selectTeam(index, { focusTab = false } = {}) {
    if (open) closeProfile({ restoreFocus: false });
    activeTeam = index;
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle('is-active', selected);
    });
    if (toggle) toggle.querySelector('.team-profiles-toggle-label').textContent = teams[index].title;
    if (focusTab) tabs[index].focus();
  }

  // events
  block.addEventListener('click', (event) => {
    const button = event.target.closest('.team-profiles-open');
    if (!button) return;
    const team = panels.findIndex((panel) => panel.contains(button));
    const index = teams[team].profiles.findIndex((p) => p.button === button);
    openProfile(team, index);
  });
  // the whole card opens the profile, as in the prototype
  block.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) return;
    const card = event.target.closest('.team-profiles-card.is-interactive');
    card?.querySelector('.team-profiles-open')?.click();
  });
  parts.close.addEventListener('click', () => closeProfile());
  parts.previous.addEventListener('click', () => step(-1));
  parts.next.addEventListener('click', () => step(1));
  parts.detail.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeProfile();
    }
  });

  if (tabbed) {
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        selectTeam(index);
        if (MOBILE.matches) {
          setToggleOpen(false);
          toggle.focus();
        }
      });
    });
    tablist.addEventListener('keydown', (event) => {
      const keys = {
        ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1,
      };
      let index = tabs.indexOf(document.activeElement);
      if (index < 0) return;
      if (event.key in keys) index = (index + keys[event.key] + tabs.length) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else if (event.key === 'Escape' && MOBILE.matches) {
        event.preventDefault();
        setToggleOpen(false);
        toggle.focus();
        return;
      } else return;
      event.preventDefault();
      selectTeam(index, { focusTab: true });
    });
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      setToggleOpen(expanded);
      if (expanded) tabs[activeTeam].focus();
    });
    document.addEventListener('click', (event) => {
      if (nav.classList.contains('is-expanded') && !nav.contains(event.target)) setToggleOpen(false);
    });
    MOBILE.addEventListener('change', () => setToggleOpen(false));

    // a link to #anchor (on load or later) opens that team
    const fromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const index = panels.findIndex((panel) => panel.id === hash);
      if (index >= 0 && index !== activeTeam) selectTeam(index);
      return index;
    };
    window.addEventListener('hashchange', fromHash);
    if (fromHash() < 0) selectTeam(0);
    else selectTeam(activeTeam);
  }
}
