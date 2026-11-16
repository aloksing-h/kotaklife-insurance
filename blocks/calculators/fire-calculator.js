import createCalculatorController from './calculator-controller.js';
import { calculatorDefinitions } from './calculator-definitions.js';

export { calculateFirePlan } from './calculator-engine.js';

export default function fireCalculator(block) {
  return createCalculatorController(block, calculatorDefinitions.fire);
}
