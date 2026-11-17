const formatTitleFromPath = (pathPart) => pathPart
  .split('-')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const getAllPathsExceptCurrent = (paths) => {
  const result = [];
  const localePrefix = '/in/en';
  const hasLocale = paths.startsWith(localePrefix);
  const cleanPath = paths
    .replace(new RegExp(`^${localePrefix}(?=/|$)`), '')
    .replace(/^\/|\/$/g, '');
  const pathsList = cleanPath.split('/').filter(Boolean);

  for (let i = 0; i < pathsList.length - 1; i += 1) {
    const pathPart = pathsList[i];
    let prevPath = '';
    if (result[i - 1]) {
      prevPath = result[i - 1].path;
    } else if (hasLocale) {
      prevPath = localePrefix;
    }
    const path = `${prevPath}/${pathPart}`;
    const url = `${window.location.origin}${path}`;
    const name = formatTitleFromPath(pathPart);

    result.push({ path, name, url });
  }
  return result;
};

const createLink = (path) => {
  const pathLink = document.createElement('a');
  pathLink.href = path.url;
  if (path.icon) {
    const icon = document.createElement('img');
    icon.src = path.icon;
    icon.alt = path.name;
    pathLink.append(icon);
  } else {
    pathLink.innerText = path.name;
  }
  return pathLink;
};

const moveBreadcrumbToBanner = (block) => {
  const breadcrumbContainer = block.closest('main .breadcrumb-container');
  if (!breadcrumbContainer) return;

  const bannerSection = document.querySelector(
    'main > .section:has(.banner-v2), main > .section:has(.banner)',
  );
  if (!bannerSection) return;

  bannerSection.classList.add('breadcrumb-pos');
  if (window.location.pathname.toLowerCase().includes('about')) {
    bannerSection.classList.add('about-us');
    document.body.classList.add('about-us');
  }
  const breadcrumbContainers = [...bannerSection.querySelectorAll('.breadcrumb-container')];
  const firstContainer = breadcrumbContainers[0];

  if (firstContainer && firstContainer !== breadcrumbContainer) {
    firstContainer.replaceChildren(...breadcrumbContainer.childNodes);
    breadcrumbContainer.remove();
  } else if (!firstContainer) {
    bannerSection.append(breadcrumbContainer);
  }

  breadcrumbContainers.slice(1).forEach((container) => container.remove());
};

export default function decorate(block) {
  const breadcrumb = document.createElement('nav');
  breadcrumb.setAttribute('role', 'Breadcrumb');
  breadcrumb.setAttribute('aria-label', 'Breadcrumb');
  block.innerHTML = '';
  const HomeLink = createLink({
    path: '',
    name: 'Home',
    icon: '/icons/home-icon.svg',
    url: window.location.origin,
  });
  const breadcrumbLinks = [HomeLink.outerHTML];

  const path = window.location.pathname;
  let paths = getAllPathsExceptCurrent(path);

  if (path.toLowerCase().includes('insurance-guide') && paths.length > 0) {
    paths = [paths[paths.length - 1]];
  }

  paths.forEach((pathPart) => breadcrumbLinks.push(createLink(pathPart).outerHTML));
  const currentPath = document.createElement('span');
  currentPath.innerText = formatTitleFromPath(path.split('/').filter(Boolean).pop() || '');
  breadcrumbLinks.push(currentPath.outerHTML);

  breadcrumb.innerHTML = breadcrumbLinks.join(
    '<span class="breadcrumb-separator">/</span>',
  );
  block.append(breadcrumb);
  moveBreadcrumbToBanner(block);
}
