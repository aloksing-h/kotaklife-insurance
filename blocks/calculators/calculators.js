import { loadForm } from '../form/form.js';
import createCalculatorController from './calculator-controller.js';
import { getCalculatorDefinition } from './calculator-definitions.js';

export default async function decorate(block) {
  const definition = getCalculatorDefinition(block);
  if (!definition) return;
  const form = await loadForm(block);
  if (!form) return;
  createCalculatorController(block, definition);
}
