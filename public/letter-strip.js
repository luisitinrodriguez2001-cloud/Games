export function createLetterStrip(container) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const spans = {};
  container.classList.add('flex', 'justify-center', 'gap-1', 'text-xs', 'mb-1');
  letters.split('').forEach(ch => {
    const span = document.createElement('span');
    span.textContent = ch;
    spans[ch] = span;
    container.appendChild(span);
  });
  function update(state) {
    const topWord = state.list[state.top];
    const bottomWord = state.list[state.bottom];
    const len = topWord.length;
    for (const ch of letters) {
      const chLower = ch.toLowerCase();
      const min = chLower + 'a'.repeat(len - 1);
      const max = chLower + 'z'.repeat(len - 1);
      const allowed = !(max <= topWord || min >= bottomWord);
      spans[ch].className = allowed ? '' : 'opacity-25';
    }
  }
  return { update };
}
