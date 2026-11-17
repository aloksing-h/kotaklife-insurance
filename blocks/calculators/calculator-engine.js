export function calculateBmi({ weight, feet, inches }) {
  if (!Number.isFinite(weight) || weight < 10 || weight > 200
    || !Number.isInteger(feet) || feet < 2 || feet > 8
    || !Number.isFinite(inches) || inches < 0 || inches > 12) {
    throw new RangeError('Enter valid weight, height in feet, and inches.');
  }
  const heightMetres = feet * 0.3048 + inches * 0.0254;
  const bmi = Number((weight / (heightMetres ** 2)).toFixed(1));
  let category = 'obese';
  if (bmi < 18.5) category = 'underweight';
  else if (bmi < 24.9) category = 'normal';
  else if (bmi < 29.9) category = 'overweight';
  return { bmi, category, heightMetres };
}

export function calculateSavingsPlan({
  goalAmount, existingSavings, investmentYears, rate,
}) {
  if (!Number.isFinite(goalAmount) || goalAmount <= 0
    || !Number.isFinite(existingSavings) || existingSavings < 0
    || !Number.isInteger(investmentYears) || investmentYears < 1
    || !Number.isSafeInteger(investmentYears * 12)
    || !Number.isFinite(rate) || rate < 0) {
    throw new RangeError('Enter valid savings goal, existing savings, duration, and interest rate.');
  }

  const contribution = (frequency) => {
    const periods = investmentYears * frequency;
    const periodicRate = rate / 100 / frequency;
    const growthMinusOne = Math.expm1(periods * Math.log1p(periodicRate));
    const futureExistingSavings = existingSavings === 0
      ? 0 : existingSavings * (growthMinusOne + 1);
    const shortfall = Math.max(0, goalAmount - futureExistingSavings);
    const annuityFactor = periodicRate === 0 ? periods : growthMinusOne / periodicRate;
    const requiredSavings = shortfall === 0 ? 0 : shortfall / annuityFactor;
    if (![futureExistingSavings, annuityFactor, requiredSavings].every(Number.isFinite)) {
      throw new RangeError('Savings result exceeds the supported range.');
    }
    return requiredSavings;
  };

  return {
    goalAmount,
    existingSavings,
    investmentYears,
    monthlySavings: contribution(12),
    yearlySavings: contribution(1),
  };
}

export function calculateHlvPlan({
  currentAge, retirementAge, yearlyIncome, currentLoans, existingSavings, existingLifeCover,
}) {
  if (!Number.isInteger(currentAge) || currentAge < 0
    || !Number.isInteger(retirementAge) || retirementAge <= currentAge
    || ![yearlyIncome, currentLoans, existingSavings, existingLifeCover]
      .every((amount) => Number.isFinite(amount) && amount >= 0)) {
    throw new RangeError('Enter valid ages and non-negative HLV amounts.');
  }

  const yearsRemaining = retirementAge - currentAge;
  const incomeReplacementValue = yearlyIncome * yearsRemaining;
  const humanLifeValue = Math.max(
    0,
    incomeReplacementValue + currentLoans - existingSavings - existingLifeCover,
  );
  if (!Number.isFinite(humanLifeValue)) {
    throw new RangeError('HLV result exceeds the supported range.');
  }

  return {
    yearsRemaining,
    incomeReplacementValue,
    humanLifeValue,
  };
}

export function calculateCompoundInterest({
  investmentAmount, investmentYears, holdingYears, rate, frequency = 12,
  startYear = new Date().getFullYear(),
}) {
  if (!Number.isFinite(investmentAmount) || investmentAmount < 0
    || !Number.isInteger(investmentYears) || investmentYears < 0
    || !Number.isInteger(holdingYears) || holdingYears < 0
    || !Number.isFinite(rate) || rate < 0
    || ![1, 2, 4, 12].includes(frequency)
    || !Number.isInteger(startYear)) {
    throw new RangeError('Invalid compound interest inputs');
  }
  const validationErrors = holdingYears < investmentYears
    ? ['Stay-invested years must be greater than or equal to investment years.'] : [];
  if (validationErrors.length) {
    return {
      isValid: false,
      errors: validationErrors,
      validationErrors,
      finalAmount: 0,
      yearlyData: [],
    };
  }
  const periodRate = rate / 100 / frequency;
  const yearlyData = [];
  const totalYears = Math.max(investmentYears, holdingYears);
  let currentBalance = 0;
  let totalInvested = 0;

  for (let year = 1; year <= totalYears; year += 1) {
    for (let period = 0; period < frequency; period += 1) {
      if (year <= investmentYears) {
        currentBalance += investmentAmount;
        totalInvested += investmentAmount;
      }
      currentBalance += currentBalance * periodRate;
    }
    yearlyData.push({
      year: startYear + year - 1,
      balance: Math.round(currentBalance),
      investedAmount: Math.round(totalInvested),
    });
  }

  if (!Number.isFinite(currentBalance)) throw new RangeError('Compound result exceeds the supported range');
  return {
    finalAmount: yearlyData.length ? yearlyData[yearlyData.length - 1].balance : 0,
    yearlyData,
    validationErrors,
  };
}

export function calculateFixedDeposit({ investmentAmount, investmentYears, rate }) {
  if (!Number.isFinite(investmentAmount) || investmentAmount < 0
    || !Number.isInteger(investmentYears) || investmentYears < 1
    || !Number.isFinite(rate) || rate < 0) {
    throw new RangeError('Invalid fixed deposit inputs');
  }

  const totalValue = investmentAmount * ((1 + (rate / 400)) ** (investmentYears * 4));
  if (!Number.isFinite(totalValue)) throw new RangeError('Fixed deposit result exceeds the supported range');

  const estimatedReturns = totalValue - investmentAmount;
  return {
    finalAmount: totalValue,
    totalValue,
    estimatedReturns,
    interestAmount: estimatedReturns,
  };
}

export function calculatePpfPlan({ investmentAmount, investmentYears, rate }) {
  if (!Number.isFinite(investmentAmount) || investmentAmount < 500 || investmentAmount > 150000
    || !Number.isInteger(investmentYears) || investmentYears < 15 || investmentYears > 50
    || (investmentYears - 15) % 1 !== 0
    || !Number.isFinite(rate) || rate < 0) {
    throw new RangeError('Enter valid PPF investment, tenure, and rate values');
  }

  const annualRate = rate / 100;
  let totalValue = 0;
  for (let year = 0; year < investmentYears; year += 1) {
    totalValue = (totalValue + investmentAmount) * (1 + annualRate);
  }

  const investedAmount = investmentAmount * investmentYears;
  if (!Number.isFinite(totalValue) || !Number.isFinite(investedAmount)) {
    throw new RangeError('PPF result exceeds the supported range');
  }

  const estimatedReturns = totalValue - investedAmount;
  return {
    finalAmount: totalValue,
    totalValue,
    investedAmount,
    estimatedReturns,
    interestAmount: estimatedReturns,
  };
}

export function calculateRecurringDeposit({ monthlyInvestment, investmentYears, rate }) {
  if (!Number.isFinite(monthlyInvestment) || monthlyInvestment < 0
    || !Number.isInteger(investmentYears) || investmentYears < 1
    || !Number.isFinite(rate) || rate < 0) {
    throw new RangeError('Invalid recurring deposit inputs');
  }

  const investedAmount = monthlyInvestment * investmentYears * 12;
  const quarterlyRate = rate / 400;
  const quarters = investmentYears * 4;
  const totalValue = rate === 0
    ? investedAmount
    : monthlyInvestment * (((1 + quarterlyRate) ** quarters - 1)
      / (1 - ((1 + quarterlyRate) ** (-1 / 3))));
  if (!Number.isFinite(totalValue) || !Number.isFinite(investedAmount)) {
    throw new RangeError('Recurring deposit result exceeds the supported range');
  }

  const estimatedReturns = totalValue - investedAmount;
  return {
    finalAmount: totalValue,
    totalValue,
    investedAmount,
    estimatedReturns,
    interestAmount: estimatedReturns,
  };
}

export function calculateSipPlan({ monthlyInvestment, investmentYears, rate }) {
  if (!Number.isFinite(monthlyInvestment) || monthlyInvestment < 0
    || !Number.isInteger(investmentYears) || investmentYears < 1
    || !Number.isFinite(rate) || rate < 0) {
    throw new RangeError('Invalid SIP inputs');
  }

  const monthlyRate = rate / 100 / 12;
  const totalMonths = investmentYears * 12;
  let balance = 0;

  for (let month = 0; month < totalMonths; month += 1) {
    balance = (balance + monthlyInvestment) * (1 + monthlyRate);
  }

  const totalInvested = monthlyInvestment * totalMonths;
  if (![balance, totalInvested].every(Number.isFinite)) {
    throw new RangeError('SIP result exceeds the supported range');
  }

  const estimatedReturns = balance - totalInvested;
  return {
    finalAmount: balance,
    totalValue: balance,
    totalInvested,
    investedAmount: totalInvested,
    estimatedReturns,
    interestAmount: estimatedReturns,
  };
}

export function calculateSwpPlan({
  investmentAmount, monthlyWithdrawal, expectedReturn, investmentYears,
}) {
  if (!Number.isFinite(investmentAmount) || investmentAmount < 100000
    || investmentAmount > 10000000
    || !Number.isFinite(monthlyWithdrawal) || monthlyWithdrawal < 5000
    || monthlyWithdrawal > 100000
    || !Number.isFinite(expectedReturn) || expectedReturn < 1 || expectedReturn > 30
    || !Number.isInteger(expectedReturn * 2)
    || !Number.isSafeInteger(investmentYears * 12)
    || !Number.isInteger(investmentYears) || investmentYears < 1) {
    throw new RangeError('Enter valid SWP investment, withdrawal, return, and tenure values.');
  }

  const monthlyRate = ((1 + (expectedReturn / 100)) ** (1 / 12)) - 1;
  const totalMonths = investmentYears * 12;
  let balance = investmentAmount;
  let totalWithdrawn = 0;
  let totalInterestEarned = 0;
  let exhaustionMonth = null;

  for (let month = 1; month <= totalMonths; month += 1) {
    const interest = balance * monthlyRate;
    const availableForWithdrawal = balance + interest;
    const actualWithdrawal = Math.min(monthlyWithdrawal, availableForWithdrawal);
    balance = Math.max(0, availableForWithdrawal - actualWithdrawal);
    totalInterestEarned += interest;
    totalWithdrawn += actualWithdrawal;

    if (actualWithdrawal < monthlyWithdrawal || (balance === 0 && month < totalMonths)) {
      exhaustionMonth = month;
      break;
    }
  }

  if (![balance, totalWithdrawn, totalInterestEarned].every(Number.isFinite)) {
    throw new RangeError('SWP result exceeds the supported range.');
  }

  return {
    investmentAmount,
    monthlyWithdrawal,
    investmentYears,
    totalWithdrawn,
    totalInterestEarned,
    remainingBalance: balance,
    totalMonths,
    withdrawalMonths: Math.min(totalMonths, exhaustionMonth || totalMonths),
    isExhausted: exhaustionMonth !== null,
    exhaustionMonth,
  };
}

export function calculateUlipPlan({
  investmentAmount, investmentYears, rate, periodicInvestment = 0,
  investmentMode = 'regular',
  startYear = new Date().getFullYear(),
}) {
  if (!Number.isFinite(investmentAmount) || investmentAmount < 0
    || !Number.isInteger(investmentYears) || investmentYears < 1
    || !Number.isFinite(rate) || rate < 0
    || !Number.isFinite(periodicInvestment) || periodicInvestment < 0
    || !['regular', 'one-time'].includes(investmentMode)
    || !Number.isInteger(startYear)) {
    throw new RangeError('Invalid ULIP inputs');
  }

  const monthlyRate = rate / 100 / 12;
  const monthlyContribution = investmentMode === 'regular' ? investmentAmount : periodicInvestment;
  const upfrontInvestment = investmentMode === 'regular' ? periodicInvestment : investmentAmount;
  const yearlyData = [];
  let regularInvestmentBalance = 0;

  for (let year = 1; year <= investmentYears; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      regularInvestmentBalance += monthlyContribution;
      regularInvestmentBalance *= 1 + monthlyRate;
    }
    const existingInvestmentBalance = upfrontInvestment
      * ((1 + monthlyRate) ** (year * 12));
    const investedAmount = (monthlyContribution * year * 12) + upfrontInvestment;
    const balance = Math.round(regularInvestmentBalance + existingInvestmentBalance);
    yearlyData.push({
      year: startYear + year - 1,
      balance,
      investedAmount,
      returns: balance - investedAmount,
    });
  }

  const finalAmount = yearlyData[yearlyData.length - 1].balance;
  const totalInvested = yearlyData[yearlyData.length - 1].investedAmount;
  if (!Number.isFinite(finalAmount) || !Number.isFinite(totalInvested)) {
    throw new RangeError('ULIP result exceeds the supported range');
  }

  return {
    finalAmount,
    totalInvested,
    totalReturns: finalAmount - totalInvested,
    yearlyData,
  };
}

export function calculateFirePlan({
  currentAge, retireAge, monthlyExpense, inflationrate,
}) {
  const errors = [];
  if (!Number.isInteger(currentAge) || currentAge < 0) {
    errors.push('Current age must be a non-negative whole number.');
  }
  if (!Number.isInteger(retireAge) || retireAge < 0) {
    errors.push('Retirement age must be a non-negative whole number.');
  }
  if (retireAge <= currentAge) errors.push('Retirement age must exceed current age.');
  if (!Number.isFinite(monthlyExpense) || monthlyExpense <= 0) {
    errors.push('Monthly expense must be greater than zero.');
  }
  if (!Number.isFinite(inflationrate) || inflationrate < 0) {
    errors.push('Inflation rate must be a non-negative percentage.');
  }
  if (errors.length) return { isValid: false, errors };

  const yearsToRetirement = retireAge - currentAge;
  const yearlyExpenseToday = monthlyExpense * 12;
  const exactYearlyExpenseAtRetirement = yearlyExpenseToday
    * ((1 + (inflationrate / 100)) ** yearsToRetirement);
  if (!Number.isFinite(exactYearlyExpenseAtRetirement * 50)) {
    return { isValid: false, errors: ['FIRE result exceeds the supported range.'] };
  }
  return {
    isValid: true,
    errors,
    yearsToRetirement,
    yearlyExpenseToday: Math.round(yearlyExpenseToday),
    yearlyExpenseAtRetirement: Math.round(exactYearlyExpenseAtRetirement),
    leanFireTarget: Math.round(exactYearlyExpenseAtRetirement * 15),
    standardFireTarget: Math.round(exactYearlyExpenseAtRetirement * 25),
    fatFireTarget: Math.round(exactYearlyExpenseAtRetirement * 50),
  };
}

export function calculateGratuity({ monthlySalary, yearsOfService }) {
  if (!Number.isFinite(monthlySalary) || monthlySalary < 10000 || monthlySalary > 10000000
    || !Number.isInteger(yearsOfService) || yearsOfService < 5 || yearsOfService > 30) {
    throw new RangeError('Enter a valid monthly salary and service duration.');
  }

  return {
    gratuityAmount: Math.min((yearsOfService * monthlySalary * 15) / 26, 1000000),
  };
}

export function calculateHra({
  basicSalary, dearnessAllowance, hraReceived, totalRentPaid, isMetroCity,
}) {
  const amounts = [basicSalary, dearnessAllowance, hraReceived, totalRentPaid];
  if (!amounts.every(Number.isFinite)
    || basicSalary < 10000 || basicSalary > 10000000
    || dearnessAllowance < 0 || dearnessAllowance > 10000000
    || hraReceived < 0 || hraReceived > 10000000
    || totalRentPaid < 0 || totalRentPaid > 10000000
    || !['yes', 'no'].includes(isMetroCity)) {
    throw new RangeError('Enter valid HRA salary, rent, and city values.');
  }

  const salary = basicSalary + dearnessAllowance;
  const rentExemption = totalRentPaid - (salary * 0.1);
  const salaryPercentage = isMetroCity === 'yes' ? 0.5 : 0.4;
  const exemptedHra = Math.max(
    Math.min(rentExemption, salary * salaryPercentage, hraReceived),
    0,
  );

  return {
    exemptedHra,
    taxableHra: hraReceived - exemptedHra,
  };
}

export function calculateRetirementPlan({
  currentAge, retirementAge, lifeExpectancy, monthlyExpense, retirementExpenseRatio,
}) {
  const ages = [currentAge, retirementAge, lifeExpectancy];
  if (!ages.every((age) => Number.isInteger(age) && age >= 0)
    || currentAge >= retirementAge || retirementAge >= lifeExpectancy
    || !Number.isFinite(monthlyExpense) || monthlyExpense <= 0
    || !Number.isFinite(retirementExpenseRatio)
    || retirementExpenseRatio <= 0 || retirementExpenseRatio > 100) {
    throw new RangeError('Enter valid expenses and ages: current age < retirement age < life expectancy');
  }
  const yearsToRetirement = retirementAge - currentAge;
  const retirementDuration = lifeExpectancy - retirementAge;
  const annualRetirementExpense = monthlyExpense * (retirementExpenseRatio / 100) * 12;
  const estimatedFund = annualRetirementExpense * retirementDuration;
  const monthlySavings = estimatedFund / (yearsToRetirement * 12);
  if (!Number.isFinite(estimatedFund) || !Number.isFinite(monthlySavings * 12)) {
    throw new RangeError('Retirement result exceeds the supported range');
  }
  return {
    yearsToRetirement,
    retirementDuration,
    annualRetirementExpense,
    estimatedFund,
    monthlySavings,
    yearlySavings: monthlySavings * 12,
  };
}

export function calculateNpsPlan({
  yourAge, monthlyInvestment, expectedReturn, annuityPercentage, annuityReturn,
}) {
  if (!Number.isInteger(yourAge) || yourAge < 18 || yourAge > 60
    || !Number.isFinite(monthlyInvestment) || monthlyInvestment < 0
    || !Number.isFinite(expectedReturn) || expectedReturn < 0
    || !Number.isFinite(annuityPercentage) || annuityPercentage < 0 || annuityPercentage > 100
    || !Number.isFinite(annuityReturn) || annuityReturn < 0) {
    throw new RangeError('Enter valid NPS values.');
  }

  const yearsToRetirement = 60 - yourAge;
  const monthsToRetirement = yearsToRetirement * 12;
  const monthlyRate = expectedReturn / 100 / 12;
  const pensionWealth = monthlyRate === 0
    ? monthlyInvestment * monthsToRetirement
    : monthlyInvestment
      * (((1 + monthlyRate) ** monthsToRetirement - 1) / monthlyRate)
      * (1 + monthlyRate);
  const investedAmount = monthlyInvestment * monthsToRetirement;
  const annuityValue = pensionWealth * (annuityPercentage / 100);
  const lumpsumAmount = pensionWealth - annuityValue;
  const monthlyPension = (annuityValue * (annuityReturn / 100)) / 12;

  if (![pensionWealth, investedAmount, annuityValue, lumpsumAmount, monthlyPension]
    .every(Number.isFinite)) {
    throw new RangeError('NPS result exceeds the supported range.');
  }

  return {
    yearsToRetirement,
    investedAmount,
    pensionWealth,
    annuityValue,
    lumpsumAmount,
    monthlyPension,
  };
}
