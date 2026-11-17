# Rating Banner

A navy banner showing the aggregate page rating and an inline "Was this helpful?" star survey; submitting shows a thank-you state and bumps the ratings count live.

## Authoring

| Field | Type | Description |
|---|---|---|
| Icon | Reference | Icon shown next to the ratings count |
| Rated By Label | Text | Label shown under the ratings count, e.g. Rated by customers |
| Overall Rating | Rich Text | Rating value and label together, authored as two lines, e.g. 4.7 then Overall ratings |
| Feedback Prompt & Button | Rich Text | Question text and the Submit Rating link together, authored as two paragraphs |

> The ratings count number itself is not authored — it's a UI placeholder that increments client-side on submit. Wiring it to the live ratings API is a follow-up.

## Behaviour

- Initially, when none of the stars are filled, the **Submit Rating** button is disabled (`disabled`, `aria-disabled="true"`, non-submittable).
- Clicking a star highlights stars 1 through the clicked one and enables the **Submit Rating** button.
- Clicking **Submit Rating** replaces the question/stars/button with "Thank you for rating us!" (filled stars + thank you message) and increases the displayed ratings count by 1.
- No data is sent to a backend yet; this is UI-only per current scope.

## Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| Mobile (< 900px) | Icon/count/divider/rating and the question/stars/button all stack centered in a single column |
| Desktop (≥ 900px) | Aggregate (icon/count/divider/rating) sits left, question/stars/button sit right, in one row |

## File Structure

```
blocks/rating-banner/
├── rating-banner.css
├── rating-banner.js
├── _rating-banner.json
├── README.md
└── docs/
    └── ue-authoring.svg
```
