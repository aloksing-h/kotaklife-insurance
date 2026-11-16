/**
 * Path: fields/monthly-expense-wave-slider/monthly-expense-wave-slider.js
 */

// Formats raw numbers into Indian currency notation (e.g. 5100000 -> ₹ 51L, 15000000 -> ₹ 1.5Cr)
function formatCurrency(num) {
  if (num >= 10000000) {
    const cr = num / 10000000;
    return `₹ ${Number.isInteger(cr) ? cr : cr.toFixed(1)}Cr`;
  }
  if (num >= 100000) {
    const lac = num / 100000;
    return `₹ ${Number.isInteger(lac) ? lac : lac.toFixed(1)}L`;
  }
  if (num >= 1000) {
    return `₹ ${num / 1000}k`;
  }
  return `₹ ${num}`;
}

export default function createMonthlyExpenseWaveSlider(options = {}) {
  const {
    id = 'waveSlider',
    title = '',
    required = false,
    infoText = '',
    editable = false,
    value = 50,
    min = 0,
    max = 100,
    step = 1,
    milestones = [min, max],
    onChange,
  } = options;

  if (typeof title !== 'string' || !title.trim()) return null;

  const state = { value, isDragging: false };
  let currentRatio = (value - min) / (max - min);
  let targetRatio = currentRatio;
  let animFrame = null;

  const container = document.createElement('div');
  container.className = 'wave-slider-field';
  container.innerHTML = `
    ${title ? `
    <div class="wave-slider-header">
      <p class="wave-slider-title">
        <span class="field-label-copy" id="${id}-label">${title}${required === true ? '<span class="required-star" aria-hidden="true">*</span>' : ''}</span>
        ${infoText ? `
        <button class="wave-slider-info" type="button" aria-label="More information about ${title}"
          aria-describedby="${id}-tooltip">
          <img src="/icons/information-icon.svg" alt="" aria-hidden="true">
          <span class="wave-slider-tooltip" id="${id}-tooltip" role="tooltip">${infoText}</span>
        </button>` : ''}
      </p>
      ${editable ? `
      <div class="wave-slider-value-display badge-expense">
        <span class="badge-affix">₹</span>
        <input type="text" id="${id}-output" class="wave-slider-value-input" value="${value.toLocaleString('en-IN')}" inputmode="numeric" autocomplete="off" aria-labelledby="${id}-label" ${required ? 'required' : ''}>
      </div>` : `
      <div class="wave-slider-value-display" id="${id}-output">${formatCurrency(value)}</div>`}
    </div>` : ''}
    <div class="wave-slider-labels-row" id="${id}-labels"></div>
    <div class="wave-slider-track-wrapper" id="${id}-track" role="slider" tabindex="0"
      aria-labelledby="${id}-label" aria-valuemin="${min}" aria-valuemax="${max}"
      aria-valuenow="${value}" aria-valuetext="${formatCurrency(value)}">
      <svg class="wave-slider-svg-canvas" viewBox="0 0 1000 64" preserveAspectRatio="none" id="${id}-canvas" aria-hidden="true" focusable="false"></svg>
      <div class="wave-slider-baseline-hit-area" aria-hidden="true"></div>
      <div class="wave-slider-thumb-handle" id="${id}-thumb">
        <svg width="17" height="30" viewBox="0 0 17 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <rect width="17" height="30" rx="8.5" fill="url(#${id}-thumbGrad)"/>
          <path d="M7.19336 12.6875L7.19336 17.3122" stroke="white" stroke-width="0.663992"/>
          <path d="M9.80859 12.6875L9.80859 17.3122" stroke="white" stroke-width="0.663992"/>
          <defs>
            <linearGradient id="${id}-thumbGrad" x1="20.6705" y1="49.4595" x2="30.2206" y2="6.67356" gradientUnits="userSpaceOnUse">
              <stop stop-color="#E1122D"/>
              <stop offset="0.586538" stop-color="#E1122D"/>
              <stop offset="1" stop-color="#7F2224"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  `;

  const infoButton = container.querySelector('.wave-slider-info');
  if (infoButton) {
    const tooltip = infoButton.querySelector('.wave-slider-tooltip');
    const positionTooltip = () => {
      const calculator = container.closest('.calculator-main');
      const mobileBounds = !window.matchMedia('(min-width: 900px)').matches
        ? calculator?.getBoundingClientRect() : null;
      const viewportWidth = document.documentElement.clientWidth;
      // Match the inset reserved by the tooltip's CSS max-width.
      const inset = 16;
      const minLeft = Math.max(inset, mobileBounds ? mobileBounds.left + inset : inset);
      const maxRight = Math.min(
        viewportWidth - inset,
        mobileBounds ? mobileBounds.right - inset : viewportWidth - inset,
      );
      tooltip.style.left = '50%';
      tooltip.style.maxWidth = mobileBounds ? `${maxRight - minLeft}px` : '';
      tooltip.classList.remove('is-below');
      const { left, right } = tooltip.getBoundingClientRect();
      const shift = Math.max(minLeft - left, Math.min(0, maxRight - right));
      tooltip.style.left = `calc(50% + ${shift}px)`;
      tooltip.style.setProperty('--tooltip-arrow-left', `${tooltip.offsetWidth / 2 - shift}px`);
      if (mobileBounds && tooltip.getBoundingClientRect().top < mobileBounds.top) {
        tooltip.classList.add('is-below');
      }
    };
    const closeTooltip = () => infoButton.setAttribute('aria-expanded', 'false');
    const openTooltip = () => {
      infoButton.setAttribute('aria-expanded', 'true');
      positionTooltip();
    };

    const resizeObserver = new ResizeObserver(() => {
      if (infoButton.getAttribute('aria-expanded') === 'true') positionTooltip();
    });
    resizeObserver.observe(container);

    closeTooltip();
    infoButton.addEventListener('focus', openTooltip);
    infoButton.addEventListener('blur', closeTooltip);
    infoButton.addEventListener('pointerenter', openTooltip);
    infoButton.addEventListener('pointerleave', () => {
      if (!infoButton.matches(':focus')) closeTooltip();
    });
    infoButton.addEventListener('click', openTooltip);
    infoButton.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeTooltip();
        infoButton.blur();
      }
    });
  }

  const labelsRow = container.querySelector(`#${id}-labels`);
  const trackWrapper = container.querySelector(`#${id}-track`);
  const svgCanvas = container.querySelector(`#${id}-canvas`);
  const thumbHandle = container.querySelector(`#${id}-thumb`);
  const baselineHitArea = container.querySelector('.wave-slider-baseline-hit-area');
  const outputEl = container.querySelector(`#${id}-output`);

  function renderMilestoneLabels() {
    labelsRow.innerHTML = '';
    milestones.forEach((mVal) => {
      const ratio = (mVal - min) / (max - min);
      const pct = Math.max(0, Math.min(1, ratio)) * 100;

      const span = document.createElement('span');
      span.className = 'wave-slider-milestone-label';
      span.dataset.value = mVal;
      span.style.left = `${pct}%`;
      span.textContent = formatCurrency(mVal);

      if (pct === 0) span.style.transform = 'translateX(0%)';
      if (pct === 100) span.style.transform = 'translateX(-100%)';

      labelsRow.appendChild(span);
    });
  }

  function renderFrame() {
    const xCenter = currentRatio * 1000;
    thumbHandle.style.left = `${currentRatio * 100}%`;

    const baselineY = 55;
    const waveAmplitude = 18;
    const sigma = 70;

    // Smooth Gaussian wave curve points across the viewBox
    const wavePoints = [];
    const steps = 120;
    for (let i = 0; i <= steps; i += 1) {
      const x = (i / steps) * 1000;
      const dist = Math.abs(x - xCenter);
      const y = baselineY - waveAmplitude * Math.exp(-((dist / sigma) ** 2));
      wavePoints.push(`${x},${y}`);
    }

    const curvePathD = `M 0,${baselineY} L ${wavePoints.join(' L ')} L 1000,${baselineY}`;
    // Arching ruler ticks with a visible gap above the wave line
    let ticksSvg = '';
    const totalTicks = 85;
    for (let i = 0; i <= totalTicks; i += 1) {
      const x = (i / totalTicks) * 1000;
      const dist = Math.abs(x - xCenter);
      const waveYAtX = baselineY - waveAmplitude * Math.exp(-((dist / sigma) ** 2));

      const baseTickHeight = (i % 4 === 0) ? 11.5 : 7.2;
      const archBonus = 12 * Math.exp(-((dist / 75) ** 2));
      const totalTickHeight = baseTickHeight + archBonus;

      const yBottom = waveYAtX - 3.0;
      const yTop = yBottom - totalTickHeight;
      const strokeWidth = (i % 4 === 0) ? 1.0 : 0.77;

      ticksSvg += `<line x1="${x}" y1="${yTop}" x2="${x}" y2="${yBottom}" stroke="#d2dae4" stroke-width="${strokeWidth}" stroke-linecap="round" />`;
    }

    labelsRow.querySelectorAll('.wave-slider-milestone-label').forEach((lbl) => {
      const val = parseFloat(lbl.dataset.value);
      if (Math.abs(state.value - val) < (max - min) * 0.02) {
        lbl.classList.add('active');
      } else {
        lbl.classList.remove('active');
      }
    });

    svgCanvas.innerHTML = `
      <defs>
        <linearGradient id="${id}-curveGlow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#dc2626" stop-opacity="0.25" />
          <stop offset="100%" stop-color="#dc2626" stop-opacity="0.0" />
        </linearGradient>
        <linearGradient id="${id}-centerRedWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#e9eaeb" />
          <stop offset="${Math.max(0, currentRatio - 0.15)}" stop-color="#e9eaeb" />
          <stop offset="${Math.max(0, currentRatio - 0.05)}" stop-color="#fa1432" />
          <stop offset="${currentRatio}" stop-color="#dc2626" />
          <stop offset="${Math.min(1, currentRatio + 0.05)}" stop-color="#fa1432" />
          <stop offset="${Math.min(1, currentRatio + 0.15)}" stop-color="#e9eaeb" />
          <stop offset="100%" stop-color="#e9eaeb" />
        </linearGradient>
      </defs>
      <line x1="0" y1="62" x2="1000" y2="62" stroke="#b2ddff" stroke-width="0.8" stroke-dasharray="5.39,5.39" />
      <path d="${curvePathD}" fill="none" stroke="url(#${id}-centerRedWaveGrad)" stroke-width="2" stroke-linecap="round" />
      <g>${ticksSvg}</g>
    `;
  }

  function triggerAnimation() {
    if (animFrame) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      currentRatio = targetRatio;
      renderFrame();
      return;
    }
    const animate = () => {
      const diff = targetRatio - currentRatio;
      if (Math.abs(diff) > 0.0005) {
        currentRatio += diff * 0.3;
        renderFrame();
        animFrame = requestAnimationFrame(animate);
      } else {
        currentRatio = targetRatio;
        renderFrame();
        animFrame = null;
      }
    };
    animFrame = requestAnimationFrame(animate);
  }

  function updateOutputDisplay(val) {
    if (!outputEl) return;
    if (editable) {
      outputEl.value = val.toLocaleString('en-IN');
    } else {
      outputEl.textContent = formatCurrency(val);
    }
  }

  function setValueInternal(val, { silent = false, updateDisplay = true } = {}) {
    state.value = val;
    targetRatio = (val - min) / (max - min);
    trackWrapper.setAttribute('aria-valuenow', val);
    trackWrapper.setAttribute('aria-valuetext', formatCurrency(val));
    if (updateDisplay) updateOutputDisplay(val);
    triggerAnimation();
    if (!silent && typeof onChange === 'function') onChange(val, formatCurrency(val));
  }

  function updateFromRatio(ratio) {
    const rawVal = min + ratio * (max - min);
    const steppedVal = Math.round(rawVal / step) * step;
    const clampedVal = Math.max(min, Math.min(max, steppedVal));
    setValueInternal(clampedVal);
  }

  function onMove(e) {
    if (e.cancelable) e.preventDefault();
    const rect = trackWrapper.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    updateFromRatio(ratio);
  }

  function onStart(e) {
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (e.cancelable) e.preventDefault();
    trackWrapper.focus({ preventScroll: true });
    state.isDragging = true;
    if (e.currentTarget === baselineHitArea) onMove(e);

    const onEnd = () => {
      state.isDragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
  }

  thumbHandle.addEventListener('mousedown', onStart);
  thumbHandle.addEventListener('touchstart', onStart, { passive: false });
  baselineHitArea.addEventListener('mousedown', onStart);
  baselineHitArea.addEventListener('touchstart', onStart, { passive: false });

  trackWrapper.addEventListener('keydown', (e) => {
    const keyStepMap = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: step * 10,
      PageDown: -step * 10,
    };
    const delta = keyStepMap[e.key];
    if (delta === undefined && !['Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    let nextVal = Math.max(min, Math.min(max, state.value + delta));
    if (e.key === 'Home') nextVal = min;
    if (e.key === 'End') nextVal = max;
    setValueInternal(nextVal);
  });

  if (editable && outputEl) {
    outputEl.addEventListener('focus', () => outputEl.select());

    outputEl.addEventListener('input', () => {
      outputEl.value = outputEl.value.replace(/[^0-9]/g, '');
      const num = parseInt(outputEl.value, 10);
      if (Number.isNaN(num)) return;
      setValueInternal(Math.max(min, Math.min(max, num)), { updateDisplay: false });
    });

    outputEl.addEventListener('blur', () => {
      let num = parseInt(outputEl.value.replace(/[^0-9]/g, ''), 10);
      if (Number.isNaN(num)) num = min;
      num = Math.max(min, Math.min(max, num));
      setValueInternal(num);
    });

    outputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') outputEl.blur();
    });
  }

  renderMilestoneLabels();
  setValueInternal(value, { silent: true });
  currentRatio = targetRatio;
  renderFrame();

  return {
    element: container,
    getValue: () => state.value,
    setValue: (val) => setValueInternal(val, { silent: true }),
  };
}
