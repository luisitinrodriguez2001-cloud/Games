export function createBoard(container) {
  const boardEl = container;
  boardEl.classList.add('board');

  function render(state) {
    boardEl.innerHTML = '';
    const items = [];
    const first = state.list[0];
    const last = state.list[state.list.length - 1];
    items.push(first);
    state.guesses.forEach(g => items.push(g.value));
    items.push(last);

    items.forEach(word => {
      const row = document.createElement('div');
      row.className = 'board-row';
      for (let i = 0; i < 5; i++) {
        const tile = document.createElement('div');
        tile.className = 'board-tile';
        tile.textContent = word[i] ? word[i].toUpperCase() : '';
        row.appendChild(tile);
      }
      boardEl.appendChild(row);
    });
  }

  return { render };
}
