import initDatePicker from '../../../../scripts/date-picker.js';

export default function createInputField(options = {}) {
  const {
    id,
    label,
    type = 'text',
    value = '',
    placeholder = '',
    suffix = '',
    required = false,
    options: selectOptions = [],
    min,
    max,
    limitDigitsToMax = false,
    datePickerOptions,
    syncTypedDate = false,
    onChange,
  } = options;

  if (typeof label !== 'string' || !label.trim()) return null;

  const container = document.createElement('div');
  container.className = `calculator-input-field${type === 'date' ? ' date-field' : ''}`;

  const labelElement = document.createElement('p');
  labelElement.htmlFor = id;
  const labelCopy = document.createElement('span');
  labelCopy.className = 'field-label-copy';
  labelCopy.textContent = label;
  if (required) {
    const requiredMark = document.createElement('span');
    requiredMark.className = 'required-star';
    requiredMark.setAttribute('aria-hidden', 'true');
    requiredMark.textContent = '*';
    labelCopy.append(requiredMark);
  }
  labelElement.append(labelCopy);

  const input = type === 'select' ? document.createElement('select') : document.createElement('input');
  input.id = id;
  input.name = id;
  input.required = required;

  if (type === 'select') {
    selectOptions.forEach(({ label: optionLabel, value: optionValue }) => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionLabel;
      input.append(option);
    });
    input.value = value;
    input.addEventListener('change', () => {
      if (typeof onChange === 'function') onChange(input.value);
    });
  } else {
    input.type = type === 'date' ? 'text' : type;
    input.value = value;
    input.placeholder = placeholder;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    input.addEventListener('input', () => {
      if (limitDigitsToMax && type === 'number' && Number.isFinite(Number(max))) {
        const digits = String(Math.trunc(Math.abs(Number(max)))).length;
        const integerOverflow = new RegExp(`^(-?\\d{${digits}})\\d+`);
        input.value = input.value.replace(/[eE].*$/, '').replace(integerOverflow, '$1');
      }
      if (typeof onChange === 'function') onChange(input.value);
    });
    if (type === 'date') {
      initDatePicker(input, datePickerOptions).then((instance) => {
        if (!instance?.altInput || !syncTypedDate) return;
        let dateInputChanged = false;
        let typedDateValue = '';
        let lastValidDate = input.value;
        input.addEventListener('input', () => {
          if (!dateInputChanged) lastValidDate = input.value;
        });
        instance.altInput.addEventListener('keydown', (event) => {
          const dateInput = instance.altInput;
          const cursor = dateInput.selectionStart;
          if (dateInput.selectionEnd !== cursor || cursor === null) return;

          let removeAt;
          if (event.key === 'Backspace') {
            removeAt = cursor - 1;
            if (dateInput.value[removeAt] === '/') removeAt -= 1;
          } else if (event.key === 'Delete') {
            removeAt = cursor;
            if (dateInput.value[removeAt] === '/') removeAt += 1;
          } else return;

          if (removeAt < 0 || removeAt >= dateInput.value.length) return;
          event.preventDefault();
          dateInput.value = dateInput.value.slice(0, removeAt)
            + dateInput.value.slice(removeAt + 1);
          dateInput.setSelectionRange(removeAt, removeAt);
          dateInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
        instance.altInput.addEventListener('input', () => {
          dateInputChanged = true;
          const dateInput = instance.altInput;
          const digitsBeforeCursor = dateInput.value
            .slice(0, dateInput.selectionStart)
            .replace(/\D/g, '').length;
          const digits = dateInput.value.replace(/\D/g, '').slice(0, 8);
          let formatted = digits.slice(0, 2);
          if (digits.length >= 2) formatted += '/';
          if (digits.length > 2) formatted += digits.slice(2, 4);
          if (digits.length >= 4) formatted += '/';
          if (digits.length > 4) formatted += digits.slice(4);

          dateInput.value = formatted;
          typedDateValue = formatted;
          const cursor = digitsBeforeCursor
            + Number(digitsBeforeCursor >= 2)
            + Number(digitsBeforeCursor >= 4);
          dateInput.setSelectionRange(cursor, cursor);
        });
        instance.altInput.addEventListener('blur', () => {
          if (!dateInputChanged) return;
          dateInputChanged = false;
          const typedValue = typedDateValue.trim();
          const typedDate = typedValue
            ? instance.parseDate(typedValue, instance.config.altFormat)
            : undefined;
          const isValidDate = typedDate
            && instance.formatDate(typedDate, instance.config.altFormat) === typedValue;
          const isInRange = isValidDate
            && (!instance.config.minDate || typedDate >= instance.config.minDate)
            && (!instance.config.maxDate || typedDate <= instance.config.maxDate);

          let error = container.querySelector('.term-field-error');
          if (!error) {
            container.insertAdjacentHTML(
              'beforeend',
              `<p class="term-field-error" id="${id}-date-error" role="alert"></p>`,
            );
            error = container.querySelector('.term-field-error');
          }

          if (!isInRange) {
            if (lastValidDate) instance.setDate(lastValidDate, false);
            else instance.clear(false);
            instance.altInput.value = typedValue;
            error.textContent = isValidDate
              ? 'Enter a date for an age between 18 and 65.'
              : 'Enter a valid date in DD/MM/YYYY format.';
            error.hidden = false;
            instance.altInput.setAttribute('aria-invalid', 'true');
            instance.altInput.setAttribute('aria-describedby', error.id);
            return;
          }

          error.textContent = '';
          error.hidden = true;
          instance.altInput.setAttribute('aria-invalid', 'false');
          instance.altInput.removeAttribute('aria-describedby');
          instance.setDate(typedDate, true);
          lastValidDate = input.value;
        });
      });
    }
  }

  container.append(labelElement, input);
  if (suffix && type !== 'select' && type !== 'date') {
    container.classList.add('has-input-suffix');
    const suffixElement = document.createElement('span');
    suffixElement.className = 'input-suffix';
    suffixElement.textContent = suffix;
    suffixElement.setAttribute('aria-hidden', 'true');
    container.append(suffixElement);
  }
  return { element: container, input };
}
