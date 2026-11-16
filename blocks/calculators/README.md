# Reusable Calculators

`calculator-engine.js` contains independent compound, FIRE, retirement, FD, and RD calculation
functions. They take typed values and return numbers, not DOM nodes or formatted currency.
`calculator-definitions.js` declares controls, authored selectors, layout slots, input mappings,
approved assumptions, and legacy events. `field-adapter.js` reuses existing field factories.
`calculator-controller.js` collects values, checks prerequisites, calculates, caches state,
and publishes updates. Existing field classes and CSS are retained.

## Formula Contracts

Compound `investmentAmount` is contributed at the beginning of each period. `frequency` is
periods per year (1, 2, 4, 12); dropdown values 365, 180, 90, 30 map to these frequencies.
`rate` is an annual percentage. Contributions stop after `investmentYears`; projections run
for the greater of investment and holding years. Only snapshots and final amounts are rounded.
An optional `startYear` makes chart snapshots deterministic in tests.

FIRE uses current age, retirement age, monthly expense, and annual inflation percentage.
Its existing API names `retireAge` and `inflationrate` remain supported. Annual expenses are
inflation-adjusted until retirement; targets are 15, 25, and 50 times that unrounded expense.

Retirement preserves the existing corpus calculation: monthly expense times the retirement
expense percentage times 12 times retirement duration. Monthly savings divide this corpus
by months until retirement. Inflation and expected-return values are collected but are not
used by this legacy formula. Do not present this extraction as an approved inflation-adjusted
financial model. Invalid or unordered ages produce no result rather than a negative fund.

Term insurance accepts authorable date of birth, life cover, gender, tobacco options, and
calculate-button label. Life-cover range and milestones are also read from authoring fields.
Calculate validates the inputs and logs the date of birth, life cover, gender, and tobacco
status to the browser console only. It does not call the quote API or generate a premium.
Calculate shows validation errors directly below each invalid field. Errors update as fields
are corrected; a tobacco switch set to its off value is a valid selection.
Its submit handler is defined in `calculator-definitions.js` and wired by the shared
`calculator-controller.js`, without a separate term calculator JavaScript module.
The result panel exposes term-only authoring for the discount
badge, premium label, quote description template, and CTA label/destination. The description
template supports `{frequency}` and `{cover}` placeholders. The authored illustration, badge,
premium label, description, and linked CTA appear immediately, without requiring a quote response.
Premium and unresolved quote placeholders display `--` while submission remains console-only.
A CTA requires both an authored label and an HTTP(S) destination. No local premium formula or
underwriting rule is inferred.
On mobile, the term result uses one fluted blue glass-style background behind both its
illustration and premium content; the discount badge stays above this shared background.

Recurring deposits use monthly contributions with quarterly compounding. For monthly deposit
`P`, annual rate `R`, and duration `Y`, the quarterly rate is `i = R / 400` and maturity value is
`P × ((1 + i)^(4Y) - 1) / (1 - (1 + i)^(-1/3))`. Invested amount is `P × 12Y`; estimated returns
are maturity value minus invested amount. A zero rate returns the invested amount.

## Adding A Calculator

### ULIP Investment Modes

The investment-type dropdown uses an optional authored `.investment-mode` select with
values `regular` and `one-time`. Missing or invalid selections fall back to Regular Investment.
Authored option labels are used when their values match these supported modes.

Regular mode contributes `investmentAmount` at the start of every month. One-time mode
invests that amount once upfront. Both use monthly compounding at `rate / 100 / 12`.
In Regular mode, the optional `periodicInvestment` is an upfront existing investment.
In One-Time mode, it is contributed at the start of each month, not upfront.
The optional field label changes between Existing investment and Periodic investment
(Monthly, Optional) to reflect these meanings. Switching modes
retains input values, updates the summary/chart, and changes total contributed principal.

Authored numeric values, ranges, and milestones override these fallbacks:

| Field | Class | Default | Range | Milestones |
| --- | --- | --- | --- | --- |
| Investment amount | `invest-amount` | 100000 | 1000,10000000 | 1000,2000000,4000000,6000000,8000000,10000000 |
| Tenure (years) | `number-of-years` | 10 | 1,30 | 1,30 |
| Annual rate (%) | `expected-return` | 9 | 1,15 | 1,15 |
| Optional investment (mode-dependent) | `periodic-investment` | 0 | 0,10000000 | 0,2000000,4000000,6000000,8000000,10000000 |

Existing `*-range` and `*-milestone` form rows remain supported. These fallbacks apply
to missing field configuration after the external form loads, not a failed form request.

### Calculator Implementation

1. Verify source formulas, units, timing, rounding, limits, and expected examples.
2. Add a DOM-independent function to `calculator-engine.js` and tests in `test/calculators.test.js`.
3. Add a definition with a unique ID/style, controls, authored selectors, layout slots,
   `engineRequired` inputs, `calculate`, and any input/output mappings. Reuse existing controls.
4. Add an approved style to `_calculators.json`, then run `npm run build:json`.
5. Configure fields through the existing external form source and verify result presentation.

All calculator styles route through `getCalculatorDefinition()` after the same form source
is loaded. Multiple type styles on one block are rejected. Existing calculator modules remain
available as thin entry points; compound and FIRE retain their named calculation exports.
Layout templates belong to definitions and can be reused without sharing unrelated formulas.

`options.required` controls the displayed requirement; `engineRequired` independently controls
calculation prerequisites. Missing labels omit controls, not engine requirements. Hidden required
inputs may only come from explicit, approved `assumptions`. Empty numeric inputs are not zero.
Domain errors produce an empty result; unexpected programming errors are not swallowed.

For a field confirmation change, update its definition's `control`, `selector`, `options`,
`range`, milestones, and `slot`, plus the layout template if ordering changes. The engine input
key remains stable. Use `mapInputs` for approved unit conversions or alternative input controls.
Do not supply financial assumptions through guessed defaults.

`createCalculatorController()` returns `fields`, `update()`, and `destroy()`. Field adapters expose
`element`, `input` where applicable, `getValue()`, and `setValue()`. After programmatic field changes,
call `update()`. Recreating a controller for the same block deactivates the old listeners/callbacks.

## Events And Scope

Existing events and cached `*PlanInputs` / `*PlanResult` properties remain supported.
`calculator-update` contains `{ calculatorId, instanceId, inputs, result, errors }` and bubbles
from the input block. Latest state is on `block.calculatorState` and the scope's
`calculatorStates` map. Input-only forms do not emit this generic mathematical result event.

The compound chart renderer is intentionally unchanged. Invalid compound state supplies zero
and an empty chart series to its legacy renderer; inspect controller state for structured errors.
The legacy chart and FIRE metrics use a calculator-type container or section-wide scope and
support one calculator of each type per scope. Their definitions disable instance scopes until
the result renderers are migrated. Do not put two same-type calculators in the same legacy scope.
New compatible consumers may use a separate `data-calculator-instance` input/result container.
Retirement's input and summary both support this explicit instance container.
Instance-prefixed control IDs avoid collisions; layout slot IDs retain their existing CSS contract.

## Verification

Run `node --experimental-default-type=module --test test/calculators.test.js` on Node 20.20+
and `npm run lint`. Tests verify existing code behavior, not unread attached spreadsheet formulas.
Financial changes require readable reference logic and approved examples.

The [browser fixture](../../test/calculators-browser.html) exercises real controls, missing fields,
age errors, retirement savings toggling, explicit retirement instance isolation, and term aliases.
Open `http://localhost:3000/test/calculators-browser.html` with the local preview running. The final
`calculator-smoke-results` element reports passed/failed checks. The fixture does not exercise
remote form fetching, the unchanged compound chart, or FIRE metric rendering.