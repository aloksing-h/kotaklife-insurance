import { loadForm } from '../form/form.js';
import { toCamelCase } from '../../scripts/aem.js';
import createLead, { buildLeadPayload, splitFullName } from '../../scripts/lead-api.js';

const NAME_MAX_LENGTH = 47;
const EMAIL_MAX_LENGTH = 30;
const MOBILE_LENGTH = 10;
const MIN_AGE = 18;
const MAX_AGE = 65;

/**
 * Creates an HTML element with an optional class name
 * @param {string} tag - HTML tag name
 * @param {string} [className] - Optional CSS class name
 * @returns {HTMLElement} Created element
 */
function createElement(tag, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

/**
 * Formats a JS Date as yyyy-mm-dd for use with a native date input
 * @param {Date} date
 * @returns {string}
 */
function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Computes completed age (in years) for a given yyyy-mm-dd DOB string
 * @param {string} dobValue
 * @returns {number}
 */
function calculateAge(dobValue) {
  const dob = new Date(dobValue);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Sanitizes free-typed name input: strips disallowed characters, leading
 * spaces/dots, collapses consecutive spaces, and enforces max length.
 * @param {string} raw
 * @returns {string}
 */
function sanitizeName(raw) {
  let value = raw.replace(/[^A-Za-z. ]/g, '');
  value = value.replace(/^[\s.]+/, '');
  value = value.replace(/ {2,}/g, ' ');
  return value.slice(0, NAME_MAX_LENGTH);
}

/**
 * Validates a (already sanitized/trimmed) name value
 * @param {string} value
 * @returns {string} error message, or empty string if valid
 */
function validateName(value) {
  const trimmed = value.trim();
  if (!trimmed) return 'Please enter valid name';
  if (!/^[A-Za-z][A-Za-z. ]{0,46}$/.test(trimmed)) return 'Please enter valid name';
  return '';
}

/**
 * Sanitizes free-typed email input: strips whitespace and enforces max length
 * @param {string} raw
 * @returns {string}
 */
function sanitizeEmail(raw) {
  return raw.replace(/\s/g, '').slice(0, EMAIL_MAX_LENGTH);
}

/**
 * Validates an email value
 * @param {string} value
 * @returns {string} error message, or empty string if valid
 */
function validateEmail(value) {
  const trimmed = value.trim();
  if (!trimmed) return 'Please enter valid email';
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return 'Please enter valid email';
  return '';
}

/**
 * Sanitizes free-typed mobile input: digits only, enforces max length
 * @param {string} raw
 * @returns {string}
 */
function sanitizeMobile(raw) {
  return raw.replace(/\D/g, '').replace(/^[0-5]+/, '').slice(0, MOBILE_LENGTH);
}

/**
 * Validates a mobile number value
 * @param {string} value
 * @returns {string} error message, or empty string if valid
 */
function validateMobile(value) {
  if (!value || value.length < MOBILE_LENGTH) return 'Please enter valid mobile number';
  if (!/^[6-9]\d{9}$/.test(value)) return 'Please enter valid mobile number';
  return '';
}

/**
 * Validates a date of birth value against the min/max entry age rules
 * @param {string} value - yyyy-mm-dd
 * @returns {string} error message, or empty string if valid
 */
function validateDob(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Please enter valid date of birth';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return 'Please enter valid date';
  }
  const age = calculateAge(value);
  if (age < MIN_AGE) return 'Min entry age is 18 Years';
  if (age > MAX_AGE) return 'Max entry age is 65 years';
  return '';
}

/**
 * Validates the consent checkbox
 * @param {boolean} checked
 * @returns {string} error message, or empty string if valid
 */
function validateConsent(checked) {
  return checked ? '' : 'Please accept the consent to proceed';
}

/**
 * Displays or clears a validation error message under a field
 * @param {HTMLElement} wrapper - field wrapper element
 * @param {HTMLElement} input - the input/select element being validated
 * @param {string} message - error message, empty string clears the error
 */
function setFieldError(wrapper, input, message) {
  if (!wrapper || !input) return;
  const visibleInput = Reflect.get(input, '_flatpickr')?.altInput || input;
  let error = wrapper.querySelector('.field-error');
  if (message) {
    if (!error) {
      error = createElement('p', 'field-error');
      wrapper.append(error);
    }
    error.textContent = message;
    visibleInput.setAttribute('aria-invalid', 'true');
  } else if (error) {
    error.remove();
    visibleInput.removeAttribute('aria-invalid');
  }
}

/**
 * Refreshes the date-of-birth input's min/max attributes to the valid age range
 * @param {HTMLInputElement} input
 */
function applyDobRange(input) {
  const today = new Date();
  const maxDob = new Date(today);
  maxDob.setFullYear(today.getFullYear() - MIN_AGE);
  const minDob = new Date(today);
  minDob.setFullYear(today.getFullYear() - MAX_AGE);
  input.max = toISODate(maxDob);
  input.min = toISODate(minDob);
}

/**
 * Sets an attribute only when the authored markup doesn't already define it
 * @param {HTMLElement} el
 * @param {string} attr
 * @param {string} value
 */
function ensureAttr(el, attr, value) {
  if (el && !el.hasAttribute(attr)) el.setAttribute(attr, value);
}

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
 * Initializes Flatpickr on the authored date input
 * @param {HTMLInputElement} input
 * @returns {Promise<void>}
 */
async function initializeDatePicker(input) {
  try {
    const flatpickr = await loadFlatpickr();
    const dateFieldWrapper = input.closest('.date-field');

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
      },
      minDate: input.min,
      maxDate: input.max,
      disableMobile: true,
      allowInput: false,
      static: true,
      appendTo: dateFieldWrapper,
      onChange: () => {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
    });

    const currentMonthElement = instance.calendarContainer.querySelector('.flatpickr-current-month');
    if (!currentMonthElement) return;

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
      ? instance.config.minDate.getFullYear() : new Date(input.min).getFullYear();
    const endYear = instance.config.maxDate
      ? instance.config.maxDate.getFullYear() : new Date(input.max).getFullYear();
    for (let year = endYear; year >= startYear; year -= 1) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      yearSelect.append(option);
    }

    // Month & Year Change Events
    monthSelect.addEventListener('change', (event) => {
      event.stopPropagation();
      const targetMonth = Number(event.target.value);
      instance.changeMonth(targetMonth, false);
    });

    yearSelect.addEventListener('change', (event) => {
      event.stopPropagation();
      instance.changeYear(Number(event.target.value));
    });

    const updateHeaderDropdowns = () => {
      monthSelect.value = String(instance.currentMonth);
      yearSelect.value = String(instance.currentYear);
    };

    instance.config.onMonthChange.push(updateHeaderDropdowns);
    instance.config.onYearChange.push(updateHeaderDropdowns);

    currentMonthElement.querySelector('.flatpickr-monthDropdown-months')?.remove();
    currentMonthElement.querySelector('.numInputWrapper')?.remove();
    currentMonthElement.append(monthSelect, yearSelect);
    updateHeaderDropdowns();

    const dropdowns = [];
    const closeMenus = () => dropdowns.forEach(({ trigger, menu }) => {
      trigger.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
    });

    [monthSelect, yearSelect].forEach((select, dropdownIndex) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'custom-header-dropdown';
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'custom-header-select';
      trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      const menu = document.createElement('div');
      menu.className = 'custom-header-menu';
      menu.id = `${input.id || 'invest-dob'}-${dropdownIndex}-menu`;
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', select.getAttribute('aria-label'));
      trigger.setAttribute('aria-controls', menu.id);
      menu.hidden = true;
      const options = Array.from(select.options).map((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'custom-header-option';
        item.setAttribute('role', 'option');
        item.textContent = option.textContent;
        item.dataset.value = option.value;
        item.tabIndex = -1;
        item.addEventListener('click', () => {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          closeMenus();
          trigger.focus();
        });
        menu.append(item);
        return item;
      });
      const sync = () => {
        trigger.textContent = select.selectedOptions[0]?.textContent || '';
        options.forEach((item) => {
          const value = Number(item.dataset.value);
          const { minDate, maxDate } = instance.config;
          item.disabled = dropdownIndex === 0 && (
            (minDate && instance.currentYear === minDate.getFullYear()
              && value < minDate.getMonth())
            || (maxDate && instance.currentYear === maxDate.getFullYear()
              && value > maxDate.getMonth())
          );
          item.setAttribute('aria-selected', String(item.dataset.value === select.value));
        });
      };
      const openMenu = () => {
        closeMenus();
        sync();
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        const selected = options.find((item) => item.dataset.value === select.value
          && !item.disabled) || options.find((item) => !item.disabled);
        selected?.focus({ preventScroll: true });
        if (selected) menu.scrollTop = selected.offsetTop - menu.offsetTop;
      };
      trigger.addEventListener('click', () => {
        if (menu.hidden) openMenu();
        else closeMenus();
      });
      trigger.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          openMenu();
        }
      });
      wrapper.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeMenus();
          trigger.focus();
        }
        const enabled = options.filter((item) => !item.disabled);
        const activeIndex = enabled.indexOf(document.activeElement);
        if (activeIndex < 0) return;
        const nextIndex = {
          ArrowDown: Math.min(activeIndex + 1, enabled.length - 1),
          ArrowUp: Math.max(activeIndex - 1, 0),
          Home: 0,
          End: enabled.length - 1,
        }[event.key];
        if (nextIndex !== undefined) {
          event.preventDefault();
          enabled[nextIndex].focus({ preventScroll: true });
          menu.scrollTop = enabled[nextIndex].offsetTop - menu.offsetTop;
        }
      });
      wrapper.addEventListener('focusout', (event) => {
        if (!wrapper.contains(event.relatedTarget)) closeMenus();
      });
      select.hidden = true;
      select.before(wrapper);
      wrapper.append(trigger, menu, select);
      dropdowns.push({ trigger, menu });
      instance.config.onMonthChange.push(sync);
      instance.config.onYearChange.push(sync);
      sync();
    });
    instance.config.onClose.push(closeMenus);
    instance.calendarContainer.addEventListener('click', (event) => {
      if (!event.target.closest('.custom-header-dropdown')) closeMenus();
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[invest-form] date picker failed to load', error);
  }
}

/**
 * Loads the authored form, then wires up validation and submission
 * @param {Element} block The invest-form block element
 */
/**
 * Optional collapsed state (Figma 11229:15330 desktop, 11229:15661 mobile): rows after
 * the text and form URL hold the collapsed text and the expand button label. With a
 * label the section starts collapsed and the button expands it to show the form.
 * The rows are removed before the form reads its links.
 * @param {Element} block
 * @returns {Function|null} called once the form is built, to move focus into it
 */
function decorateCollapsed(block) {
  const [textRow, labelRow] = [...block.children].slice(2);
  const text = textRow?.textContent.trim();
  const label = labelRow?.textContent.trim();
  [textRow, labelRow].forEach((row) => row?.remove());
  const section = block.closest('.section');
  if (!label || !section) return null;

  block.id = block.id || `invest-form-${document.querySelectorAll('.invest-form-teaser').length + 1}`;
  const teaser = createElement('div', 'invest-form-teaser');
  if (text) {
    const p = createElement('p', 'invest-form-teaser-text');
    p.textContent = text;
    teaser.append(p);
  }
  const button = createElement('button', 'invest-form-teaser-cta');
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', block.id);
  const buttonLabel = createElement('span', 'invest-form-teaser-label');
  buttonLabel.textContent = label;
  const icon = createElement('span', 'invest-form-teaser-icon');
  icon.setAttribute('aria-hidden', 'true');
  button.append(buttonLabel, icon);
  teaser.append(button);

  section.classList.add('invest-form-collapsible', 'invest-form-collapsed');
  block.hidden = true;
  block.before(teaser);

  let ready = false;
  let pendingFocus = false;
  const focusForm = () => {
    const field = block.querySelector('input, select, textarea, button');
    if (field) field.focus();
  };
  button.addEventListener('click', () => {
    section.classList.remove('invest-form-collapsed');
    button.setAttribute('aria-expanded', 'true');
    block.hidden = false;
    teaser.hidden = true;
    if (ready) focusForm();
    else pendingFocus = true;
  });

  return () => {
    ready = true;
    if (pendingFocus) focusForm();
  };
}

export default async function decorate(block) {
  const onFormReady = decorateCollapsed(block);
  const form = await loadForm(block);
  if (!form) return;
  onFormReady?.();

  const nameInput = form.querySelector('.text-field input');
  const emailInput = form.querySelector('.email-field input');
  const mobileInput = form.querySelector('.tel-field input');
  const dobInput = form.querySelector('.date-field input');
  const consentInput = form.querySelector('[name="consent"]');
  const submitButton = form.querySelector('button[type="submit"]');

  if (!nameInput || !mobileInput || !emailInput || !dobInput || !consentInput || !submitButton) {
    return;
  }

  ensureAttr(nameInput, 'placeholder', 'Enter your full name');
  ensureAttr(nameInput, 'maxlength', String(NAME_MAX_LENGTH));
  ensureAttr(nameInput, 'required', '');
  ensureAttr(mobileInput, 'placeholder', 'Enter mobile number');
  ensureAttr(mobileInput, 'maxlength', String(MOBILE_LENGTH));
  ensureAttr(mobileInput, 'required', '');
  ensureAttr(emailInput, 'placeholder', 'Enter email address');
  ensureAttr(emailInput, 'maxlength', String(EMAIL_MAX_LENGTH));
  ensureAttr(emailInput, 'required', '');
  ensureAttr(dobInput, 'required', '');
  ensureAttr(consentInput, 'required', '');

  // For accessibility given id, for, name on input and label
  [nameInput, mobileInput, emailInput, dobInput].forEach((input) => {
    const fieldId = toCamelCase(input.placeholder || '');
    if (!fieldId) return;
    const labels = new Set([
      ...Array.from(input.labels || []),
      ...Array.from(input.closest('.form-field')?.querySelectorAll('label') || []),
    ]);
    input.id = fieldId;
    input.name = fieldId;
    labels.forEach((label) => {
      label.setAttribute('for', fieldId);
      label.classList.add('form-label');
    });
  });

  applyDobRange(dobInput);
  const initialDobValue = dobInput.defaultValue;
  initializeDatePicker(dobInput);

  const nameWrapper = nameInput.closest('.form-field');
  const mobileWrapper = mobileInput.closest('.form-field');
  const emailWrapper = emailInput.closest('.form-field');
  const dobWrapper = dobInput.closest('.form-field');
  const consentWrapper = consentInput.closest('.checkbox-field');

  submitButton.disabled = false;

  nameInput.addEventListener('input', () => {
    const { selectionStart } = nameInput;
    const before = nameInput.value;
    const sanitized = sanitizeName(before);
    if (sanitized !== before) {
      nameInput.value = sanitized;
      const diff = before.length - sanitized.length;
      const pos = Math.max(0, (selectionStart || sanitized.length) - diff);
      nameInput.setSelectionRange(pos, pos);
    }
    setFieldError(nameWrapper, nameInput, validateName(sanitized));
  });

  mobileInput.addEventListener('input', () => {
    const sanitized = sanitizeMobile(mobileInput.value);
    if (sanitized !== mobileInput.value) mobileInput.value = sanitized;
    setFieldError(mobileWrapper, mobileInput, validateMobile(sanitized));
  });

  emailInput.addEventListener('input', () => {
    const sanitized = sanitizeEmail(emailInput.value);
    if (sanitized !== emailInput.value) emailInput.value = sanitized;
    setFieldError(emailWrapper, emailInput, validateEmail(sanitized));
  });

  emailInput.addEventListener('beforeinput', (event) => {
    if (event.data && /\s/.test(event.data)) event.preventDefault();
  });

  dobInput.addEventListener('input', () => {
    setFieldError(dobWrapper, dobInput, validateDob(dobInput.value));
  });

  consentInput.addEventListener('change', () => {
    const { checked } = consentInput;
    setFieldError(consentWrapper, consentInput, validateConsent(checked));
  });

  const validators = [
    () => {
      nameInput.value = nameInput.value.trimEnd();
      const error = validateName(nameInput.value);
      setFieldError(nameWrapper, nameInput, error);
      return !error;
    },
    () => {
      const error = validateMobile(mobileInput.value);
      setFieldError(mobileWrapper, mobileInput, error);
      return !error;
    },
    () => {
      const error = validateEmail(emailInput.value);
      setFieldError(emailWrapper, emailInput, error);
      return !error;
    },
    () => {
      const error = validateDob(dobInput.value);
      setFieldError(dobWrapper, dobInput, error);
      return !error;
    },
    () => {
      const error = validateConsent(consentInput.checked);
      setFieldError(consentWrapper, consentInput, error);
      return !error;
    },
  ];

  let isSubmitting = false;
  const refreshSubmitState = () => {
    submitButton.disabled = isSubmitting;
  };

  form.addEventListener('input', refreshSubmitState);
  form.addEventListener('change', refreshSubmitState);
  refreshSubmitState();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (isSubmitting) return;
    const results = validators.map((validate) => validate());
    if (results.includes(false)) {
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const { firstName, lastName } = splitFullName(nameInput.value);
    const leadData = buildLeadPayload({
      FirstName: firstName,
      LastName: lastName,
      Phone: mobileInput.value.trim(),
      EmailAddress: emailInput.value.trim(),
      mx_DOB: dobInput.value,
    });

    isSubmitting = true;
    submitButton.disabled = true;
    form.querySelector('.form-success-message')?.remove();
    try {
      const response = await createLead(leadData);
      // eslint-disable-next-line no-console
      console.log('[invest-form] Decrypted lead response:', response.data);
      if (Number(response.data?.statusCode) === 200
        && response.data?.message?.Status?.toLowerCase() === 'success') {
        const successMessage = createElement('p', 'form-success-message');
        successMessage.setAttribute('role', 'status');
        successMessage.textContent = response.data?.message?.message || 'Thank you! Our expert will get in touch with you shortly.';
        form.append(successMessage);
        form.reset();
        const datePicker = Reflect.get(dobInput, '_flatpickr');
        if (initialDobValue) datePicker?.setDate(initialDobValue, false);
        else datePicker?.clear(false);
        [
          [nameWrapper, nameInput],
          [mobileWrapper, mobileInput],
          [emailWrapper, emailInput],
          [dobWrapper, dobInput],
          [consentWrapper, consentInput],
        ].forEach(([wrapper, input]) => setFieldError(wrapper, input, ''));
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[invest-form] createLead failed', error);
    } finally {
      isSubmitting = false;
      refreshSubmitState();
    }
  }, true);
}
