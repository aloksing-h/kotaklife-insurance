import {
  calculateCompoundInterest, calculateFirePlan, calculateFixedDeposit, calculateGratuity,
  calculateHra, calculatePpfPlan,
  calculateSipPlan, calculateSwpPlan, calculateSavingsPlan, calculateHlvPlan, calculateBmi,
  calculateNpsPlan, calculateRecurringDeposit, calculateRetirementPlan, calculateUlipPlan,
} from './calculator-engine.js';
import {
  readConfiguredRange, readConfiguredValues, readAuthoredAttribute, readAuthoredLabel,
  readAuthoredOptions, readAuthoredSelection, readAuthoredValue,
} from './field-adapter.js';
import getTermQuote from '../../scripts/term-quote-api.js';

function readNumericAuthoredValue(block, selectors, fallback) {
  const value = readAuthoredValue(block, selectors, '');
  const number = Number(value);
  return value.trim() && Number.isFinite(number) ? number : fallback;
}

function normalizeInvestmentMode(value) {
  const normalized = String(value).trim().toLowerCase().replace(/[\s_-]+/g, '');
  return {
    regular: 'regular',
    regularinvestment: 'regular',
    onetime: 'one-time',
    onetimeinvestment: 'one-time',
  }[normalized] || '';
}

function dateOfBirthForAge(age) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

function ageAtDateOfBirth(value, today) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return undefined;

  const [, year, month, day] = match.map(Number);
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (birthDate.getUTCFullYear() !== year
    || birthDate.getUTCMonth() !== month - 1
    || birthDate.getUTCDate() !== day) return undefined;

  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month
    || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age;
}

export const calculatorDefinitions = {
  term: {
    id: 'term',
    style: 'term-inurance-text',
    eventName: 'term-plan-update',
    inputEvent: 'term-plan-input-change',
    cachePrefix: 'term',
    bubbles: true,
    scopeSelector: '.term-inurance-text',
    getInputErrors(inputs, today = new Date()) {
      const errors = {};
      const age = ageAtDateOfBirth(inputs.dateOfBirth, today);
      if (!Number.isInteger(age) || age < 18 || age > 65) {
        errors.dateOfBirth = 'Enter a valid date of birth for an age between 18 and 65.';
      }
      const cover = Number(inputs.lifeCover);
      if (!Number.isFinite(cover) || cover <= 0) {
        errors.lifeCover = 'Enter a valid life cover amount.';
      }
      if (!['male', 'female', 'other'].includes(String(inputs.gender || '').toLowerCase())) {
        errors.gender = 'Select a gender.';
      }
      if (typeof inputs.tobaccoUser !== 'boolean') {
        errors.tobaccoUser = 'Select whether you use tobacco.';
      }
      return errors;
    },
    validateInputs(inputs, today = new Date()) {
      const errors = calculatorDefinitions.term.getInputErrors(inputs, today);
      const [message] = Object.values(errors);
      if (message) throw new RangeError(message);
    },
    renderFieldErrors(fields, errors, create = false) {
      fields.forEach(({ key, field }) => {
        if (!field?.element) return;
        const { element } = field;
        let error = element.querySelector('.term-field-error');
        if (!error && create) {
          element.insertAdjacentHTML('beforeend', '<p class="term-field-error" role="alert"></p>');
          error = element.querySelector('.term-field-error');
          const control = element.querySelector('input, [role="slider"]');
          error.id = `${control?.id || key}-error`;
        }
        if (!error) return;
        error.textContent = errors[key] || '';
        error.hidden = !errors[key];
        element.querySelectorAll('input, [role="slider"]').forEach((control) => {
          control.setAttribute('aria-invalid', String(Boolean(errors[key])));
          const describedBy = new Set((control.getAttribute('aria-describedby') || '')
            .split(/\s+/).filter(Boolean));
          if (errors[key]) describedBy.add(error.id);
          else describedBy.delete(error.id);
          if (describedBy.size) control.setAttribute('aria-describedby', [...describedBy].join(' '));
          else control.removeAttribute('aria-describedby');
        });
      });
    },
    validateFields(fields, { inputs }) {
      this.renderFieldErrors(fields, this.getInputErrors(inputs));
    },
    async onSubmit(block, inputs, fields) {
      const errors = this.getInputErrors(inputs);
      this.renderFieldErrors(fields, errors, true);
      if (Object.keys(errors).length) return;

      const scope = block.closest('.term-inurance-text') || block;
      const calculator = scope.matches('.calculators.term-inurance-text')
        ? scope : scope.querySelector('.calculators.term-inurance-text') || block;
      const button = block.querySelector('button[type="submit"]');
      const updateQuote = (detail) => {
        calculator.termQuoteState = detail;
        scope.dispatchEvent(new CustomEvent('term-quote-update', { detail }));
      };

      button.disabled = true;
      updateQuote({ status: 'loading' });
      try {
        const { premium, cover } = await getTermQuote({
          age: ageAtDateOfBirth(inputs.dateOfBirth, new Date()),
          lifeCover: inputs.lifeCover,
          gender: inputs.gender,
          tobaccoUser: inputs.tobaccoUser,
        });
        const currency = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
        updateQuote({
          status: 'success',
          quote: {
            premium: `₹${currency.format(premium)}`,
            frequency: 'Annually for',
            coverDescription: `₹${currency.format(cover)} cover`,
          },
        });
      } catch (error) {
        updateQuote({
          status: 'error',
          error: error instanceof Error
            ? error.message : 'Unable to calculate your premium. Please try again.',
        });
      } finally {
        button.disabled = false;
      }
    },
    fields: [
      {
        key: 'dateOfBirth',
        control: 'input',
        slot: '#termDateOfBirthSlot',
        selector: ['.dob-input-field', '.dob-input'],
        options(block) {
          const selectors = ['.dob-input-field', '.dob-input'];
          return {
            type: 'date',
            min: dateOfBirthForAge(65),
            max: dateOfBirthForAge(18),
            placeholder: readAuthoredAttribute(block, selectors, 'placeholder')
              .replaceAll('-', '/') || 'dd/mm/yyyy',
            datePickerOptions: { altFormat: 'd/m/Y' },
            syncTypedDate: true,
            value: readAuthoredValue(block, selectors, ''),
            required: true,
          };
        },
      },
      {
        key: 'lifeCover',
        control: 'amount',
        valueType: 'number',
        slot: '#termLifeCoverSlot',
        selector: ['.life-cover-input-field', '.life-cover-input'],
        rangeSelector: ['.life-cover-range-field', '.life-cover-range'],
        authoredRange: true,
        milestoneSelector: ['.life-cover-milestone-field', '.life-cover-milestone'],
        options: {
          editable: true,
          required: true,
        },
        initialValue(block) {
          const selectors = ['.life-cover-input-field', '.life-cover-input'];
          return readNumericAuthoredValue(block, selectors, undefined);
        },
        useAuthoredValue: true,
      },
      {
        key: 'gender',
        control: 'gender',
        slot: '#termGenderSlot',
        selector: ['.radio-input-field', '.radio-input'],
        label: ['Gender'],
        options(block) {
          const selectors = ['.radio-input-field', '.radio-input'];
          return {
            value: readAuthoredSelection(block, selectors, '', 'Gender').toLowerCase(),
            required: true,
            optionsList: readAuthoredOptions(block, selectors, [], 'Gender'),
          };
        },
      },
      {
        key: 'tobaccoUser',
        control: 'tobacco',
        slot: '#termTobaccoSlot',
        selector: ['.checkbox-input-field', '.checkbox-input', '.checkbox-field'],
        label: ['Tobacco user'],
        options(block) {
          const selectors = ['.checkbox-input-field', '.checkbox-input', '.checkbox-field'];
          const authoredOptions = readAuthoredOptions(block, selectors, [], 'Tobacco user');
          const optionsList = authoredOptions.slice(0, 2).map(({ label }, index) => ({
            label,
            value: index === 1,
          }));
          const selected = readAuthoredSelection(block, selectors, '', 'Tobacco user').toLowerCase();
          const selectedIndex = authoredOptions.findIndex(({ value }) => value === selected);
          return {
            value: selectedIndex === 1,
            required: true,
            optionsList,
          };
        },
      },
    ],
    submitLabel: (block) => readAuthoredLabel(block, ['.calculate-term-field', '.calculate-term']),
    markup: `<div class="term-insurance-calculator">
      <form class="term-insurance-form" novalidate>
        <div class="term-insurance-fields">
          <div class="term-input-slot" id="termDateOfBirthSlot"></div>
          <div class="term-insurance-cover slider-box" id="termLifeCoverSlot"></div>
          <div class="term-insurance-preferences">
            <div class="term-preference-slot" id="termGenderSlot"></div>
            <div class="term-preference-slot" id="termTobaccoSlot"></div>
          </div>
        </div>
        <button class="term-calculate-button" type="submit"></button>
      </form>
    </div>`,
  },
  bmi: {
    id: 'bmi',
    style: 'bmi-text',
    eventName: 'bmi-plan-update',
    cachePrefix: 'bmi',
    calculate: calculateBmi,
    legacyDetail: ({ inputs, result, errors }) => ({ inputs, result, errors }),
    validateFields(fields, state) {
      const errors = [];
      fields.forEach(({ key, field }) => {
        if (!field?.input) return;
        const { input, element } = field;
        input.step = key === 'feet' ? '1' : 'any';
        const value = state.inputs[key];
        const invalid = !Number.isFinite(value)
          || value < Number(input.min) || value > Number(input.max)
          || (key === 'feet' && !Number.isInteger(value));
        const name = { weight: 'Weight', feet: 'Height', inches: 'Inches' }[key];
        const message = invalid
          ? `${name} must be ${key === 'feet' ? 'a whole number ' : ''}`
            + `between ${input.min} and ${input.max}.`
          : '';
        let error = element.querySelector('.bmi-field-error');
        if (!error) {
          element.insertAdjacentHTML(
            'beforeend',
            `<p class="bmi-field-error" id="${input.id}-error" role="alert" hidden></p>`,
          );
          error = element.querySelector('.bmi-field-error');
        }
        error.textContent = message;
        error.hidden = !invalid;
        input.setCustomValidity(message);
        input.setAttribute('aria-invalid', String(invalid));
        if (invalid) {
          input.setAttribute('aria-describedby', error.id);
          errors.push(message);
        } else {
          input.removeAttribute('aria-describedby');
        }
      });
      if (errors.length) {
        state.result = null;
        state.errors = errors;
      }
    },
    fields: [
      {
        key: 'weight',
        control: 'input',
        valueType: 'number',
        selector: '.weight',
        label: 'Weight (KG)',
        slot: '#bmiWeightSlot',
        rangeSelector: '.weight-range',
        rangeLabel: 'weight range',
        range: [10, 200],
        bounds: [10, 200],
        options: (block) => ({
          type: 'number',
          value: readAuthoredValue(block, '.weight', ''),
          required: true,
          limitDigitsToMax: true,
        }),
      },
      {
        key: 'feet',
        control: 'input',
        valueType: 'number',
        selector: '.height',
        label: 'Height in feet:',
        slot: '#bmiFeetSlot',
        rangeSelector: ['.height-range', '.height-ange'],
        rangeLabel: 'Height in feet range',
        range: [2, 8],
        bounds: [2, 8],
        options: (block) => ({
          type: 'number',
          value: readAuthoredValue(block, '.height', ''),
          required: true,
          limitDigitsToMax: true,
        }),
      },
      {
        key: 'inches',
        control: 'input',
        valueType: 'number',
        selector: '.inches',
        label: 'Inches:',
        slot: '#bmiInchesSlot',
        rangeSelector: '.inches-range',
        rangeLabel: 'Inches range',
        range: [0, 12],
        bounds: [0, 12],
        options: (block) => ({
          type: 'number',
          value: readAuthoredValue(block, '.inches', ''),
          required: true,
          limitDigitsToMax: true,
        }),
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="bmi-fields">
            <div class="field-group" id="bmiWeightSlot"></div>
            <div class="field-group" id="bmiFeetSlot"></div>
            <div class="field-group" id="bmiInchesSlot"></div>
          </div>
        </div>
      </div>
    </div>`,
  },
  savings: {
    id: 'savings',
    style: 'savings-text',
    eventName: 'savings-plan-update',
    inputEvent: 'savings-plan-input-change',
    cachePrefix: 'savings',
    calculate: calculateSavingsPlan,
    legacyDetail: ({ inputs, result, errors }) => ({ ...inputs, result, errors }),
    fields: [
      {
        key: 'goalAmount',
        control: 'amount',
        valueType: 'number',
        selector: '.amount-wish-to-save',
        label: 'Amount you wish to save',
        slot: '#savingsGoalSlot',
        rangeSelector: '.amount-wish-to-save-range',
        rangeLabel: 'Amount you wish to save range',
        range: [10000, 10000000],
        milestoneSelector: '.amount-wish-to-save-milestone',
        milestoneLabel: 'Amount you wish to save milestone',
        milestones: [10000, 3000000, 5000000, 7000000, 10000000],
        options: {
          value: 10000, step: 5000, editable: true, required: true,
        },
      },
      {
        key: 'existingSavings',
        control: 'amount',
        valueType: 'number',
        selector: '.existing-savings',
        label: 'Existing savings',
        slot: '#savingsExistingSlot',
        rangeSelector: '.existing-savings-range',
        rangeLabel: 'Existing savings range',
        range: [0, 10000000],
        milestoneSelector: '.existing-savings-milestone',
        milestoneLabel: 'Existing savings milestones',
        milestones: [0, 3000000, 5000000, 7000000, 10000000],
        options: { value: 0, step: 5000, editable: true },
      },
      {
        key: 'investmentYears',
        control: 'rate',
        valueType: 'number',
        selector: '.investment-duration',
        label: 'Investment duration',
        slot: '#savingsDurationSlot',
        rangeSelector: '.investment-duration-range',
        rangeLabel: 'Investment duration range',
        range: [1, 50],
        milestoneSelector: ['.investment-duration-milestones', '.investment-duration-milestone'],
        milestoneLabel: 'Investment duration milestones',
        milestones: [1, 50],
        formatMilestone: (value) => `${value} Year`,
        options: {
          value: 1, step: 1, suffix: ' Years', required: true,
        },
      },
      {
        key: 'rate',
        control: 'rate',
        valueType: 'number',
        selector: [],
        label: ['Expected annual interest', 'Expected Annual Interest Rate(%)'],
        slot: '#savingsRateSlot',
        rangeSelector: '.expected-annual-interest-range',
        rangeLabel: 'Expected annual interest range',
        range: [1, 30],
        milestoneSelector: '.expected-annual-interest-milestones',
        milestoneLabel: 'Expected annual interest milestones',
        milestones: [1, 30],
        formatMilestone: (value) => `${value}%`,
        options: {
          value: 1, step: 1, suffix: '%', required: true,
        },
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="slider-box" id="savingsGoalSlot"></div>
          <div class="slider-box" id="savingsExistingSlot"></div>
          <div class="two-columns-grid">
            <div class="slider-box" id="savingsDurationSlot"></div>
            <div class="slider-box" id="savingsRateSlot"></div>
          </div>
        </div>
      </div>
    </div>`,
  },
  hlv: {
    id: 'hlv',
    style: 'hlv-text',
    eventName: 'hlv-plan-update',
    inputEvent: 'hlv-plan-input-change',
    cachePrefix: 'hlv',
    calculate: calculateHlvPlan,
    legacyDetail: ({ inputs, result, errors }) => ({ ...inputs, result, errors }),
    validateFields(fields, { inputs }) {
      const retirementField = fields.find(({ key }) => key === 'retirementAge')?.field;
      const input = retirementField?.input;
      const invalid = Number.isInteger(inputs.currentAge)
        && Number.isInteger(inputs.retirementAge)
        && inputs.currentAge >= inputs.retirementAge;
      const message = 'Retirement age must be greater than current age.';
      let error = retirementField?.element.querySelector('.age-field-error');
      if (retirementField?.element && input && !error) {
        retirementField.element.insertAdjacentHTML(
          'beforeend',
          `<p class="age-field-error" id="${input.id}-error" role="alert" hidden></p>`,
        );
        error = retirementField.element.querySelector('.age-field-error');
      }
      if (error) {
        error.textContent = invalid ? message : '';
        error.hidden = !invalid;
        if (invalid) input?.setAttribute('aria-describedby', error.id);
        else input?.removeAttribute('aria-describedby');
      }
      input?.setCustomValidity(invalid ? message : '');
      input?.setAttribute('aria-invalid', String(invalid));
    },
    fields: [
      {
        key: 'currentAge',
        control: 'age',
        valueType: 'number',
        engineRequired: true,
        selector: ['.current-age-field', '.current-age'],
        label: ['Current Age'],
        slot: '#hlvCurrentAgeSlot',
        rangeSelector: ['.current-age-range-field', '.current-age-range'],
        rangeLabel: ['Current Age Range'],
        range: [18, 75],
        options: { value: 35, required: true },
      },
      {
        key: 'retirementAge',
        control: 'age',
        valueType: 'number',
        engineRequired: true,
        selector: ['.retirement-age-field', '.retirement-age'],
        label: ['Retirement Age'],
        slot: '#hlvRetirementAgeSlot',
        rangeSelector: ['.retirement-age-range-field', '.retirement-age-range'],
        rangeLabel: ['Retirement Age Range'],
        range: [45, 85],
        options: { value: 50, required: true },
      },
      {
        key: 'yearlyIncome',
        control: 'amount',
        valueType: 'number',
        engineRequired: true,
        selector: ['.yearly-income-field', '.yearly-income'],
        label: ['Your Yearly Income (₹)'],
        slot: '#hlvYearlyIncomeSlot',
        rangeSelector: ['.yearly-income-range-field', '.yearly-income-range'],
        rangeLabel: ['Your Yearly Income (₹) range'],
        range: [50000, 10000000],
        milestoneSelector: [
          '.yearly-income-milestones-field', '.yearly-income-milestones',
          '.yearly-income-milestone',
        ],
        milestoneLabel: [
          'Your Yearly Income (₹) milestones', 'Your Yearly Income (₹) milestone',
          'Basic Salary (₹) milestones',
        ],
        milestones: [50000, 3000000, 5000000, 7000000, 10000000],
        options: {
          value: 1000000, step: 10000, editable: true, required: true,
        },
      },
      {
        key: 'currentLoans',
        control: 'amount',
        valueType: 'number',
        selector: ['.current-loans-field', '.current-loans'],
        label: ['Your Current Loans or Debts (₹)'],
        slot: '#hlvCurrentLoansSlot',
        rangeSelector: ['.current-loans-range-field', '.current-loans-range'],
        rangeLabel: ['Your Current Loans or Debts (₹) range'],
        range: [10000, 1000000],
        milestoneSelector: [
          '.current-loans-milestones-field', '.current-loans-milestones',
          '.current-loans-milestone',
        ],
        milestoneLabel: [
          'Your Current Loans or Debts (₹) milestones',
          'Your Current Loans or Debts (₹) milestone',
        ],
        milestones: [10000, 300000, 500000, 700000, 1000000],
        options: { value: 10000, step: 10000, editable: true },
      },
      {
        key: 'existingSavings',
        control: 'amount',
        valueType: 'number',
        selector: ['.existing-savings-field', '.existing-savings'],
        label: ['Existing Savings or Investments (₹)'],
        slot: '#hlvExistingSavingsSlot',
        rangeSelector: ['.existing-savings-range-field', '.existing-savings-range'],
        rangeLabel: ['Existing Savings or Investments (₹) range'],
        range: [0, 50000000],
        milestoneSelector: [
          '.existing-savings-milestones-field', '.existing-savings-milestones',
          '.existing-savings-milestone',
        ],
        milestoneLabel: [
          'Existing Savings or Investments (₹) milestones',
          'Existing Savings or Investments (₹) milestone',
        ],
        milestones: [0, 10000000, 20000000, 30000000, 40000000, 50000000],
        options: { value: 0, step: 100000, editable: true },
      },
      {
        key: 'existingLifeCover',
        control: 'amount',
        valueType: 'number',
        selector: ['.existing-life-cover-field', '.existing-life-cover'],
        label: ['Existing Life Cover (₹)'],
        slot: '#hlvExistingLifeCoverSlot',
        rangeSelector: ['.existing-life-cover-range-field', '.existing-life-cover-range'],
        rangeLabel: ['Existing Life Cover (₹) range'],
        range: [0, 50000000],
        milestoneSelector: [
          '.existing-life-cover-milestones-field', '.existing-life-cover-milestones',
          '.existing-life-cover-milestone',
        ],
        milestoneLabel: [
          'Existing Life Cover (₹) milestones', 'Existing Life Cover (₹) milestone',
        ],
        milestones: [0, 10000000, 20000000, 30000000, 40000000, 50000000],
        options: { value: 0, step: 100000, editable: true },
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="age-inputs-row">
            <div class="field-group" id="hlvCurrentAgeSlot"></div>
            <div class="field-group" id="hlvRetirementAgeSlot"></div>
          </div>
          <div class="slider-box" id="hlvYearlyIncomeSlot"></div>
          <div class="slider-box" id="hlvCurrentLoansSlot"></div>
          <div class="slider-box" id="hlvExistingSavingsSlot"></div>
          <div class="slider-box" id="hlvExistingLifeCoverSlot"></div>
        </div>
      </div>
    </div>`,
  },
  retirement: {
    id: 'retirement',
    style: 'retirement-text',
    eventName: 'retirement-plan-update',
    inputEvent: 'retirement-plan-input-change',
    cachePrefix: 'retirement',
    calculate: calculateRetirementPlan,
    legacyDetail: ({ inputs, result, errors }) => ({ ...inputs, result, errors }),
    validateFields(fields) {
      const retireInput = fields.find(({ key }) => key === 'retirementAge')?.field?.input;
      const lifeInput = fields.find(({ key }) => key === 'lifeExpectancy')?.field?.input;
      retireInput?.setCustomValidity('');
      retireInput?.setAttribute('aria-invalid', 'false');
      lifeInput?.setCustomValidity('');
      lifeInput?.setAttribute('aria-invalid', 'false');
    },
    fields: [
      {
        key: 'currentAge',
        control: 'age',
        valueType: 'number',
        engineRequired: true,
        selector: '.current-age-field',
        slot: '#currentAgeFieldSlot',
        rangeSelector: '.current-age-range-field',
        range: [18, 70],
        options: { value: 30, required: true },
      },
      {
        key: 'retirementAge',
        control: 'age',
        valueType: 'number',
        engineRequired: true,
        selector: '.retirement-age-field',
        slot: '#retirementagefieldslot',
        rangeSelector: '.desired-retirement-age-range-field',
        range: [25, 80],
        options: { value: 60, required: true },
      },
      {
        key: 'lifeExpectancy',
        control: 'age',
        valueType: 'number',
        engineRequired: true,
        selector: '.life-expected-field',
        slot: '#ageexpectancy',
        rangeSelector: '.life-expectation-range-field',
        range: [60, 100],
        options: { value: 80, required: true },
      },
      {
        key: 'monthlyExpense',
        control: 'amount',
        valueType: 'number',
        engineRequired: true,
        selector: '.monthly-expense-field',
        slot: '#waveslider',
        rangeSelector: '.current-monthly-expense-range-field',
        range: [5000, 500000],
        milestoneSelector: '.monthly-expense-milestone-field',
        options: {
          value: 40000,
          step: 5000,
          editable: true,
          required: true,
          infoText: '',
        },
      },
      {
        key: 'inflationRate',
        control: 'rate',
        valueType: 'number',
        selector: '.inflation-rate-field',
        slot: '#expected-inflation',
        rangeSelector: '.expected-inflation-range-field',
        range: [1, 20],
        milestoneSelector: '.expected-inflation-milestone-field',
        formatMilestone: (value) => `${value}%`,
        options: { value: 5, suffix: '%', step: 1 },
      },
      {
        key: 'expectedReturn',
        control: 'rate',
        valueType: 'number',
        selector: '.expected-return-field',
        slot: '#expected-return',
        rangeSelector: '.expected-return-range-field',
        range: [1, 20],
        milestoneSelector: '.expected-return-millstone-field',
        formatMilestone: (value) => `${value}%`,
        options: {
          value: 5, suffix: '%', step: 1, infoText: '',
        },
      },
      {
        key: 'retirementExpenseRatio',
        control: 'ratio',
        valueType: 'number',
        engineRequired: true,
        selector: '.expected-expense-field',
        slot: '#retirement-ration',
        rangeSelector: '.expected-expense-range-field',
        range: [1, 100],
        milestoneSelector: '.retirement-expense-milestone-field',
        formatMilestone: (value) => `${value}%`,
        options: { value: 75, step: 1 },
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="age-inputs-row">
            <div class="field-group" id="currentAgeFieldSlot"></div>
            <div class="field-group" id="retirementagefieldslot"></div>
            <div class="field-group" id="ageexpectancy"></div>
          </div>
          <div class="slider-box" id="waveslider"></div>
          <div class="two-columns-grid">
            <div class="slider-box" id="expected-inflation"></div>
            <div class="slider-box" id="expected-return"></div>
          </div>
          <div class="slider-box" id="retirement-ration"></div>
        </div>
      </div>
    </div>`,
  },
  fire: {
    id: 'fire',
    style: 'fire-text',
    eventName: 'fire-plan-update',
    inputEvent: 'fire-plan-input-change',
    cachePrefix: 'fire',
    instanceScope: false,
    calculate: calculateFirePlan,
    bubbles: true,
    legacyDetail: ({ inputs, result, errors }) => ({
      ...inputs, result: result || { isValid: false, errors },
    }),
    validateFields(fields, { inputs }) {
      const retirementAgeField = fields.find(({ key }) => key === 'retireAge')?.field;
      const input = retirementAgeField?.input;
      const invalid = inputs.retireAge <= inputs.currentAge;
      const message = 'Retirement age must exceed current age.';
      let error = retirementAgeField?.element.querySelector('.age-field-error');
      if (retirementAgeField?.element && input && !error) {
        error = document.createElement('p');
        error.className = 'age-field-error';
        error.id = `${input.id}-error`;
        error.setAttribute('role', 'alert');
        error.hidden = true;
        retirementAgeField.element.append(error);
      }
      if (error) {
        error.textContent = invalid ? message : '';
        error.hidden = !invalid;
        if (invalid) input?.setAttribute('aria-describedby', error.id);
        else input?.removeAttribute('aria-describedby');
      }
      input?.setCustomValidity(invalid ? message : '');
      input?.setAttribute('aria-invalid', String(invalid));
    },
    fields: [
      {
        key: 'currentAge',
        control: 'age',
        valueType: 'number',
        engineRequired: true,
        selector: '.current-age-field',
        slot: '#currentAgeFieldSlot',
        rangeSelector: '.current-age-range-field',
        range: [18, 70],
        options: { value: 30, required: true },
      },
      {
        key: 'retireAge',
        control: 'age',
        valueType: 'number',
        engineRequired: true,
        selector: '.retirement-age-field',
        slot: '#retirementagefieldslot',
        rangeSelector: '.retirement-age-range-field',
        range: [25, 80],
        options: { value: 60, required: true },
        initialValue(block) {
          const range = readConfiguredRange(block, '.current-age-range-field', [18, 70]);
          return Math.max(60, Math.max(range[0], Math.min(range[1], 30)) + 1);
        },
      },
      {
        key: 'monthlyExpense',
        control: 'amount',
        valueType: 'number',
        engineRequired: true,
        selector: '.monthly-expense-field',
        slot: '#waveslider',
        rangeSelector: '.monthly-expense-range-field',
        range: [5000, 500000],
        milestoneSelector: '.monthly-expense-milestone-field',
        milestones: [5000, 100000, 200000, 300000, 400000, 500000],
        options: {
          value: 40000,
          step: 5000,
          required: true,
          editable: true,
          infoText: '',
        },
      },
      {
        key: 'inflationrate',
        control: 'ratio',
        valueType: 'number',
        engineRequired: true,
        selector: '.inflation-rate-field',
        slot: '#retirement-ration',
        rangeSelector: '.inflation-range-field',
        range: [1, 20],
        milestoneSelector: '.inflation-milestone-field',
        formatMilestone: (value) => `${value}%`,
        options: { value: 5, step: 1 },
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="age-inputs-row">
            <div class="field-group" id="currentAgeFieldSlot"></div>
            <div class="field-group" id="retirementagefieldslot"></div>
          </div>
          <div class="slider-box" id="waveslider"></div>
          <div class="slider-box" id="retirement-ration"></div>
        </div>
      </div>
    </div>`,
  },
  gratuity: {
    id: 'gratuity',
    style: 'gratuity-text',
    eventName: 'gratuity-plan-update',
    inputEvent: 'gratuity-plan-input-change',
    cachePrefix: 'gratuity',
    instanceScope: false,
    calculate: calculateGratuity,
    bubbles: true,
    legacyDetail: ({ inputs, result, errors }) => ({
      ...inputs, result: result || { isValid: false, errors },
    }),
    fields: [
      {
        key: 'monthlySalary',
        control: 'amount',
        valueType: 'number',
        engineRequired: true,
        selector: ['.monthly-salary-field', '.monthly-salary'],
        slot: '#gratuitySalarySlot',
        rangeSelector: ['.monthly-salary-range-field', '.monthly-salary-range'],
        range: [10000, 10000000],
        milestoneSelector: ['.monthly-salary-milestones-field', '.monthly-salary-milestones'],
        milestones: [10000, 3000000, 5000000, 7000000, 10000000],
        options: {
          value: 10000,
          step: 10000,
          required: true,
          editable: true,
        },
      },
      {
        key: 'yearsOfService',
        control: 'rate',
        valueType: 'number',
        engineRequired: true,
        selector: ['.years-of-service-field', '.years-of-service'],
        slot: '#gratuityYearsSlot',
        rangeSelector: ['.years-of-service-range-field', '.years-of-service-range'],
        range: [5, 30],
        milestoneSelector: [
          '.years-of-service-milestones-field',
          '.years-of-service-milestones',
        ],
        milestones: [5, 30],
        formatMilestone: (value) => `${value} years`,
        options: {
          value: 5,
          suffix: ' years',
          step: 1,
          required: true,
        },
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="slider-box" id="gratuitySalarySlot"></div>
          <div class="slider-box" id="gratuityYearsSlot"></div>
        </div>
      </div>
    </div>`,
  },
  hra: {
    id: 'hra',
    style: 'hra-text',
    eventName: 'hra-plan-update',
    inputEvent: 'hra-plan-input-change',
    cachePrefix: 'hra',
    calculate: calculateHra,
    getExternalInputs: (block) => ({
      isMetroCity: block.closest('.hra-calculator')?.hraMetroCityField?.getValue(),
    }),
    legacyDetail: ({ inputs, result, errors }) => ({ ...inputs, result, errors }),
    fields: [
      {
        key: 'basicSalary',
        control: 'amount',
        valueType: 'number',
        tooltipLabel: 'Basic Salary (p.a.) tooltip',
        tooltipSelector: '.basic-salary-tooltip-field',
        engineRequired: true,
        selector: ['.basic-salary-field', '.basic-salary'],
        slot: '#hraBasicSalarySlot',
        rangeSelector: ['.basic-salary-range-field', '.basic-salary-range'],
        range: [10000, 10000000],
        milestoneSelector: [
          '.basic-salary-milestones-field',
          '.basic-salary-milestones',
          '.basic-salary-milestone',
        ],
        milestones: [10000, 3000000, 5000000, 7000000, 10000000],
        options: {
          value: 10000,
          step: 5000,
          required: true,
          editable: true,
        },
      },
      {
        key: 'dearnessAllowance',
        control: 'amount',
        valueType: 'number',
        tooltipLabel: 'Dearness allowances tooltip',
        tooltipSelector: '.dearness-allowances-tooltip-field',
        engineRequired: true,
        selector: ['.dearness-allowance-field', '.dearness-allowance'],
        slot: '#hraDearnessAllowanceSlot',
        rangeSelector: [
          '.dearness-allowance-range-field',
          '.dearness-allowance-range',
        ],
        range: [0, 10000000],
        milestoneSelector: [
          '.dearness-allowance-milestones-field',
          '.dearness-allowance-milestones',
          '.dearness-allowance-milestone',
        ],
        milestones: [0, 3000000, 5000000, 7000000, 10000000],
        options: {
          value: 0,
          step: 5000,
          required: true,
          editable: true,
        },
      },
      {
        key: 'hraReceived',
        control: 'amount',
        valueType: 'number',
        tooltipLabel: 'Hra received tooltip',
        tooltipSelector: '.hra-recieved-tooltip-field',
        engineRequired: true,
        selector: ['.hra-received-field', '.hra-received'],
        slot: '#hraReceivedSlot',
        rangeSelector: ['.hra-received-range-field', '.hra-received-range'],
        range: [0, 10000000],
        milestoneSelector: [
          '.hra-received-milestones-field',
          '.hra-received-milestones',
          '.hra-received-milestone',
        ],
        milestones: [0, 3000000, 5000000, 7000000, 10000000],
        options: {
          value: 0,
          step: 5000,
          required: true,
          editable: true,
        },
      },
      {
        key: 'totalRentPaid',
        control: 'amount',
        valueType: 'number',
        engineRequired: true,
        selector: ['.total-rent-field', '.total-rent'],
        slot: '#hraTotalRentSlot',
        rangeSelector: ['.total-rent-range-field', '.total-rent-range'],
        range: [0, 10000000],
        milestoneSelector: [
          '.total-rent-milestones-field',
          '.total-rent-milestones',
          '.total-rent-milestone',
        ],
        milestones: [0, 3000000, 5000000, 7000000, 10000000],
        options: {
          value: 0,
          step: 5000,
          required: true,
          editable: true,
        },
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="slider-box" id="hraBasicSalarySlot"></div>
          <div class="slider-box" id="hraDearnessAllowanceSlot"></div>
          <div class="slider-box" id="hraReceivedSlot"></div>
          <div class="slider-box" id="hraTotalRentSlot"></div>
        </div>
      </div>
    </div>`,
  },
  compound: {
    id: 'compound',
    style: 'compound-graph',
    eventName: 'compound-plan-update',
    inputEvent: 'compound-plan-input-change',
    cachePrefix: 'compound',
    instanceScope: false,
    calculate: calculateCompoundInterest,
    mapInputs: (values) => ({
      ...values,
      frequency: {
        monthly: 12,
        yearly: 1,
        annual: 1,
        annually: 1,
        1: 1,
        2: 2,
        4: 4,
        12: 12,
        30: 12,
        90: 4,
        180: 2,
        365: 1,
      }[String(values.frequency).trim().toLowerCase()] ?? NaN,
    }),
    legacyDetail: ({ inputs, result, errors }) => ({
      ...inputs,
      ...(result || { finalAmount: 0, yearlyData: [] }),
      errors,
    }),
    validateFields(fields, { inputs }) {
      const investmentYearsField = fields.find(({ key }) => key === 'investmentYears')?.field;
      const input = investmentYearsField?.input;
      const yearColumns = investmentYearsField?.element.closest('.two-columns-grid');
      const invalid = Number.isFinite(inputs.investmentYears)
        && Number.isFinite(inputs.holdingYears)
        && inputs.investmentYears > inputs.holdingYears;
      const message = 'Years you want to invest cannot be greater than the years you stay invested.';
      let error = yearColumns?.parentElement.querySelector('.investment-years-error');
      if (investmentYearsField?.element && input && !error) {
        error = document.createElement('p');
        error.className = 'investment-years-error';
        error.id = `${input.id}-error`;
        error.setAttribute('role', 'alert');
        error.hidden = true;
      }
      if (error) {
        yearColumns?.after(error);
        error.textContent = invalid ? message : '';
        error.hidden = !invalid;
        if (invalid) input?.setAttribute('aria-describedby', error.id);
        else input?.removeAttribute('aria-describedby');
      }
      input?.setCustomValidity(invalid ? message : '');
      input?.setAttribute('aria-invalid', String(invalid));
    },
    fields: [
      {
        key: 'frequency',
        control: 'frequency',
        selector: '.frequency-field',
        label: 'Frequency',
        slot: '#frequency',
        engineRequired: true,
        options(block) {
          const labels = { 30: 'Monthly', 365: 'Yearly' };
          const optionsList = readConfiguredValues(block, '.frequency-field', [], 'Frequency')
            .map((value) => {
              const optionValue = String(value);
              return { label: labels[optionValue] || optionValue, value: optionValue };
            });
          return {
            value: optionsList[0]?.value || '',
            optionsList,
            required: true,
          };
        },
      },
      {
        key: 'investmentAmount',
        control: 'amount',
        valueType: 'number',
        selector: '.invest-amount-field',
        slot: '#amountInvestedSlider',
        engineRequired: true,
        rangeSelector: '.invest-amount-range-field',
        range: [5000, 1000000],
        milestoneSelector: '.invest-amount-milestone-field',
        milestones: [5000, 200000, 400000, 600000, 800000, 1000000],
        options: {
          value: 50000,
          step: 5000,
          editable: true,
          infoText: '',
        },
      },
      {
        key: 'investmentYears',
        control: 'rate',
        valueType: 'number',
        selector: '.number-of-years-field',
        slot: '#number-of-years',
        engineRequired: true,
        rangeSelector: '.want-to-invest-range-field',
        range: [1, 30],
        milestoneSelector: '.want-to-invest-milestone-field',
        formatMilestone: (value) => `${value} Year`,
        options: { value: 5, step: 1, suffix: ' Year' },
      },
      {
        key: 'holdingYears',
        control: 'rate',
        valueType: 'number',
        selector: '.number-of-year-invested-for-field',
        slot: '#number-of-years-invested-for',
        engineRequired: true,
        rangeSelector: '.stay-invested-years-range-field',
        range: [1, 50],
        milestoneSelector: '.stay-invested-years-milestone-field',
        formatMilestone: (value) => `${value} Year`,
        options: { value: 5, step: 1, suffix: ' Year' },
      },
      {
        key: 'rate',
        control: 'ratio',
        valueType: 'number',
        selector: '.expected-interest-field',
        slot: '#interest-rate',
        engineRequired: true,
        rangeSelector: '.expected-interest-range-field',
        range: [1, 30],
        milestoneSelector: '.expected-interest-range-field',
        formatMilestone: (value) => `${value}%`,
        options: { value: 15, step: 1 },
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="age-inputs-row"><div class="field-group" id="frequency"></div></div>
          <div class="slider-box" id="amountInvestedSlider"></div>
          <div class="two-columns-grid">
            <div class="slider-box" id="number-of-years"></div>
            <div class="slider-box" id="number-of-years-invested-for"></div>
          </div>
          <div class="slider-box" id="interest-rate"></div>
        </div>
      </div>
    </div>`,
  },
  ulip: {
    id: 'ulip',
    style: 'ulip-graph',
    eventName: 'ulip-plan-update',
    inputEvent: 'ulip-plan-input-change',
    cachePrefix: 'ulip',
    instanceScope: false,
    calculate: calculateUlipPlan,
    mapInputs: (values) => ({
      ...values,
      frequency: values.investmentMode === 'one-time' ? '' : 'monthly',
    }),
    bubbles: true,
    legacyDetail: ({ inputs, result }) => ({
      ...inputs,
      ...result,
    }),
    fields: [
      {
        key: 'investmentMode',
        control: 'frequency',
        selector: ['.investment-mode', '.investment-mode-field'],
        label: 'Investment type',
        slot: '#ulipInvestmentModeSlot',
        engineRequired: true,
        options(block) {
          const defaults = [
            { label: 'Regular Investment', value: 'regular' },
            { label: 'One-Time Investment', value: 'one-time' },
          ];
          const selectors = ['.investment-mode', '.investment-mode-field'];
          const rawValue = readAuthoredValue(block, selectors, '');
          const configured = readAuthoredOptions(block, selectors, []);
          const authored = configured.length ? configured : rawValue.split(',')
            .map((label) => label.trim()).filter(Boolean)
            .map((label) => ({ label, value: label }));
          const optionsList = defaults.map((option) => {
            const entry = authored.find((candidate) => (
              normalizeInvestmentMode(candidate.value) === option.value
              || normalizeInvestmentMode(candidate.label) === option.value
            ));
            return { ...option, label: entry?.label || option.label };
          });
          const value = normalizeInvestmentMode(rawValue.split(',')[0]);
          return {
            value: optionsList.some((option) => option.value === value) ? value : 'regular',
            optionsList,
            required: true,
          };
        },
      },
      {
        key: 'investmentAmount',
        control: 'amount',
        valueType: 'number',
        selector: ['.invest-amount', '.invest-amount-field'],
        label: 'Investment amount',
        slot: '#ulipInvestmentAmountSlot',
        engineRequired: true,
        range: [1000, 10000000],
        rangeSelector: '.invest-amount-range',
        rangeLabel: 'Invest amount range',
        milestoneSelector: '.invest-amount-milestone',
        milestoneLabel: 'Invest amount milestone',
        milestones: [1000, 2000000, 4000000, 6000000, 8000000, 10000000],
        options: (block) => ({
          value: readNumericAuthoredValue(block, ['.invest-amount', '.invest-amount-field'], 50000),
          step: 5000,
          editable: true,
          required: true,
        }),
      },
      {
        key: 'investmentYears',
        control: 'rate',
        valueType: 'number',
        selector: ['.number-of-years', '.investment-tenure'],
        label: 'Investment Tenure',
        slot: '#ulipInvestmentTenureSlot',
        engineRequired: true,
        range: [1, 30],
        rangeSelector: '.investment-tenure-range',
        rangeLabel: 'Investment tenure range',
        milestoneSelector: '.investment-tenure-milestone',
        milestoneLabel: 'Investment tenure milestones',
        milestones: [1, 30],
        formatMilestone: (value) => `${value} Year`,
        options: (block) => ({
          value: readNumericAuthoredValue(block, ['.number-of-years', '.investment-tenure'], 10),
          step: 1,
          suffix: ' Year',
          required: true,
        }),
      },
      {
        key: 'rate',
        control: 'rate',
        valueType: 'number',
        selector: ['.expected-return', '.expected-rate-of-return'],
        label: 'Expected rate of return(in %)',
        slot: '#ulipExpectedReturnSlot',
        engineRequired: true,
        range: [1, 15],
        rangeSelector: '.expected-return-range',
        rangeLabel: 'Expected rate of return(in %) range',
        milestoneSelector: '.expected-return-milestone',
        milestoneLabel: 'Expected rate of return(in %) milestone',
        milestones: [1, 15],
        formatMilestone: (value) => `${value}%`,
        options: (block) => ({
          value: readNumericAuthoredValue(block, ['.expected-return', '.expected-rate-of-return'], 9),
          step: 1,
          suffix: '%',
          required: true,
        }),
      },
      {
        key: 'periodicInvestment',
        control: 'amount',
        valueType: 'number',
        selector: '.periodic-investment',
        label: 'Periodic investment (Optional)',
        slot: '#ulipPeriodicInvestmentSlot',
        range: [0, 10000000],
        rangeSelector: '.periodic-investment-range',
        rangeLabel: 'Periodic investment range',
        milestoneSelector: '.periodic-investment-milestone',
        milestoneLabel: 'Periodic investment milestone',
        milestones: [0, 2000000, 4000000, 6000000, 8000000, 10000000],
        options: (block) => ({
          value: readNumericAuthoredValue(block, '.periodic-investment', 50000),
          step: 5000,
          editable: true,
        }),
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="age-inputs-row">
            <div class="field-group" id="ulipInvestmentModeSlot"></div>
          </div>
          <div class="slider-box" id="ulipInvestmentAmountSlot"></div>
          <div class="two-columns-grid">
            <div class="slider-box" id="ulipInvestmentTenureSlot"></div>
            <div class="slider-box" id="ulipExpectedReturnSlot"></div>
          </div>
          <div class="slider-box" id="ulipPeriodicInvestmentSlot"></div>
        </div>
      </div>
    </div>`,
  },
  fd: {
    id: 'fd',
    style: 'fd-graph',
    eventName: 'fd-plan-update',
    inputEvent: 'fd-plan-input-change',
    cachePrefix: 'fd',
    instanceScope: false,
    calculate: calculateFixedDeposit,
    legacyDetail: ({ inputs, result, errors }) => ({ inputs, result, errors }),
    fields: [
      {
        key: 'investmentAmount',
        control: 'amount',
        valueType: 'number',
        selector: ['.total-investment', '.invest-amount', '.invest-amount-field'],
        label: 'Investment amount',
        slot: '#fdInvestmentAmountSlot',
        rangeSelector: ['.total-investment-range', '.invest-amount-range'],
        rangeLabel: ['Total investment range', 'Invest amount range'],
        range: [1000, 100000],
        milestoneSelector: ['.total-investment-milestone', '.invest-amount-milestone'],
        milestoneLabel: ['Total investment milestone', 'Invest amount milestone'],
        milestones: [10000, 20000, 40000, 60000, 80000, 100000],
        options: (block) => ({
          value: readNumericAuthoredValue(
            block,
            ['.total-investment', '.invest-amount', '.invest-amount-field'],
            100000,
          ),
          step: 5000,
          editable: true,
          required: true,
        }),
      },
      {
        key: 'investmentYears',
        control: 'rate',
        valueType: 'number',
        selector: ['.investment-tenure', '.number-of-years', '.expected-return'],
        label: 'Investment Tenure (Years)',
        slot: '#fdInvestmentTenureSlot',
        rangeSelector: ['.investment-tenure-range', '.expected-return-range'],
        rangeLabel: ['Investment tenure range', 'Expected rate of return(in %) range'],
        range: [1, 30],
        milestoneSelector: ['.investment-tenure-milestone', '.expected-return-milestone'],
        milestoneLabel: [
          'Investment tenure milestone',
          'Expected rate of return(in %) milestone',
        ],
        milestones: [1, 5, 10, 15, 20, 25, 30],
        formatMilestone: (value) => `${value} Year`,
        options: (block) => ({
          value: readNumericAuthoredValue(
            block,
            ['.investment-tenure', '.number-of-years', '.expected-return'],
            2,
          ),
          step: 1,
          suffix: ' Years',
          required: true,
        }),
      },
      {
        key: 'rate',
        control: 'rate',
        valueType: 'number',
        selector: ['.interest-rate', '.expected-rate-of-return', '.expected-return'],
        label: 'Expected rate of return(in %)',
        slot: '#fdExpectedReturnSlot',
        rangeSelector: ['.interest-rate-range', '.expected-return-range'],
        rangeLabel: ['Interest rate % range', 'Expected rate of return(in %) range'],
        range: [1, 15],
        milestoneSelector: ['.interest-rate-milestone', '.expected-return-milestone'],
        milestoneLabel: [
          'Interest rate % milestone',
          'Expected rate of return(in %) milestone',
        ],
        milestones: [1, 5, 10, 15],
        formatMilestone: (value) => `${value}%`,
        options: (block) => ({
          value: readNumericAuthoredValue(
            block,
            ['.interest-rate', '.expected-rate-of-return', '.expected-return'],
            7,
          ),
          step: 0.5,
          suffix: '%',
          required: true,
        }),
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="slider-box" id="fdInvestmentAmountSlot"></div>
          <div class="two-columns-grid">
            <div class="slider-box" id="fdInvestmentTenureSlot"></div>
            <div class="slider-box" id="fdExpectedReturnSlot"></div>
          </div>
        </div>
      </div>
    </div>`,
  },
  ppf: {
    id: 'ppf',
    style: 'ppf-graph',
    eventName: 'ppf-plan-update',
    inputEvent: 'ppf-plan-input-change',
    cachePrefix: 'ppf',
    instanceScope: false,
    calculate: calculatePpfPlan,
    legacyDetail: ({ inputs, result, errors }) => ({ inputs, result, errors }),
    fields: [
      {
        key: 'investmentAmount',
        control: 'amount',
        valueType: 'number',
        selector: ['.yearly-investment', '.investment-amount'],
        label: 'Yearly Investment',
        slot: '#ppfYearlyInvestmentSlot',
        rangeSelector: ['.yearly-investment-range', '.investment-amount-range'],
        rangeLabel: ['Yearly Investment range', 'Investment amount range'],
        range: [500, 150000],
        milestoneSelector: ['.yearly-investment-milestone', '.investment-amount-milestone'],
        milestoneLabel: ['Yearly Investment milestone', 'Investment amount milestone'],
        milestones: [500, 30000, 60000, 90000, 120000, 150000],
        options: (block) => ({
          value: readNumericAuthoredValue(
            block,
            ['.yearly-investment', '.investment-amount'],
            10000,
          ),
          step: 5000,
          editable: true,
          required: true,
        }),
      },
      {
        key: 'investmentYears',
        control: 'rate',
        valueType: 'number',
        selector: ['.time-period', '.investment-tenure'],
        label: 'Time Period (Years)',
        slot: '#ppfTimePeriodSlot',
        rangeSelector: ['.time-period-range', '.investment-tenure-range'],
        rangeLabel: ['Time period(Years) range', 'Investment tenure range'],
        range: [15, 50],
        milestoneSelector: ['.time-period-milestone', '.investment-tenure-milestone'],
        milestoneLabel: ['Time period(Years) milestones', 'Investment tenure milestones'],
        milestones: [15, 25, 32, 40, 50],
        formatMilestone: (value) => `${value} Year`,
        options: (block) => ({
          value: readNumericAuthoredValue(
            block,
            ['.time-period', '.investment-tenure'],
            15,
          ),
          step: 1,
          suffix: ' Years',
          required: true,
        }),
      },
      {
        key: 'rate',
        control: 'input',
        valueType: 'number',
        selector: ['.interest-rate', '.interest-rate-p-a'],
        label: 'Interest Rate (P.A. %)',
        slot: '#ppfInterestRateSlot',
        readOnly: true,
        options(block) {
          const range = readConfiguredRange(
            block,
            ['.interest-rate-range', '.interest-rate-p-a-range'],
            undefined,
            ['Interest rate(P.A) range', 'Interest Rate (P.A. %) range'],
          );
          const value = readNumericAuthoredValue(
            block,
            ['.interest-rate', '.interest-rate-p-a'],
            7.1,
          );
          return {
            type: 'number',
            suffix: '%',
            min: range?.[0],
            max: range?.[1],
            value: range ? Math.max(range[0], Math.min(range[1], value)) : value,
            required: true,
          };
        },
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="age-inputs-row">
            <div class="field-group" id="ppfInterestRateSlot"></div>
          </div>
          <div class="slider-box" id="ppfYearlyInvestmentSlot"></div>
          <div class="slider-box" id="ppfTimePeriodSlot"></div>
        </div>
      </div>
    </div>`,
  },
  rd: {
    id: 'rd',
    style: 'rd-graph',
    eventName: 'rd-plan-update',
    inputEvent: 'rd-plan-input-change',
    cachePrefix: 'rd',
    instanceScope: false,
    calculate: calculateRecurringDeposit,
    legacyDetail: ({ inputs, result, errors }) => ({ inputs, result, errors }),
    fields: [
      {
        key: 'monthlyInvestment',
        control: 'amount',
        valueType: 'number',
        selector: ['.total-investment', '.monthly-investment', '.invest-amount'],
        label: 'Investment Amount',
        slot: '#rdMonthlyInvestmentSlot',
        rangeSelector: ['.total-investment-range', '.monthly-investment-range'],
        rangeLabel: ['Investment range', 'Monthly investment range'],
        range: [5000, 100000],
        milestoneSelector: ['.total-investment-milestone', '.monthly-investment-milestone'],
        milestoneLabel: ['Investment milestone', 'Monthly investment milestone'],
        milestones: [5000, 20000, 40000, 60000, 80000, 100000],
        options: (block) => ({
          value: readNumericAuthoredValue(
            block,
            ['.total-investment', '.monthly-investment', '.invest-amount'],
            100000,
          ),
          step: 5000,
          editable: true,
          required: true,
        }),
      },
      {
        key: 'rate',
        control: 'rate',
        valueType: 'number',
        selector: ['.interest-rate', '.interest-rate-field'],
        label: 'Interest Rate (P.A)',
        slot: '#rdInterestRateSlot',
        rangeSelector: '.interest-rate-range',
        rangeLabel: 'Interest rate % range',
        range: [1, 15],
        milestoneSelector: '.interest-rate-milestone',
        milestoneLabel: 'Interest rate % milestones',
        milestones: [1, 3, 6, 9, 12, 15],
        formatMilestone: (value) => `${value}%`,
        options: (block) => ({
          value: readNumericAuthoredValue(block, ['.interest-rate', '.interest-rate-field'], 7),
          step: 0.5,
          suffix: '%',
          required: true,
        }),
      },
      {
        key: 'investmentYears',
        control: 'rate',
        valueType: 'number',
        selector: ['.expected-return', '.investment-tenure'],
        label: 'Investment Tenure (Years)',
        slot: '#rdInvestmentTenureSlot',
        rangeSelector: ['.expected-return-range', '.investment-tenure-range'],
        rangeLabel: ['Expected rate of return(in %) range', 'Investment tenure range'],
        range: [1, 10],
        milestoneSelector: ['.expected-return-milestone', '.investment-tenure-milestone'],
        milestoneLabel: ['Expected rate of return(in %) milestone', 'Investment tenure milestone'],
        milestones: [1, 3, 5, 7, 10],
        formatMilestone: (value) => `${value} Year`,
        options: (block) => ({
          value: readNumericAuthoredValue(
            block,
            ['.expected-return', '.investment-tenure'],
            2,
          ),
          step: 1,
          suffix: ' Years',
          required: true,
        }),
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="slider-box" id="rdMonthlyInvestmentSlot"></div>
          <div class="two-columns-grid">
          <div class="slider-box" id="rdInvestmentTenureSlot"></div>
          <div class="slider-box" id="rdInterestRateSlot"></div>
          </div>
        </div>
      </div>
    </div>`,
  },
  sip: {
    id: 'sip',
    style: 'sip-graph',
    eventName: 'sip-plan-update',
    inputEvent: 'sip-plan-input-change',
    cachePrefix: 'sip',
    instanceScope: false,
    calculate: calculateSipPlan,
    legacyDetail: ({ inputs, result, errors }) => ({ inputs, result, errors }),
    fields: [
      {
        key: 'monthlyInvestment',
        control: 'amount',
        valueType: 'number',
        selector: ['.investment-amount', '.monthly-investment'],
        label: 'Investment Amount (Monthly)',
        slot: '#sipMonthlyInvestmentSlot',
        rangeSelector: ['.investment-amount-range', '.monthly-investment-range'],
        rangeLabel: ['Investment Amount(Monthly) range', 'Monthly investment range'],
        range: [5000, 1000000],
        milestoneSelector: ['.investment-amount-milestone', '.monthly-investment-milestone'],
        milestoneLabel: ['Investment Amount(Monthly) milestone', 'Monthly investment milestone'],
        milestones: [5000, 200000, 400000, 600000, 800000, 1000000],
        options: (block) => ({
          value: readNumericAuthoredValue(
            block,
            ['.investment-amount', '.monthly-investment'],
            50000,
          ),
          step: 5000,
          editable: true,
          required: true,
        }),
      },
      {
        key: 'investmentYears',
        control: 'rate',
        valueType: 'number',
        selector: ['.expected-return', '.investment-tenure'],
        label: 'Investment Tenure(Years)',
        slot: '#sipInvestmentTenureSlot',
        rangeSelector: ['.expected-return-range', '.investment-tenure-range'],
        rangeLabel: ['Expected rate of return(in %) range', 'Investment tenure range'],
        range: [1, 50],
        milestoneSelector: ['.expected-return-milestone', '.investment-tenure-milestone'],
        milestoneLabel: [
          'Expected rate of return(in %) milestone', 'Investment tenure milestone',
        ],
        milestones: [1, 10, 20, 30, 40, 50],
        formatMilestone: (value) => `${value} Year`,
        options: (block) => ({
          value: readNumericAuthoredValue(
            block,
            ['.expected-return', '.investment-tenure'],
            2,
          ),
          step: 1,
          suffix: ' Years',
          required: true,
        }),
      },
      {
        key: 'rate',
        control: 'rate',
        valueType: 'number',
        selector: ['.interest-rate', '.interest-rate-p-a'],
        label: 'Interest Rate(P.A)',
        slot: '#sipInterestRateSlot',
        rangeSelector: ['.interest-rate-range', '.interest-rate-p-a-range'],
        rangeLabel: ['Interest rate % range', 'Interest Rate(P.A) range'],
        range: [1, 30],
        milestoneSelector: ['.interest-rate-milestone', '.interest-rate-p-a-milestone'],
        milestoneLabel: ['Interest rate % milestones', 'Interest Rate(P.A) milestones'],
        milestones: [1, 6, 12, 18, 24, 30],
        formatMilestone: (value) => `${value}%`,
        options: (block) => ({
          value: readNumericAuthoredValue(
            block,
            ['.interest-rate', '.interest-rate-p-a'],
            7,
          ),
          step: 1,
          suffix: '%',
          required: true,
        }),
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="slider-box" id="sipMonthlyInvestmentSlot"></div>
          <div class="two-columns-grid">
            <div class="slider-box" id="sipInvestmentTenureSlot"></div>
            <div class="slider-box" id="sipInterestRateSlot"></div>
          </div>
        </div>
      </div>
    </div>`,
  },
  nps: {
    id: 'nps',
    style: 'nps-text',
    eventName: 'nps-plan-update',
    inputEvent: 'nps-plan-input-change',
    cachePrefix: 'nps',
    calculate: calculateNpsPlan,
    bubbles: true,
    legacyDetail: ({ inputs, result, errors }) => ({ ...inputs, result, errors }),
    fields: [
      {
        key: 'yourAge',
        control: 'age',
        valueType: 'number',
        selector: '.your-age',
        label: 'Your age',
        slot: '#npsYourAgeSlot',
        authoredRange: true,
        range: [18, 60],
        rangeSelector: '.your-age-minmax',
        rangeLabel: 'Current age range',
        options: { value: 30, required: true },
      },
      {
        key: 'monthlyInvestment',
        control: 'amount',
        valueType: 'number',
        selector: '.monthly-investment',
        label: 'Monthly investment',
        slot: '#npsMonthlyInvestmentSlot',
        authoredRange: true,
        rangeSelector: '.monthly-investment-range',
        rangeLabel: 'Monthly investment range',
        milestoneSelector: '.monthly-investment-milestone',
        milestoneLabel: 'Monthly investment milestone',
        options: {
          value: 10000, step: 5000, editable: true, required: true,
        },
      },
      {
        key: 'expectedReturn',
        control: 'rate',
        valueType: 'number',
        selector: '.expected-return',
        label: ['Expected returns (P.A)', 'Expected returns(P.A)', 'Expected Return %'],
        slot: '#npsExpectedReturnSlot',
        authoredRange: true,
        rangeSelector: '.expected-return-range',
        rangeLabel: 'Expected Return % range',
        milestoneSelector: '.expected-return-milestone',
        milestoneLabel: 'Expected Return % milestone',
        formatMilestone: (value) => `${value}%`,
        options: {
          value: 8, step: 1, suffix: '%', required: true,
        },
      },
      {
        key: 'annuityPercentage',
        control: 'ratio',
        valueType: 'number',
        selector: '.annuity-returns',
        label: 'Percentage of Annuity Returns',
        slot: '#npsannuitypercentageslot',
        authoredRange: true,
        rangeSelector: '.annuity-return-range',
        rangeLabel: 'Percentage of annuity returns range',
        milestoneSelector: '.annuity-return-milestone',
        milestoneLabel: 'Percentage of annuity returns milestone',
        formatMilestone: (value) => `${value}%`,
        options: {
          value: 50, step: 1, required: true,
        },
      },
      {
        key: 'annuityReturn',
        control: 'rate',
        valueType: 'number',
        selector: '.expected-annuity',
        label: ['Expected Returns of Annuity%', 'Expected returns of annuity%'],
        slot: '#npsAnnuityReturnSlot',
        authoredRange: true,
        rangeSelector: '.expected-annuity-range',
        rangeLabel: 'Expected returns of annuity% range',
        milestoneSelector: '.expected-annuity-milestone',
        milestoneLabel: 'Expected returns of annuity% milestone',
        formatMilestone: (value) => `${value}%`,
        options: {
          value: 6, step: 1, suffix: '%', required: true,
        },
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="age-inputs-row">
            <div class="field-group" id="npsYourAgeSlot"></div>
          </div>
          <div class="slider-box" id="npsMonthlyInvestmentSlot"></div>
          <div class="two-columns-grid">
            <div class="slider-box" id="npsExpectedReturnSlot"></div>
            <div class="slider-box" id="npsAnnuityReturnSlot"></div>
          </div>
          <div class="slider-box" id="npsannuitypercentageslot"></div>
        </div>
      </div>
    </div>`,
  },
  swp: {
    id: 'swp',
    style: 'swp-graph',
    eventName: 'swp-plan-update',
    inputEvent: 'swp-plan-input-change',
    cachePrefix: 'swp',
    instanceScope: false,
    calculate: calculateSwpPlan,
    legacyDetail: ({ inputs, result, errors }) => ({ inputs, result, errors }),
    fields: [
      {
        key: 'investmentAmount',
        control: 'amount',
        valueType: 'number',
        selector: ['.total-investment', '.invest-amount'],
        label: 'Total investment',
        slot: '#swpInvestmentAmountSlot',
        rangeSelector: ['.total-investment-range', '.invest-amount-range'],
        rangeLabel: ['Total investment range', 'Invest amount range'],
        range: [100000, 10000000],
        milestoneSelector: [
          '.total-investment-milestone', '.total-investment-milestones',
          '.invest-amount-milestone',
        ],
        milestoneLabel: ['Total investment milestone', 'Total investment milestones'],
        milestones: [100000, 2000000, 4000000, 6000000, 8000000, 10000000],
        options: (block) => ({
          value: readNumericAuthoredValue(
            block,
            ['.total-investment', '.invest-amount'],
            5000000,
          ),
          step: 5000,
          editable: true,
          required: true,
        }),
      },
      {
        key: 'monthlyWithdrawal',
        control: 'amount',
        valueType: 'number',
        selector: ['.withdrawal-month', '.withdrawal-per-month'],
        label: 'Withdrawal per month',
        slot: '#swpMonthlyWithdrawalSlot',
        rangeSelector: ['.withdrawal-month-range', '.withdrawal-per-month-range'],
        rangeLabel: ['Withdrawal per month range', 'Withdrawal per month range'],
        range: [5000, 100000],
        milestoneSelector: [
          '.withdrawal-month-milestone', '.withdrawal-month-milestones',
          '.withdrawal-per-month-milestones',
        ],
        milestoneLabel: [
          'Withdrawal per month milestone', 'Withdrawal per month milestones',
        ],
        milestones: [5000, 25000, 50000, 75000, 100000],
        options: (block) => ({
          value: readNumericAuthoredValue(
            block,
            ['.withdrawal-month', '.withdrawal-per-month'],
            10000,
          ),
          step: 5000,
          editable: true,
          required: true,
        }),
      },
      {
        key: 'expectedReturn',
        control: 'rate',
        valueType: 'number',
        selector: '.expected-return',
        label: 'Expected Returns (%)',
        slot: '#swpExpectedReturnSlot',
        rangeSelector: ['.expected-return-range', '.expected-returns-range'],
        rangeLabel: ['Expected returns (%) range', 'Expected Returns (%) range'],
        range: [1, 30],
        milestoneSelector: [
          '.expected-return-milestone', '.expected-return-milestones',
        ],
        milestoneLabel: [
          'Expected returns (%) milestone', 'Expected returns (%) milestones',
        ],
        milestones: [1, 6, 12, 18, 24, 30],
        formatMilestone: (value) => `${value}%`,
        options: (block) => ({
          value: readNumericAuthoredValue(block, '.expected-return', 9),
          step: 1,
          suffix: '%',
          required: true,
        }),
      },
      {
        key: 'investmentYears',
        control: 'rate',
        valueType: 'number',
        selector: ['.tenure', '.tenure-years'],
        label: 'Tenure (years)',
        slot: '#swpInvestmentYearsSlot',
        rangeSelector: ['.tenure-range', '.tenure-years-range'],
        rangeLabel: ['Tenure range', 'Tenure (years) range'],
        range: [1, 30],
        milestoneSelector: [
          '.tenure-milestone', '.tenure-milestones', '.tenure-years-milestones',
        ],
        milestoneLabel: ['Tenure milestones', 'Tenure (years) milestones'],
        milestones: [1, 5, 10, 15, 20, 25, 30],
        formatMilestone: (value) => `${value} Year`,
        options: (block) => ({
          value: readNumericAuthoredValue(block, ['.tenure', '.tenure-years'], 5),
          step: 1,
          suffix: ' Years',
          required: true,
        }),
      },
    ],
    markup: `<div class="calculator-modal">
      <div class="calculator-grid">
        <div class="calc-card">
          <div class="slider-box" id="swpInvestmentAmountSlot"></div>
          <div class="slider-box" id="swpMonthlyWithdrawalSlot"></div>
          <div class="two-columns-grid">
            <div class="slider-box" id="swpExpectedReturnSlot"></div>
            <div class="slider-box" id="swpInvestmentYearsSlot"></div>
          </div>
        </div>
      </div>
    </div>`,
  },
};

export function getCalculatorDefinition(block) {
  const matches = Object.values(calculatorDefinitions)
    .filter((definition) => block.classList.contains(definition.style));
  if (matches.length > 1) throw new Error('Select only one calculator type per block');
  return matches[0];
}
