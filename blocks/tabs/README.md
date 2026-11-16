# Find a Plan Tabs

The Find a Plan variant uses the existing tabs markup and panel-switching behavior.
The legacy implementation is styled in `find-a-plan.css`; pages using
`tab-list.find-plan` use `../tab-list/find-plan.css`.

## Visual States

- Selected: complete 1px dark-to-light blue pill outline, blue fill and semibold label.
- Unselected hover: blue label and a subtle white gradient on pointer-capable devices.
- Keyboard focus: inset blue outline.
- Touch: selection and focus remain available without persistent hover styling.

The reference is the Kotak Figma file, nodes `5009:4775`, `5009:4840`, and
`5009:5143`. Styles are scoped to Find a Plan; card layouts, tab switching and
other tab variants are unchanged.

## Authoring

Keep the existing tab labels and corresponding panels. No component model or
authored row changes are required. See [the authoring diagram](docs/ue-authoring.svg).

## Validation

```sh
npx stylelint blocks/tabs/find-a-plan.css blocks/tab-list/find-plan.css
```

Check selected outlines at mobile and desktop widths, inactive hover, keyboard
focus, and panel switching. Hover must not change the selected panel.