import { createCalculatorField } from './field-adapter.js';

const controllers = new WeakMap();
let instanceCount = 0;

export function getCalculatorScope(block, id, instanceScope = true) {
  return (instanceScope && block.closest('[data-calculator-instance]'))
    || block.closest(`.${id}-calculator`) || block.closest('.section') || document;
}

export function evaluateCalculator(definition, values) {
  const supplied = { ...definition.assumptions, ...values };
  const errors = definition.fields.filter(({ key, engineRequired }) => engineRequired
    && (supplied[key] === undefined || supplied[key] === null || supplied[key] === ''))
    .map(({ key }) => `${key} is required.`);
  const inputs = definition.mapInputs ? definition.mapInputs(supplied) : supplied;
  if (errors.length) return { inputs, result: null, errors };
  if (!definition.calculate) return { inputs, result: null, errors };
  try {
    const result = definition.calculate(inputs);
    return result.isValid === false
      ? { inputs, result: null, errors: result.errors }
      : { inputs, result, errors: result.validationErrors || errors };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return { inputs, result: null, errors: [error.message] };
  }
}

export default function createCalculatorController(block, definition, providedFields) {
  controllers.get(block)?.destroy();
  instanceCount += 1;
  const instanceId = block.dataset.calculatorId || `${definition.id}-${instanceCount}`;
  block.dataset.calculatorId = instanceId;
  const scope = (definition.scopeSelector && block.closest(definition.scopeSelector))
    || getCalculatorScope(block, definition.id, definition.instanceScope !== false);
  const submitLabel = definition.submitLabel?.(block);
  let fields;
  let active = true;

  function update() {
    if (!active || !fields) return;
    const values = {
      ...Object.fromEntries(fields.filter(({ field }) => field)
        .map(({ key, field }) => [key, field.getValue()])),
      ...(definition.getExternalInputs?.(block) || {}),
    };
    const state = {
      calculatorId: definition.id, instanceId, ...evaluateCalculator(definition, values),
    };
    block.calculatorState = state;
    scope.calculatorStates ||= new Map();
    scope.calculatorStates.set(instanceId, state);
    if (definition.validateFields) definition.validateFields(fields, state);
    if (definition.cachePrefix) {
      scope[`${definition.cachePrefix}PlanInputs`] = state.inputs;
      scope[`${definition.cachePrefix}PlanResult`] = state.result;
    }
    scope.dispatchEvent(new CustomEvent(definition.eventName, {
      detail: definition.legacyDetail ? definition.legacyDetail(state) : state.inputs,
      bubbles: definition.bubbles || false,
    }));
    if (definition.calculate) {
      block.dispatchEvent(new CustomEvent('calculator-update', { detail: state, bubbles: true }));
    }
  }

  fields = definition.fields.map((fieldDefinition) => ({
    ...fieldDefinition,
    field: providedFields ? providedFields[fieldDefinition.key]
      : createCalculatorField(block, fieldDefinition, instanceId, update),
  }));
  if (!providedFields) {
    block.innerHTML = fields.some(({ field }) => field) ? definition.markup : '';
    fields.forEach(({ slot, field }) => {
      const target = block.querySelector(slot);
      if (field && target) target.append(field.element);
      else target?.remove();
    });
    block.querySelectorAll('.age-inputs-row, .two-columns-grid, .term-insurance-preferences')
      .forEach((group) => { if (!group.children.length) group.remove(); });
  }
  if (submitLabel !== undefined) {
    const button = block.querySelector('button[type="submit"]');
    if (button) button.textContent = submitLabel;
  }
  function submit(event) {
    event.preventDefault();
    const inputs = Object.fromEntries(fields.map(({ key, field }) => [key, field?.getValue()]));
    definition.onSubmit(block, inputs, fields);
  }
  if (definition.onSubmit) block.addEventListener('submit', submit);
  const events = ['input', 'change', definition.inputEvent].filter(Boolean);
  events.forEach((eventName) => block.addEventListener(eventName, update));
  const controller = {
    fields,
    update,
    destroy() {
      if (!active) return;
      active = false;
      events.forEach((eventName) => block.removeEventListener(eventName, update));
      if (definition.onSubmit) block.removeEventListener('submit', submit);
      scope.calculatorStates?.delete(instanceId);
      fields.forEach(({ field }) => {
        if (field?.input) Reflect.get(field.input, '_flatpickr')?.destroy();
      });
      controllers.delete(block);
    },
  };
  controllers.set(block, controller);
  update();
  return controller;
}
