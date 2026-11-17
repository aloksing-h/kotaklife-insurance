import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateNpsPlan } from '../blocks/calculators/calculator-engine.js';
import {
  findAuthoredField, readConfiguredRange, readConfiguredValues,
} from '../blocks/calculators/field-adapter.js';

test('NPS result matches the supplied monthly contribution example', () => {
  const result = calculateNpsPlan({
    monthlyInvestment: 10000,
    yourAge: 30,
    expectedReturn: 8,
    annuityPercentage: 50,
    annuityReturn: 6,
  });

  assert.equal(result.yearsToRetirement, 30);
  assert.equal(result.investedAmount, 3600000);
  assert.ok(Math.abs(result.pensionWealth - 15002951.783210913) < 0.0001);
  assert.ok(Math.abs(result.lumpsumAmount - 7501475.891605457) < 0.0001);
  assert.ok(Math.abs(result.annuityValue - 7501475.891605457) < 0.0001);
  assert.ok(Math.abs(result.monthlyPension - 37507.37945802729) < 0.0001);
});

test('NPS calculation rejects values outside the supplied validation ranges', () => {
  assert.throws(() => calculateNpsPlan({
    monthlyInvestment: 1000,
    yourAge: 60,
    expectedReturn: 8,
    annuityPercentage: 50,
    annuityReturn: 6,
  }), RangeError);
});

test('NPS calculation accepts values provided by authored ranges', () => {
  const result = calculateNpsPlan({
    monthlyInvestment: 10000,
    yourAge: 30,
    expectedReturn: 0,
    annuityPercentage: 50,
    annuityReturn: 100,
  });

  assert.equal(result.pensionWealth, 3600000);
  assert.equal(result.monthlyPension, 150000);
});

test('NPS annuity allocation supports the authorable 0 to 100 range', () => {
  const result = calculateNpsPlan({
    monthlyInvestment: 10000,
    yourAge: 30,
    expectedReturn: 8,
    annuityPercentage: 0,
    annuityReturn: 6,
  });

  assert.equal(result.annuityValue, 0);
  assert.equal(result.monthlyPension, 0);
  assert.equal(result.lumpsumAmount, result.pensionWealth);
});

test('NPS fields resolve from generic authored form labels', () => {
  const fields = [
    {
      label: 'Your age',
      input: { value: '' },
    },
    {
      label: 'Current age range',
      input: { value: '18,59' },
    },
    {
      label: 'Percentage of annuity returns range',
      input: { value: '0,100' },
    },
    {
      label: 'Percentage of annuity returns milestone',
      input: { value: '0,25,50,75,100' },
    },
  ].map(({ label, input }) => ({
    matches: () => false,
    querySelector: (selector) => (selector.includes('label') ? { textContent: label } : input),
  }));
  const block = {
    querySelector: () => null,
    querySelectorAll: () => fields,
  };

  assert.equal(findAuthoredField(block, '.your-age', 'Your age'), fields[0]);
  assert.deepEqual(readConfiguredRange(block, '.your-age-minmax', [18, 59], 'Current age range'), [
    18, 59,
  ]);
  assert.deepEqual(readConfiguredRange(
    block,
    '.annuity-return-range',
    undefined,
    'Percentage of annuity returns range',
  ), [0, 100]);
  assert.deepEqual(readConfiguredValues(
    block,
    '.annuity-return-milestone',
    [],
    'Percentage of annuity returns milestone',
  ), [0, 25, 50, 75, 100]);
  assert.equal(readConfiguredRange({
    querySelector: () => null,
    querySelectorAll: () => [],
  }, '.annuity-return-range', undefined, 'Percentage of annuity returns range'), undefined);
});
