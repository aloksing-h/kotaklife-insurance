function curvePrefix(points, endX) {
  const interpolate = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
  const split = (t) => {
    const a = interpolate(points[0], points[1], t);
    const b = interpolate(points[1], points[2], t);
    const c = interpolate(points[2], points[3], t);
    const d = interpolate(a, b, t);
    const e = interpolate(b, c, t);
    return [a, d, interpolate(d, e, t)];
  };
  let low = 0;
  let high = 1;
  // Subdivide the original Bezier at the thumb's x coordinate, preserving its shape.
  for (let i = 0; i < 32; i += 1) {
    const t = (low + high) / 2;
    if (split(t)[2][0] < endX) low = t;
    else high = t;
  }
  const [a, b, end] = split((low + high) / 2);
  return `C${a.join(' ')} ${b.join(' ')} ${endX} ${end[1]}`;
}

export default function createRateField(options = {}) {
  const {
    id,
    label,
    required = false,
    suffix = '%',
    value = 5,
    min = 0,
    max = 15,
    step = 1,
    milestones = [0, 5, 10, 15].map((val) => ({ val, text: `${val}%` })),
    onChange,
  } = options;

  if (typeof label !== 'string' || !label.trim()) return null;

  const supportsDecimal = step % 1 !== 0;
  const decimalPlaces = supportsDecimal ? String(step).split('.')[1]?.length || 0 : 0;
  const snapToStep = (num) => {
    let steppedValue = min + (Math.round((num - min) / step) * step);
    if (supportsDecimal) steppedValue = Number(steppedValue.toFixed(decimalPlaces));
    return Math.max(min, Math.min(max, steppedValue));
  };
  let currentValue = snapToStep(value);
  const container = document.createElement('div');
  container.className = 'rate-field';
  container.innerHTML = `
    <div class="slider-header-row">
      <p class="slider-label-text">
        <span class="field-label-copy" id="${id}-label">${label}${required === true ? '<span class="required-star" aria-hidden="true">*</span>' : ''}</span>
      </p>
      <div class="value-display-badge badge-small">
        <input
          type="text"
          id="${id}"
          class="badge-input"
          value="${currentValue}"
          inputmode="${supportsDecimal ? 'decimal' : 'numeric'}"
          autocomplete="off"
          aria-labelledby="${id}-label"
          ${required ? 'required' : ''}
        >
        <span class="badge-affix">${suffix}</span>
      </div>
    </div>

    <div class="wedge-track-wrapper" role="slider" tabindex="0"
      aria-labelledby="${id}-label" aria-valuemin="${min}" aria-valuemax="${max}"
      aria-valuenow="${currentValue}" aria-valuetext="${currentValue}${suffix}">
      <svg class="wedge-svg" viewBox="0 0 253 30" fill="none" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M171.699 14.7506C199.978 13.2151 232.296 10.8022 253 7V18.9427H2.61928e-05H0C0 18.786 5.65554e-06 18.771 1.20082e-05 18.8063C8.62522e-06 18.7634 4.58885e-06 18.7122 0 18.6514C63.1132 17.7388 143.642 16.2741 171.699 14.7506Z" fill="#E9EAEB"/>
        <path class="wedge-active-track" d="M0 0" fill="#FA1432"/>
      </svg>

      <div class="wedge-pill-handle">
        <svg width="17" height="30" viewBox="0 0 17 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <rect width="17" height="30" rx="8.5" fill="url(#paint0_linear_${id})"/>
          <path d="M7.19336 12.6875L7.19336 17.3122" stroke="white" stroke-width="0.663992"/>
          <path d="M9.80859 12.6875L9.80859 17.3122" stroke="white" stroke-width="0.663992"/>
          <defs>
            <linearGradient id="paint0_linear_${id}" x1="20.6705" y1="49.4595" x2="30.2206" y2="6.67356" gradientUnits="userSpaceOnUse">
              <stop stop-color="#E1122D"/>
              <stop offset="0.586538" stop-color="#E1122D"/>
              <stop offset="1" stop-color="#7F2224"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>

    <div class="wedge-scale-row">
      ${milestones.map((milestone) => `<span>${milestone.text}</span>`).join('')}
    </div>
  `;

  const inputEl = container.querySelector('.badge-input');
  const trackWrapper = container.querySelector('.wedge-track-wrapper');
  const activeTrack = container.querySelector('.wedge-active-track');
  const pillHandle = container.querySelector('.wedge-pill-handle');

  function renderTrack() {
    const ratio = Math.max(0, Math.min(1, (currentValue - min) / (max - min)));
    pillHandle.style.left = `${ratio * 100}%`;
    const endX = ratio * 253;
    const firstCurve = [[0, 18.6514], [63.1132, 17.7388], [143.642, 16.2741], [171.699, 14.7506]];
    const secondCurve = [[171.699, 14.7506], [199.978, 13.2151], [232.296, 10.8022], [253, 7]];
    const curve = endX <= 171.699
      ? curvePrefix(firstCurve, endX)
      : `C63.1132 17.7388 143.642 16.2741 171.699 14.7506 ${curvePrefix(secondCurve, endX)}`;
    activeTrack.setAttribute('d', ratio === 0 ? 'M0 0'
      : `M0 18.6514 ${curve} L${endX} 18.9427 H0 Z`);
  }

  function updateValue(num) {
    currentValue = num;
    trackWrapper.setAttribute('aria-valuenow', currentValue);
    trackWrapper.setAttribute('aria-valuetext', `${currentValue}${suffix}`);
    renderTrack();
    if (typeof onChange === 'function') onChange(currentValue);
  }

  function updatePosFromEvent(event) {
    if (event.cancelable) event.preventDefault();
    const rect = trackWrapper.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawVal = min + ratio * (max - min);
    const steppedVal = snapToStep(rawVal);
    inputEl.value = steppedVal;
    updateValue(steppedVal);
  }

  function onStart(event) {
    trackWrapper.focus({ preventScroll: true });
    updatePosFromEvent(event);

    function onMove(moveEvent) {
      updatePosFromEvent(moveEvent);
    }

    function onEnd() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }

  trackWrapper.addEventListener('mousedown', onStart);
  trackWrapper.addEventListener('touchstart', onStart, { passive: false });
  trackWrapper.addEventListener('keydown', (event) => {
    const keyStepMap = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: step * 10,
      PageDown: -step * 10,
    };
    const delta = keyStepMap[event.key];
    if (delta === undefined && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextValue = Math.max(min, Math.min(max, currentValue + delta));
    if (event.key === 'Home') nextValue = min;
    if (event.key === 'End') nextValue = max;
    updateValue(snapToStep(nextValue));
    inputEl.value = currentValue;
  });
  inputEl.addEventListener('focus', () => inputEl.select());

  inputEl.addEventListener('keydown', (event) => {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'];
    if (supportsDecimal && event.key === '.' && !inputEl.value.includes('.')) return;
    if (allowed.includes(event.key) || event.ctrlKey || event.metaKey) {
      if (event.key === 'Enter') inputEl.blur();
      return;
    }
    if (!/^[0-9]$/.test(event.key)) event.preventDefault();
  });

  inputEl.addEventListener('input', () => {
    const sanitizedValue = inputEl.value.replace(/[^0-9.]/g, '');
    const [integer, ...decimals] = sanitizedValue.split('.');
    const cleanVal = supportsDecimal && decimals.length
      ? `${integer}.${decimals.join('')}` : integer;
    inputEl.value = cleanVal;
    if (!cleanVal || cleanVal === '.') return;
    let num = supportsDecimal ? Number(cleanVal) : parseInt(cleanVal, 10);
    if (num > max) num = max;
    updateValue(num);
  });

  inputEl.addEventListener('blur', () => {
    const sanitizedValue = inputEl.value.replace(/[^0-9.]/g, '');
    const [integer, ...decimals] = sanitizedValue.split('.');
    const cleanVal = supportsDecimal && decimals.length
      ? `${integer}.${decimals.join('')}` : integer;
    let num = supportsDecimal ? Number(cleanVal) : parseInt(cleanVal, 10);
    if (Number.isNaN(num) || num < min) num = min;
    if (num > max) num = max;
    num = snapToStep(num);
    inputEl.value = num;
    updateValue(num);
  });

  renderTrack();

  return {
    element: container,
    getValue: () => currentValue,
    setValue: (val) => {
      currentValue = snapToStep(val);
      inputEl.value = currentValue;
      trackWrapper.setAttribute('aria-valuenow', currentValue);
      trackWrapper.setAttribute('aria-valuetext', `${currentValue}${suffix}`);
      renderTrack();
    },
  };
}
