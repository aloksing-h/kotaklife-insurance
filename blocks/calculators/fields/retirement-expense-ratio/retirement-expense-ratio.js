export default function createRetirementExpenseRatioField(options = {}) {
  const {
    id = 'expPercentInput',
    label,
    required = false,
    value = 75,
    min = 0,
    max = 100,
    step = 1,
    milestones = [
      { val: 0, text: '0%' },
      { val: 100, text: '100%' },
    ],
    onChange,
  } = options;

  if (typeof label !== 'string' || !label.trim()) return null;

  let currentValue = value;

  // Create Container
  const container = document.createElement('div');
  container.className = 'retirement-expense-ratio-box';

  // Build HTML Markup using exact SVG structure
  container.innerHTML = `
    <div class="slider-header-row">
      <p class="slider-label-text">
        <span class="field-label-copy" id="${id}-label">${label}${required === true ? '<span class="required-star" aria-hidden="true">*</span>' : ''}</span>
      </p>
      <div class="value-display-badge badge-small">
        <input type="text" id="${id}" class="badge-input" value="${currentValue}" inputmode="numeric" autocomplete="off" aria-labelledby="${id}-label" ${required ? 'required' : ''}>
        <span class="badge-affix">%</span>
      </div>
    </div>

    <div class="wedge-track-wrapper" role="slider" tabindex="0"
      aria-labelledby="${id}-label" aria-valuemin="${min}" aria-valuemax="${max}"
      aria-valuenow="${currentValue}" aria-valuetext="${currentValue}%">
      <svg class="wedge-svg" viewBox="0 0 585 30" fill="none" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <!-- Inactive Background Track -->
        <path d="M0 17L585 10V20H0V17Z" fill="#E9EAEB"/>
        
        <path class="wedge-active-track" d="M0 0" fill="#FA1432"/>
      </svg>

      <!-- Pill Thumb Handle -->
      <div class="wedge-pill-handle">
        <svg width="17" height="30" viewBox="0 0 17 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <rect width="17" height="30" rx="8.5" fill="url(#paint0_linear_${id})"/>
          <path d="M7.19336 12.6875L7.19336 17.3122" stroke="white" stroke-width="0.663992"/>
          <path d="M9.809 12.6875L9.809 17.3122" stroke="white" stroke-width="0.663992"/>
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
      ${milestones.map((m) => `<span>${m.text}</span>`).join('')}
    </div>
  `;

  const inputEl = container.querySelector('.badge-input');
  const trackWrapper = container.querySelector('.wedge-track-wrapper');
  const activeTrack = container.querySelector('.wedge-active-track');
  const pillHandle = container.querySelector('.wedge-pill-handle');

  function renderTrack() {
    const ratio = Math.max(0, Math.min(1, (currentValue - min) / (max - min)));
    const pct = ratio * 100;

    pillHandle.style.left = `${pct}%`;
    const endX = ratio * 585;
    const endY = 17 - (endX * 7) / 605;
    activeTrack.setAttribute('d', ratio === 0 ? 'M0 0' : `M0 17 L${endX} ${endY} V20 H0 Z`);
  }

  function updateValue(num) {
    currentValue = num;
    trackWrapper.setAttribute('aria-valuenow', currentValue);
    trackWrapper.setAttribute('aria-valuetext', `${currentValue}%`);
    renderTrack();
    if (typeof onChange === 'function') {
      onChange(currentValue);
    }
  }

  // Mouse & Touch Drag Event Handling
  function updatePosFromEvent(e) {
    if (e.cancelable) e.preventDefault();
    const rect = trackWrapper.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawVal = min + ratio * (max - min);
    const steppedVal = Math.round(rawVal / step) * step;

    inputEl.value = steppedVal;
    updateValue(steppedVal);
  }

  function onStart(e) {
    trackWrapper.focus({ preventScroll: true });
    updatePosFromEvent(e);

    function onMove(evt) {
      updatePosFromEvent(evt);
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
    updateValue(Math.round((nextValue - min) / step) * step + min);
    inputEl.value = currentValue;
  });

  // Input Box Sanitization
  inputEl.addEventListener('focus', () => inputEl.select());

  inputEl.addEventListener('keydown', (e) => {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'];
    if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) {
      if (e.key === 'Enter') inputEl.blur();
      return;
    }
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  });

  inputEl.addEventListener('input', () => {
    const cleanVal = inputEl.value.replace(/[^0-9]/g, '');
    if (cleanVal === '') return;
    let num = parseInt(cleanVal, 10);
    if (num > max) num = max;
    updateValue(num);
  });

  inputEl.addEventListener('blur', () => {
    const cleanVal = inputEl.value.replace(/[^0-9]/g, '');
    let num = parseInt(cleanVal, 10);
    if (Number.isNaN(num) || num < min) num = min;
    if (num > max) num = max;
    inputEl.value = num;
    updateValue(num);
  });

  // Initial render
  renderTrack();

  return {
    element: container,
    getValue: () => currentValue,
    setValue: (val) => {
      currentValue = val;
      inputEl.value = val;
      trackWrapper.setAttribute('aria-valuenow', currentValue);
      trackWrapper.setAttribute('aria-valuetext', `${currentValue}%`);
      renderTrack();
    },
  };
}
