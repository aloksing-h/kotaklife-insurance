import createCalculatorController from './calculator-controller.js';
import { calculatorDefinitions } from './calculator-definitions.js';

export default function retirementCalculator(block) {
  return createCalculatorController(block, calculatorDefinitions.retirement);
}
