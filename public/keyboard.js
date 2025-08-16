export function createKeyboard(container, {onLetter, onEnter, onBackspace} = {}) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const buttons = {};
  const keyboardEl = container;
  keyboardEl.classList.add('flex', 'flex-wrap', 'gap-2', 'justify-center');

  letters.split('').forEach(ch => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = ch;
    btn.className = 'px-2 py-1 rounded bg-gray-800 text-gray-100';
    btn.addEventListener('click', () => onLetter?.(ch));
    buttons[ch] = btn;
    keyboardEl.appendChild(btn);
  });

  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = 'Backspace';
  back.className = 'px-2 py-1 rounded bg-gray-800 text-gray-100';
  back.addEventListener('click', () => onBackspace?.());
  keyboardEl.appendChild(back);

  const guess = document.createElement('button');
  guess.type = 'button';
  guess.textContent = 'Guess';
  guess.className = 'px-2 py-1 rounded bg-green-500 text-gray-900 font-semibold';
  guess.addEventListener('click', () => onEnter?.());
  keyboardEl.appendChild(guess);

  function update(state, guess = '') {
    const topWord = state.list[state.top];
    const bottomWord = state.list[state.bottom];
    const len = guess.length;
    for (const ch of letters) {
      const btn = buttons[ch];
      let disabled = len >= 5;
      if (!disabled) {
        const min = (guess + ch + 'a'.repeat(5 - len - 1));
        const max = (guess + ch + 'z'.repeat(5 - len - 1));
        if (max <= topWord || min >= bottomWord) disabled = true;
      }
      btn.disabled = disabled;
    }
    back.disabled = len === 0;
    guess.disabled = len !== 5;
  }

  return {update};
}
