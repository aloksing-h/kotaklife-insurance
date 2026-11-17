import createCalculatorController from './calculator-controller.js';
import { calculatorDefinitions } from './calculator-definitions.js';

export { calculateCompoundInterest } from './calculator-engine.js';

export default function compoundCalculator(block) {
  return createCalculatorController(block, calculatorDefinitions.compound);
}
