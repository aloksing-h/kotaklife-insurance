# Form Block

## Buy Term Insurance Form

The term-insurance form is authored in a `.form-up-desktop` section that also contains the `category-info-cards` block. Keep the form and those cards independent: the closed state hides only `.form-wrapper`, never the whole section or `.cards-wrapper`.

The term-insurance hero's “Talk to An Expert” CTA opens the form in place by adding `.is-open` to the form section. It must not scroll or navigate to the CTA's placeholder `#`. The CTA remains available, but another click while the form is open must not close it or trigger another action.

<<<<<<< Updated upstream
The CTA exposes its state with `aria-expanded` and `aria-controls`. If these requirements change, update the section visibility rule in `buy-term-insurance.css` and the matching CTA handler in `banner-v2/banner-v2.js` together. Verify the category cards remain visible before opening and after opening the form.
=======
The CTA exposes its state with `aria-expanded` and `aria-controls`. If these requirements change, update the section visibility rule in `buy-term-insurance.css` and the matching CTA handler in `banner-v2/banner-v2.js` together. Verify the category cards remain visible before opening and after opening the form.

*(Note: The toggle behavior is temporarily commented out in `blocks/form/buy-term-insurance.css` and `blocks/banner-v2/banner-v2.js` so the form remains visible by default. To re-enable it, simply uncomment the marked blocks in both files.)*

## Callback API

Both callback variants use the encrypted `kli-create-lead` gateway. Only name, phone,
email, DOB, gender, and income are collected when populated. Tobacco and consent retain
their UI validation but are not sent. Product code `U04` and tracking metadata are unchanged.
Manual DOB edits take precedence over a stale hidden picker value.

Success requires the client response's `statusCode: 200` and `status: "success"`.
Business and transport failures show an alert and retain values for retry. A pending
request blocks repeated submissions and the legacy action handler.

Manually check both page forms for success, HTTP-200 business failure, network failure,
retry, manual DOB entry, and repeated clicks. Confirm tobacco and consent are absent
from the payload.
>>>>>>> Stashed changes
