export default function createTobaccoField(options = {}) {
  const {
    id = 'tobaccoUser',
    label,
    required = false,
    infoText = '',
    value = null,
    optionsList = [
      { label: 'No', value: false },
      { label: 'Yes', value: true },
    ],
    onChange,
  } = options;

  if (typeof label !== 'string' || !label.trim()) return null;

  let currentValue = value;
  const [offOption, onOption] = optionsList;
  const container = document.createElement('div');
  container.className = 'tobacco-field';

  const heading = document.createElement('div');
  heading.className = 'tobacco-heading';

  const labelElement = document.createElement('p');
  labelElement.className = 'tobacco-label';
  labelElement.id = `${id}-label`;
  const labelCopy = document.createElement('span');
  labelCopy.className = 'field-label-copy';
  labelCopy.textContent = label;
  labelElement.append(labelCopy);

  if (required) {
    const requiredStar = document.createElement('span');
    requiredStar.className = 'required-star';
    requiredStar.setAttribute('aria-hidden', 'true');
    requiredStar.textContent = '*';
    labelCopy.append(requiredStar);
  }

  if (infoText) {
    const infoIcon = document.createElement('img');
    infoIcon.src = '/icons/information-icon.svg';
    infoIcon.alt = '';
    infoIcon.setAttribute('aria-hidden', 'true');
    infoIcon.title = infoText;
    labelElement.append(infoIcon);
  }

  heading.append(labelElement);

  const control = document.createElement('div');
  control.className = 'tobacco-control';

  const noLabel = document.createElement('span');
  noLabel.className = 'tobacco-choice-label';
  noLabel.textContent = offOption.label;

  const switchLabel = document.createElement('label');
  switchLabel.className = 'tobacco-switch';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.name = id;
  input.setAttribute('role', 'switch');
  input.setAttribute('aria-labelledby', labelElement.id);
  input.setAttribute('aria-checked', String(value === onOption.value));
  if (required) input.setAttribute('aria-required', 'true');
  input.checked = value === onOption.value;

  const track = document.createElement('span');
  track.className = 'tobacco-switch-track';
  switchLabel.append(input, track);

  const yesLabel = document.createElement('span');
  yesLabel.className = 'tobacco-choice-label';
  yesLabel.textContent = onOption.label;

  const updateChoiceLabels = () => {
    noLabel.classList.toggle('is-selected', !input.checked);
    yesLabel.classList.toggle('is-selected', input.checked);
  };

  updateChoiceLabels();

  input.addEventListener('change', () => {
    currentValue = input.checked ? onOption.value : offOption.value;
    input.setAttribute('aria-checked', String(input.checked));
    updateChoiceLabels();
    if (typeof onChange === 'function') onChange(currentValue);
  });

  control.append(noLabel, switchLabel, yesLabel);
  container.append(heading, control);

  return {
    element: container,
    getValue: () => currentValue,
    setValue: (nextValue) => {
      currentValue = nextValue;
      input.checked = currentValue === onOption.value;
      input.setAttribute('aria-checked', String(input.checked));
      updateChoiceLabels();
    },
  };
}
