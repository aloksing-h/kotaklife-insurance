import {
  div, p, span, a, button, select, option, ul, li, domEl,
} from '../../scripts/dom-helpers.js';
import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Fund Performance Content Data Model
 * Structure containing all UI text, assets, and yearly report links
 */
const fundDataModel = {
  config: {
    maxVisibleYearsDesktop: 9,
    bannerTitlePrefix: 'Annual fund performance year',
    bannerGraphicSrc: '/icons/fund-update-kotak-signature.svg',
    mobileBannerGraphicSrc: '/icons/fundupdate-annually-mv.svg',
    downloadLabel: 'Download',
  },
  years: [
    {
      year: '2026',
      annualReportUrl: '#',
      monthlyReports: [
        // { month: 'December', url: '/reports/2026-december.pdf' },
        { month: 'December', url: '#' },
        { month: 'November', url: '#' },
        { month: 'October', url: '#' },
        { month: 'September', url: '#' },
        { month: 'August', url: '#' },
        { month: 'July', url: '#' },
        { month: 'June', url: '#' },
        { month: 'May', url: '#' },
        { month: 'April', url: '#' },
        { month: 'March', url: '#' },
        { month: 'February', url: '#' },
        { month: 'January', url: '#' },
      ],
    },
    {
      year: '2025',
      annualReportUrl: '#',
      monthlyReports: [
        { month: 'December', url: '#' },
        { month: 'November', url: '#' },
        { month: 'October', url: '#' },
        { month: 'September', url: '#' },
        { month: 'August', url: '#' },
        { month: 'July', url: '#' },
        { month: 'June', url: '#' },
        { month: 'May', url: '#' },
        { month: 'April', url: '#' },
        { month: 'March', url: '#' },
        { month: 'February', url: '#' },
        { month: 'January', url: '#' },
      ],
    },
    {
      year: '2024',
      annualReportUrl: '#',
      monthlyReports: [
        { month: 'December', url: '#' },
        { month: 'November', url: '#' },
        { month: 'October', url: '#' },
        { month: 'September', url: '#' },
        { month: 'August', url: '#' },
        { month: 'July', url: '#' },
        { month: 'June', url: '#' },
        { month: 'May', url: '#' },
        { month: 'April', url: '#' },
        { month: 'March', url: '#' },
        { month: 'February', url: '#' },
        { month: 'January', url: '#' },
      ],
    },
    {
      year: '2023',
      annualReportUrl: '#',
      monthlyReports: [
        { month: 'December', url: '#' },
        { month: 'November', url: '#' },
        { month: 'October', url: '#' },
        { month: 'September', url: '#' },
        { month: 'August', url: '#' },
        { month: 'July', url: '#' },
        { month: 'June', url: '#' },
        { month: 'May', url: '#' },
        { month: 'April', url: '#' },
        { month: 'March', url: '#' },
        { month: 'February', url: '#' },
        { month: 'January', url: '#' },
      ],
    },
    {
      year: '2022',
      annualReportUrl: '#',
      monthlyReports: [
        { month: 'December', url: '#' },
        { month: 'November', url: '#' },
        { month: 'October', url: '#' },
        { month: 'September', url: '#' },
        { month: 'August', url: '#' },
        { month: 'July', url: '#' },
        { month: 'June', url: '#' },
        { month: 'May', url: '#' },
        { month: 'April', url: '#' },
        { month: 'March', url: '#' },
        { month: 'February', url: '#' },
        { month: 'January', url: '#' },
      ],
    },
    {
      year: '2021',
      annualReportUrl: '#',
      monthlyReports: [
        { month: 'December', url: '#' },
        { month: 'November', url: '#' },
        { month: 'October', url: '#' },
        { month: 'September', url: '#' },
        { month: 'August', url: '#' },
        { month: 'July', url: '#' },
        { month: 'June', url: '#' },
        { month: 'May', url: '#' },
        { month: 'April', url: '#' },
        { month: 'March', url: '#' },
        { month: 'February', url: '#' },
        { month: 'January', url: '#' },
      ],
    },
    {
      year: '2020',
      annualReportUrl: '#',
      monthlyReports: [
        { month: 'December', url: '#' },
        { month: 'November', url: '#' },
        { month: 'October', url: '#' },
        { month: 'September', url: '#' },
        { month: 'August', url: '#' },
        { month: 'July', url: '#' },
        { month: 'June', url: '#' },
        { month: 'May', url: '#' },
        { month: 'April', url: '#' },
        { month: 'March', url: '#' },
        { month: 'February', url: '#' },
        { month: 'January', url: '#' },
      ],
    },
    {
      year: '2019',
      annualReportUrl: '#',
      monthlyReports: [
        { month: 'December', url: '#' },
        { month: 'November', url: '#' },
        { month: 'October', url: '#' },
        { month: 'September', url: '#' },
        { month: 'August', url: '#' },
        { month: 'July', url: '#' },
        { month: 'June', url: '#' },
        { month: 'May', url: '#' },
        { month: 'April', url: '#' },
        { month: 'March', url: '#' },
        { month: 'February', url: '#' },
        { month: 'January', url: '#' },
      ],
    },
    {
      year: '2018',
      annualReportUrl: '#',
      monthlyReports: [
        { month: 'December', url: '#' },
        { month: 'November', url: '#' },
        { month: 'October', url: '#' },
        { month: 'September', url: '#' },
        { month: 'August', url: '#' },
        { month: 'July', url: '#' },
        { month: 'June', url: '#' },
        { month: 'May', url: '#' },
        { month: 'April', url: '#' },
        { month: 'March', url: '#' },
        { month: 'February', url: '#' },
        { month: 'January', url: '#' },
      ],
    },
    {
      year: '2017',
      annualReportUrl: '#',
      monthlyReports: [
        { month: 'December', url: '#' },
        { month: 'November', url: '#' },
        { month: 'October', url: '#' },
        { month: 'September', url: '#' },
        { month: 'August', url: '#' },
        { month: 'July', url: '#' },
        { month: 'June', url: '#' },
        { month: 'May', url: '#' },
        { month: 'April', url: '#' },
        { month: 'March', url: '#' },
        { month: 'February', url: '#' },
        { month: 'January', url: '#' },
      ],
    },
    {
      year: '2016',
      annualReportUrl: '#',
      monthlyReports: [
        { month: 'December', url: '#' },
        { month: 'November', url: '#' },
        { month: 'October', url: '#' },
        { month: 'September', url: '#' },
        { month: 'August', url: '#' },
        { month: 'July', url: '#' },
        { month: 'June', url: '#' },
        { month: 'May', url: '#' },
        { month: 'April', url: '#' },
        { month: 'March', url: '#' },
        { month: 'February', url: '#' },
        { month: 'January', url: '#' },
      ],
    },
  ],
};

/**
 * Extracts authored block HTML rows into the data model structure
 */
function parseAuthoredBlockToObject(block) {
  const parsedMap = new Map();

  [...block.children].forEach((row) => {
    const cols = [...row.children];
    if (cols.length >= 3) {
      const year = cols[0].textContent.trim();
      const month = cols[1].textContent.trim();
      const url = cols[2].querySelector('a')?.href || cols[2].textContent.trim() || '#';

      if (year) {
        if (!parsedMap.has(year)) {
          parsedMap.set(year, {
            year,
            annualReportUrl: '#',
            monthlyReports: [],
          });
        }
        const record = parsedMap.get(year);
        if (month.toLowerCase() === 'annual') {
          record.annualReportUrl = url;
        } else {
          record.monthlyReports.push({ month, url });
        }
      }
    }
  });

  return parsedMap.size > 0
    ? { ...fundDataModel, years: Array.from(parsedMap.values()) }
    : fundDataModel;
}

export default function decorate(block) {
  // 1. Build Data Model Object from authored cells or default schema
  const dataModel = parseAuthoredBlockToObject(block);
  const { config, years } = dataModel;

  if (!years.length) return;

  let activeYearObj = years[0];
  let showAllYears = false;
  let updateActiveYear;

  // Clear container DOM
  block.replaceChildren();

  // 2. DOM Helper: Mobile Select Dropdown
  const mobileSelect = select(
    { class: 'mobile-year-select', 'aria-label': 'Select fund year' },
    ...years.map((y) => option({ value: y.year, selected: y.year === activeYearObj.year }, y.year)),
  );
  mobileSelect.addEventListener('change', (e) => {
    const found = years.find((item) => item.year === e.target.value);
    if (found) updateActiveYear(found);
  });

  // 3. DOM Helper: Desktop Sidebar Navigation
  const sidebarUl = ul({ class: 'year-list' });

  const renderSidebar = () => {
    sidebarUl.replaceChildren();
    const visibleYears = showAllYears
      ? years
      : years.slice(0, config.maxVisibleYearsDesktop);

    visibleYears.forEach((item) => {
      const yearBtn = button(
        {
          class: `year-btn ${item.year === activeYearObj.year ? 'active' : ''}`,
          type: 'button',
          'aria-pressed': String(item.year === activeYearObj.year),
          'data-year': item.year,
        },
        span(item.year),
        span({ class: 'icon-chevron', 'aria-hidden': 'true' }),
      );
      yearBtn.addEventListener('click', () => updateActiveYear(item));
      sidebarUl.appendChild(li(yearBtn));
    });

    if (years.length > config.maxVisibleYearsDesktop) {
      const toggleBtn = button(
        { class: 'show-more-btn', type: 'button', 'aria-expanded': String(showAllYears) },
        span(showAllYears ? 'Show Less' : 'Show More'),
        span({ class: 'plus-icon', 'aria-hidden': 'true' }),
      );
      toggleBtn.addEventListener('click', () => {
        showAllYears = !showAllYears;
        renderSidebar();
      });
      sidebarUl.appendChild(li(toggleBtn));
    }
  };

  const sidebar = div({ class: 'fund-update-sidebar' }, sidebarUl);

  // 4. DOM Helper: Banner Section
  const bannerTitle = p({ class: 'banner-title' });
  const bannerDlBtn = a(
    { class: 'banner-download-btn', target: '_blank', rel: 'noopener noreferrer' },
    `${config.downloadLabel} `,
    span({ class: 'dl-icon', 'aria-hidden': 'true' }),
  );

  const bannerPicture = createOptimizedPicture(
    config.bannerGraphicSrc,
    'Kotak Life',
    false,
    [{ width: '410' }],
  );
  const mobileBannerSource = domEl('source', {
    srcset: config.mobileBannerGraphicSrc,
    media: '(max-width: 768px)',
  });
  bannerPicture.insertBefore(mobileBannerSource, bannerPicture.firstChild);

  const bannerImage = bannerPicture.querySelector('img');
  const mobileBannerMedia = window.matchMedia('(max-width: 768px)');
  const updateBannerAlt = () => {
    bannerImage.alt = mobileBannerMedia.matches ? '' : 'Kotak Life';
  };
  updateBannerAlt();
  mobileBannerMedia.addEventListener('change', updateBannerAlt);

  const bannerGraphic = div(
    { class: 'banner-graphic' },
    bannerPicture,
  );

  const bannerBox = div(
    { class: 'fund-update-banner' },
    div({ class: 'banner-text-content' }, bannerTitle, bannerDlBtn),
    bannerGraphic,
  );

  // 5. DOM Helper: Monthly Report Cards Grid
  const monthGrid = div({ class: 'month-cards-grid', role: 'list', 'aria-label': 'Monthly fund reports' });
  const mainContent = div({ class: 'fund-update-main' }, bannerBox, monthGrid);

  // 6. View Update Function
  updateActiveYear = (selectedYearObj) => {
    activeYearObj = selectedYearObj;
    mobileSelect.value = selectedYearObj.year;

    // Update active class state on sidebar buttons
    sidebarUl.querySelectorAll('.year-btn').forEach((btn) => {
      const isActive = btn.dataset.year === selectedYearObj.year;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    // Update Banner Text & Link from Object
    bannerTitle.textContent = `${config.bannerTitlePrefix} ${selectedYearObj.year}`;
    bannerDlBtn.href = selectedYearObj.annualReportUrl || '#';
    bannerDlBtn.setAttribute('aria-label', `Download annual fund report ${selectedYearObj.year}`);

    // Populate Cards Grid from Object
    monthGrid.replaceChildren();
    if (selectedYearObj.monthlyReports?.length) {
      selectedYearObj.monthlyReports.forEach(({ month, url }) => {
        const card = div(
          { class: 'month-card', role: 'listitem' },
          div(
            { class: 'card-left' },
            span({ class: 'doc-icon', 'aria-hidden': 'true' }),
            span({ class: 'month-label' }, `${month} ${selectedYearObj.year}`),
          ),
          div(
            { class: 'card-actions' },
            a(
              {
                href: url,
                target: '_blank',
                rel: 'noopener noreferrer',
                class: 'action-btn view-btn',
                'aria-label': `View ${month} ${selectedYearObj.year} fund report`,
              },
              span({ class: 'eye-icon', 'aria-hidden': 'true' }),
            ),
            a(
              {
                href: url,
                download: true,
                class: 'action-btn download-btn',
                'aria-label': `Download ${month} ${selectedYearObj.year} fund report`,
              },
              span({ class: 'dl-icon', 'aria-hidden': 'true' }),
            ),
          ),
        );
        monthGrid.appendChild(card);
      });
    }
  };

  // 7. Assemble Complete Block Layout
  const layout = div(
    { class: 'fund-update-layout' },
    mobileSelect,
    sidebar,
    mainContent,
  );

  block.appendChild(layout);
  renderSidebar();
  updateActiveYear(activeYearObj);
}
