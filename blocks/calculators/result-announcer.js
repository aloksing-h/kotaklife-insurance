export default function createResultAnnouncer(block) {
  const status = document.createElement('p');
  status.className = 'sr-only';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  block.append(status);

  let timeoutId;
  let calculatorIsActive = false;
  const section = block.closest('.section');
  const calculator = block.closest('.calculator-main')
    || section?.querySelector('.calculator-main');
  const activate = () => {
    calculatorIsActive = true;
  };
  ['focusin', 'pointerdown', 'input', 'change'].forEach((eventName) => {
    calculator?.addEventListener(eventName, activate, true);
  });

  return (message) => {
    if (!calculatorIsActive) return;
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      const announcement = message.trim();
      if (announcement && status.textContent !== announcement) {
        status.textContent = announcement;
      }
    }, 600);
  };
}
