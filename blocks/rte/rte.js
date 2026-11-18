/**
 * In-page tabs (links to #section-id): the section ID authored in the section properties
 * arrives as data-id, so the matching section gets it as its id for the link to land.
 * The tab of the section in view is marked active (the first one until then).
 * @param {HTMLAnchorElement[]} links the subnav links to sections on this page
 */
function initInPageTabs(links) {
  const targets = links.map((link) => {
    const id = decodeURIComponent(link.hash.slice(1));
    let target = document.getElementById(id);
    if (!target) {
      target = document.querySelector(`main .section[data-id="${CSS.escape(id)}"]`);
      if (target) target.id = id;
    }
    return target;
  });
  const setActive = (active) => links.forEach((link) => {
    link.classList.toggle('rte-sub-nav-active', link === active);
    if (link === active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  setActive(links[0]);

  // the section crossing the upper part of the viewport is the one in view
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting);
    if (!visible.length) return;
    const index = targets.indexOf(visible[visible.length - 1].target);
    if (index >= 0) setActive(links[index]);
  }, { rootMargin: '-20% 0px -70% 0px' });
  targets.filter(Boolean).forEach((target) => observer.observe(target));
}

export default function decorate(block) {
  if (block.classList.contains('explore-cta')) {
    const buttoncta = block.querySelector('a');
    if (buttoncta) {
      const buttonContainer = buttoncta.closest('p');
      if (buttonContainer) {
        buttonContainer.classList.add('cta-container');
      }
    }
  }

  if (block.classList.contains('subnav')) {
    const links = block.querySelectorAll('a');
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    const isInPage = (link) => /^#[\w%-]+$/.test(link.getAttribute('href') || '');

    // Production: match current page path on load (in-page #links are handled below)
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (href && href !== '#' && !isInPage(link)) {
        const linkPath = new URL(link.href, window.location.origin)
          .pathname.replace(/\/$/, '') || '/';
        if (linkPath === currentPath) {
          link.classList.add('rte-sub-nav-active');
        }
      }
    });

    const inPageLinks = [...links].filter(isInPage);
    if (inPageLinks.length) initInPageTabs(inPageLinks);

    // Testing: highlight on click (works with # hrefs)
    links.forEach((link) => {
      link.addEventListener('click', () => {
        links.forEach((l) => l.classList.remove('rte-sub-nav-active'));
        link.classList.add('rte-sub-nav-active');
      });
    });
  }
}
