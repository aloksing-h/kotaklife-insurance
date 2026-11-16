import createAgeField from './fields/age-field/age-field.js';
import createFrequencyField from './fields/dropdown-field/dropdown-field.js';
import createAmountField from './fields/monthly-expense-wave-slider/monthly-expense-wave-slider.js';
import createRateField from './fields/rate-field/rate-field.js';
import createRatioField from './fields/retirement-expense-ratio/retirement-expense-ratio.js';
import createInputField from './fields/input-field/input-field.js';
import createGenderField from './fields/gender-field/gender-field.js';
import createTobaccoField from './fields/tobacco-field/tobacco-field.js';

const factories = {
  age: createAgeField,
  frequency: createFrequencyField,
  amount: createAmountField,
  rate: createRateField,
  ratio: createRatioField,
  input: createInputField,
  gender: createGenderField,
  tobacco: createTobaccoField,
};

export function findAuthoredField(block, selectors, labels) {
  const field = [selectors].flat().filter(Boolean)
    .map((selector) => block.querySelector(selector)
      || (/^\.[\w-]+$/.test(selector) && block.querySelector(`${selector}-field`)))
    .find(Boolean);
  if (field || !labels) return field;

  const expectedLabels = [labels].flat().map((label) => label.trim().toLowerCase());
  return [...block.querySelectorAll('fieldset, .form-field')].find((candidate) => {
    const label = candidate.querySelector('legend, label')?.textContent.trim().toLowerCase();
    return expectedLabels.includes(label);
  });
}

export function readConfiguredValues(block, selector, fallback, label) {
  const field = findAuthoredField(block, selector, label);
  const input = field?.matches('input') ? field : field?.querySelector('input');
  if (!input?.value.trim()) return fallback;
  const parts = input.value.split(',').map((value) => value.trim());
  const values = parts.map(Number);
  return parts.every(Boolean) && values.every(Number.isFinite) ? values : fallback;
}

export function readConfiguredRange(block, selector, fallback, label) {
  const values = readConfiguredValues(block, selector, fallback, label);
  return values?.length >= 2 && values[0] < values[1] ? values.slice(0, 2) : fallback;
}

export function readAuthoredValue(block, selectors, fallback) {
  const field = findAuthoredField(block, selectors);
  const selected = field?.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
  if (selected) return selected.value;
  const input = field?.matches('input, select') ? field : field?.querySelector('input, select');
  return input?.value || fallback;
}

export function readAuthoredAttribute(block, selectors, attribute, fallback = '') {
  const field = findAuthoredField(block, selectors);
  const input = field?.matches('input, select, textarea')
    ? field : field?.querySelector('input, select, textarea');
  return input?.getAttribute(attribute) || fallback;
}

export function readAuthoredSelection(block, selectors, fallback = '', labels = undefined) {
  const field = findAuthoredField(block, selectors, labels);
  const selected = field?.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
  return selected?.value || fallback;
}

export function readAuthoredLabel(block, selectors, fallback = '') {
  const field = findAuthoredField(block, selectors);
  return field?.querySelector('legend, label')?.textContent.trim() || fallback;
}

export function readAuthoredOptions(block, selectors, fallback, fieldLabel) {
  const field = findAuthoredField(block, selectors)
    || (fieldLabel && [...block.querySelectorAll('fieldset, .form-field')].find((candidate) => {
      const label = candidate.querySelector('legend, label')?.textContent.trim().toLowerCase();
      return label?.startsWith(fieldLabel.toLowerCase());
    }));
  const select = field?.matches('select') ? field : field?.querySelector('select');
  if (select) {
    const options = [...select.options].filter((option) => option.value)
      .map((option) => ({ label: option.textContent.trim(), value: option.value }));
    if (options.length) return options;
  }
  const radios = field?.matches('input[type="radio"]')
    ? [field] : [...(field?.querySelectorAll('input[type="radio"]') || [])];
  if (!radios.length) return fallback;
  return radios.map((input) => ({
    label: input.closest('label')?.textContent.trim() || input.value,
    value: input.value.toLowerCase(),
  }));
}

export function adaptField(field, valueType = 'string') {
  if (!field) return null;
  const input = field.input || field.element.querySelector('input:not([type="radio"]), select');
  return {
    element: field.element,
    input,
    getValue() {
      if (input && !input.value.trim()) return valueType === 'number' ? undefined : '';
      const value = field.getValue ? field.getValue() : input?.value;
      if (value === undefined || value === null || value === '') return undefined;
      return valueType === 'number' ? Number(value) : value;
    },
    setValue(value) {
      if (field.setValue) field.setValue(value);
      else if (input) input.value = value;
    },
  };
}

export function createCalculatorField(block, definition, instanceId, onChange) {
  const factory = factories[definition.control];
  if (!factory) throw new Error(`Unknown calculator control: ${definition.control}`);
  const authored = findAuthoredField(block, definition.selector, definition.label);
  const label = authored?.querySelector('label, legend')?.textContent.trim()
    || '';
  const tooltipField = definition.tooltipLabel
    ? findAuthoredField(block, definition.tooltipSelector, definition.tooltipLabel) : null;
  const authoredInfoText = tooltipField
    ?.querySelector('input, textarea, select')?.value.trim()
    || tooltipField?.querySelector('.field-help-text')?.textContent.trim()
    || tooltipField?.querySelector('label, legend')?.textContent.trim();
  const configuredOptions = typeof definition.options === 'function'
    ? definition.options(block) : definition.options;
  if (definition.control === 'tobacco' && configuredOptions.optionsList?.length !== 2) {
    return null;
  }
  const options = { ...configuredOptions, id: `${instanceId}-${definition.key}`, onChange };
  if (definition.tooltipLabel) options.infoText = authoredInfoText || '';
  if (definition.initialValue) options.value = definition.initialValue(block);
  if (definition.range || definition.authoredRange) {
    const { rangeSelector: rangeClass, rangeLabel, range: limits } = definition;
    const configuredRange = readConfiguredRange(block, rangeClass, limits, rangeLabel);
    if (!configuredRange) return null;
    const range = definition.bounds ? [
      Math.max(configuredRange[0], definition.bounds[0]),
      Math.min(configuredRange[1], definition.bounds[1]),
    ] : configuredRange;
    if (range[0] >= range[1] && definition.bounds) range.splice(0, 2, ...definition.bounds);
    [options.min, options.max] = range;
    const initialValue = options.value ?? options.min;
    if (definition.useAuthoredValue && options.value !== undefined) {
      options.value = Math.max(options.min, Math.min(options.max, initialValue));
    } else if (['amount', 'rate', 'ratio'].includes(definition.control)) {
      options.value = options.min;
    } else {
      options.value = Math.max(options.min, Math.min(options.max, initialValue));
    }
    const fallback = definition.authoredRange ? [] : definition.milestones || range;
    const { milestoneSelector: milestoneClass, milestoneLabel } = definition;
    const values = readConfiguredValues(block, milestoneClass, fallback, milestoneLabel);
    const milestones = definition.bounds
      ? values.filter((value) => value >= options.min && value <= options.max)
      : values;
    if (!milestones.length && !definition.authoredRange) {
      milestones.push(...(definition.milestones || range));
    }
    options.milestones = definition.formatMilestone
      ? milestones.map((val) => ({ val, text: definition.formatMilestone(val) }))
      : milestones;
  }
  if (definition.control === 'amount') options.title = label;
  else options.label = label;
  const field = factory(options);
  if (definition.readOnly && field?.input) field.input.readOnly = true;
  if (!definition.tooltipLabel) {
    field?.element.querySelectorAll('img[src="/icons/information-icon.svg"]')
      .forEach((icon) => icon.remove());
  }
  return adaptField(field, definition.valueType);
}
