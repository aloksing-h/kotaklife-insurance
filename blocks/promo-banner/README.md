# Promo Banner

Displays authored promotional cards with optional images, text, and CTA links.

## Slider interactions

- Swipe or scroll horizontally to browse cards.
- Select a pagination dot to show its corresponding card.
- Double-click a card's non-interactive area to advance to the next card.
  Double-clicking the final card returns to the first card.
- To drag, press and hold while moving horizontally, including on the second press
  of a double-click. Dragging does not depend on double-click timing.
  The slider follows the mouse; dragging at least 40 pixels left/right advances to
  the next/previous card on release. Longer drags can reach further cards.
  Drags stop at the first and last card, without also triggering double-click navigation.
  Releasing outside the banner, cancelling the pointer, or switching windows ends the drag.
- Links, buttons, form fields, and editable content keep their existing interactions;
  double-clicking them does not advance the slider.
- Pagination dots track the visible card and remain keyboard-accessible.
- A single-card banner has no pagination or double-click navigation.
