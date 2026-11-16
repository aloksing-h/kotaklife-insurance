let flatpickrPromise;

/**
 * Loads the bundled Flatpickr assets once
 * @returns {Promise<Function>}
 */
function loadFlatpickr() {
  if (typeof window.flatpickr === 'function') return Promise.resolve(window.flatpickr);
  if (flatpickrPromise) return flatpickrPromise;

  const basePath = window.hlx?.codeBasePath || '';
  flatpickrPromise = new Promise((resolve, reject) => {
    const stylesheetId = 'flatpickr-styles';
    if (!document.getElementById(stylesheetId)) {
      const stylesheet = document.createElement('link');
      stylesheet.id = stylesheetId;
      stylesheet.rel = 'stylesheet';
      stylesheet.href = `${basePath}/styles/flatpickr.min.css`;
      document.head.append(stylesheet);
    }

    const script = document.createElement('script');
    script.src = `${basePath}/scripts/flatpickr.min.js`;
    script.onload = () => {
      if (typeof window.flatpickr === 'function') resolve(window.flatpickr);
      else reject(new Error('Flatpickr did not load'));
    };
    script.onerror = () => reject(new Error('Unable to load Flatpickr'));
    document.head.append(script);
  });

  return flatpickrPromise;
}

/**
 * Sets up a custom styled dropdown for the calendar header (month/year).
 * Retains the native select in the DOM for accessibility and event bubbling.
 * @param {HTMLSelectElement} select
 * @param {Function} onSelect
 * @returns {{ wrapper: HTMLElement, update: Function }}
 */
function setupHeaderDropdown(select, onSelect, useCustomDropdown = true) {
  if (!useCustomDropdown) {
    select.addEventListener('change', () => onSelect(Number(select.value)));
    return { wrapper: select, update: () => {} };
  }

  const isMonth = select.classList.contains('custom-month-select');
  const wrapper = document.createElement('div');
  wrapper.className = `custom-header-dropdown ${isMonth ? 'month-dropdown' : 'year-dropdown'}`;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = `custom-header-trigger ${isMonth ? 'month-trigger' : 'year-trigger'}`;
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const label = document.createElement('span');
  label.className = 'custom-header-label';
  trigger.append(label);

  const menu = document.createElement('ul');
  menu.className = 'custom-header-menu';
  menu.setAttribute('role', 'listbox');

  const update = () => {
    menu.innerHTML = '';
    Array.from(select.options).forEach((opt) => {
      if (opt.disabled) return;
      const li = document.createElement('li');
      li.className = 'custom-header-option';
      li.setAttribute('role', 'option');
      li.dataset.value = opt.value;
      li.textContent = opt.textContent;

      if (opt.value === select.value) {
        li.classList.add('is-selected');
        li.setAttribute('aria-selected', 'true');
        label.textContent = opt.textContent;
      }

      li.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        select.value = opt.value;
        onSelect(Number(opt.value));
        wrapper.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      });

      menu.append(li);
    });

    const activeOpt = select.options[select.selectedIndex];
    if (activeOpt) {
      label.textContent = activeOpt.textContent;
    }
  };

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = wrapper.classList.contains('is-open');
    wrapper.closest('.flatpickr-calendar')?.querySelectorAll('.custom-header-dropdown.is-open')
      .forEach((openDropdown) => {
        if (openDropdown !== wrapper) {
          openDropdown.classList.remove('is-open');
          openDropdown.querySelector('.custom-header-trigger')?.setAttribute('aria-expanded', 'false');
        }
      });
    wrapper.classList.toggle('is-open', !isOpen);
    trigger.setAttribute('aria-expanded', String(!isOpen));
  });

  wrapper.append(select, trigger, menu);
  return { wrapper, update };
}

/**
 * Initializes Flatpickr (with custom month/year dropdowns) on a date input.
 * Honors the input's existing min/max attributes, if any, as the allowed range.
 * @param {HTMLInputElement} input
 * @param {object} [options] Extra Flatpickr options merged over the defaults,
 *   e.g. `{ mode: 'range', dateFormat: 'd.m.Y', altInput: false }` for a date range picker.
 *   `options.onChange` runs after the default `input` event is dispatched.
 * @returns {Promise<object|undefined>} The Flatpickr instance
 */
export default async function initDatePicker(input, options = {}) {
  try {
    const flatpickr = await loadFlatpickr();
    const dateFieldWrapper = input.closest('.date-field');
    const {
      onChange, locale, customHeaderDropdowns = true, headerMode = 'dropdown', ...overrides
    } = options;

    const instance = flatpickr(input, {
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd-m-Y',
      locale: {
        firstDayOfWeek: 1,
        weekdays: {
          shorthand: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
          longhand: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        },
        ...locale,
      },
      minDate: input.min || undefined,
      maxDate: input.max || undefined,
      disableMobile: true,
      allowInput: true,
      static: true,
      appendTo: dateFieldWrapper,
      clickOpens: false,
      ...overrides,
      onChange: (...args) => {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof onChange === 'function') onChange(...args);
      },
    });

    // clickOpens is disabled above so a
    // second click can close the calendar instead of re-opening it
    const toggleTarget = instance.altInput || input;
    toggleTarget.addEventListener('click', () => {
      if (instance.isOpen) instance.close();
      else instance.open();
    });

    const currentMonthElement = instance.calendarContainer.querySelector('.flatpickr-current-month');
    if (!currentMonthElement) return instance;

    const trimEmptyWeek = () => {
      const days = instance.daysContainer?.querySelectorAll('.flatpickr-day');
      if (!days || days.length < 42) return;
      const sixthRow = Array.from(days).slice(35);
      const isAllNextMonth = sixthRow.every((day) => day.classList.contains('nextMonthDay'));
      sixthRow.forEach((day) => {
        day.style.display = isAllNextMonth ? 'none' : '';
      });
    };

    // if (headerMode === 'label') {
    if (headerMode === 'label' && input.closest('.fund-nav-detail')) {
      const monthControls = [instance.prevMonthNav, instance.nextMonthNav];
      const updateMonthLabel = () => {
        currentMonthElement.textContent = `${instance.l10n.months.longhand[instance.currentMonth]}, ${instance.currentYear}`;
        monthControls.forEach((control) => {
          const disabled = control.classList.contains('flatpickr-disabled');
          control.setAttribute('aria-disabled', String(disabled));
          control.setAttribute('tabindex', disabled ? '-1' : '0');
        });
      };
      currentMonthElement.setAttribute('aria-live', 'polite');
      monthControls.forEach((control, index) => {
        control.setAttribute('role', 'button');
        control.setAttribute('aria-label', index === 0 ? 'Previous month' : 'Next month');
        control.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation();
          if (control.getAttribute('aria-disabled') !== 'true') control.click();
        });
      });
      instance.config.onMonthChange.push(updateMonthLabel, trimEmptyWeek);
      instance.config.onYearChange.push(updateMonthLabel, trimEmptyWeek);
      instance.config.onValueUpdate.push(updateMonthLabel, trimEmptyWeek);
      instance.config.onOpen.push(updateMonthLabel, trimEmptyWeek);
      updateMonthLabel();
      trimEmptyWeek();
      return instance;
    }

    // Build Custom Month Dropdown Select
    const monthSelect = document.createElement('select');
    monthSelect.className = 'custom-header-select custom-month-select';
    monthSelect.setAttribute('aria-label', 'Month');
    instance.l10n.months.longhand.forEach((month, monthIndex) => {
      const option = document.createElement('option');
      option.value = String(monthIndex);
      option.textContent = month;
      monthSelect.append(option);
    });

    // Build Custom Year Dropdown Select
    const yearSelect = document.createElement('select');
    yearSelect.className = 'custom-header-select custom-year-select';
    yearSelect.setAttribute('aria-label', 'Year');
    const startYear = instance.config.minDate
      ? instance.config.minDate.getFullYear() : new Date().getFullYear() - 100;
    const endYear = instance.config.maxDate
      ? instance.config.maxDate.getFullYear() : new Date().getFullYear();
    for (let year = endYear; year >= startYear; year -= 1) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      yearSelect.append(option);
    }

    const monthDropdown = setupHeaderDropdown(monthSelect, (val) => {
      instance.changeMonth(val, false);
    }, customHeaderDropdowns);

    const yearDropdown = setupHeaderDropdown(yearSelect, (val) => {
      instance.changeYear(val);
    }, customHeaderDropdowns);

    const updateHeaderDropdowns = () => {
      const { minDate, maxDate } = instance.config;
      const { currentYear } = instance;

      Array.from(monthSelect.options).forEach((option) => {
        const month = Number(option.value);
        let disabled = false;
        if (minDate && currentYear === minDate.getFullYear() && month < minDate.getMonth()) {
          disabled = true;
        }
        if (maxDate && currentYear === maxDate.getFullYear() && month > maxDate.getMonth()) {
          disabled = true;
        }
        option.disabled = disabled;
      });

      monthSelect.value = String(instance.currentMonth);
      yearSelect.value = String(instance.currentYear);

      monthDropdown.update();
      yearDropdown.update();
    };

    instance.config.onMonthChange.push(updateHeaderDropdowns, trimEmptyWeek);
    instance.config.onYearChange.push(updateHeaderDropdowns, trimEmptyWeek);
    instance.config.onOpen.push(trimEmptyWeek);

    currentMonthElement.querySelector('.flatpickr-monthDropdown-months')?.remove();
    currentMonthElement.querySelector('.numInputWrapper')?.remove();
    currentMonthElement.append(monthDropdown.wrapper, yearDropdown.wrapper);
    updateHeaderDropdowns();
    trimEmptyWeek();

    const closeDropdowns = () => {
      instance.calendarContainer?.querySelectorAll('.custom-header-dropdown.is-open')
        .forEach((d) => {
          d.classList.remove('is-open');
          d.querySelector('.custom-header-trigger')?.setAttribute('aria-expanded', 'false');
        });
    };

    instance.config.onClose.push(closeDropdowns);

    // Close open dropdowns if clicking elsewhere inside the calendar
    instance.calendarContainer.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-header-dropdown')) {
        closeDropdowns();
      }
    });

    // Close open dropdowns if clicking anywhere outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-header-dropdown')) {
        closeDropdowns();
      }
    });

    return instance;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[date-picker] failed to load', error);
    return undefined;
  }
}
