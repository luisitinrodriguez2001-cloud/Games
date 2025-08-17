export function createKeyboard(container, {onLetter, onEnter, onBackspace} = {}) {
  // use lowercase internally so range comparisons align with the word list
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const letters = rows.join('');
  const buttons = {};
  const keyboardEl = container;
  keyboardEl.classList.add('flex', 'flex-col');

  rows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.classList.add('flex', 'gap-2', 'justify-center');
    row.split('').forEach(ch => {
      const btn = document.createElement('button');
      btn.type = 'button';
      // display letters in uppercase for readability
      btn.textContent = ch.toUpperCase();
      btn.className = 'px-2 py-1 rounded bg-gray-800 text-gray-100';
      // pass the lowercase letter to the callback
      btn.addEventListener('click', () => onLetter?.(ch));
      buttons[ch] = btn;
      rowEl.appendChild(btn);
    });
    keyboardEl.appendChild(rowEl);
  });

  const backRow = document.createElement('div');
  backRow.classList.add('flex', 'justify-center');
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = 'Backspace';
  back.className = 'px-2 py-1 rounded bg-gray-800 text-gray-100';
  back.addEventListener('click', () => onBackspace?.());
  backRow.appendChild(back);
  keyboardEl.appendChild(backRow);

  const enterRow = document.createElement('div');
  enterRow.classList.add('flex', 'justify-center');
  const enter = document.createElement('button');
  enter.type = 'button';
  enter.textContent = 'Enter';
  enter.className = 'px-2 py-1 rounded bg-green-500 text-gray-900 font-semibold';
  enter.addEventListener('click', () => onEnter?.());
  enterRow.appendChild(enter);
  keyboardEl.appendChild(enterRow);

  function update(state, guess = '') {
    const topWord = state.list[state.top];
    const bottomWord = state.list[state.bottom];
    const len = guess.length;
    for (const ch of letters) {
      const btn = buttons[ch];
      let disabled = len >= 5;
      if (!disabled) {
        // ch is already lowercase; build bounds using lowercase alphabet
        const min = guess + ch + 'a'.repeat(5 - len - 1);
        const max = guess + ch + 'z'.repeat(5 - len - 1);
        if (max <= topWord || min >= bottomWord) disabled = true;
      }
      btn.disabled = disabled;
    }
    back.disabled = len === 0;
    enter.disabled = len !== 5;
  }

  return {update};
}
