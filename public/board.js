export function createBoard(container) {
  const CLOSE_THRESHOLD = 5; // percent
  const boardEl = container;
  boardEl.classList.add('board');

  function render(state) {
    boardEl.innerHTML = '';
    const rows = [];
    rows.push({word: state.list[0]});
    state.guesses.forEach(g => {
      const distance = Math.round(
        Math.abs(g.idx - state.targetIdx) / state.list.length * 100
      );
      rows.push({
        word: g.value,
        arrow: g.idx < state.targetIdx ? '↑' : g.idx > state.targetIdx ? '↓' : '',
        distance,
        close: distance < CLOSE_THRESHOLD
      });
    });
    rows.push({word: state.list[state.list.length - 1]});

    rows.forEach(item => {
      const row = document.createElement('div');
      row.className = 'board-row';
      for (let i = 0; i < 5; i++) {
        const tile = document.createElement('div');
        tile.className = 'board-tile';
        tile.textContent = item.word[i] ? item.word[i].toUpperCase() : '';
        row.appendChild(tile);
      }
      const hint = document.createElement('div');
      hint.className = 'board-hint';
      if (item.arrow) {
        const arrow = document.createElement('span');
        arrow.className = 'board-hint-arrow';
        arrow.textContent = item.arrow;
        hint.appendChild(arrow);
      }
      if (typeof item.distance === 'number') {
        const dist = document.createElement('span');
        dist.className = 'board-hint-distance';
        dist.textContent = `${item.distance}%`;
        hint.appendChild(dist);
        if (item.close) {
          const dot = document.createElement('span');
          dot.className = 'board-hint-close';
          dot.textContent = '•';
          hint.appendChild(dot);
        }
      }
      row.appendChild(hint);
      boardEl.appendChild(row);
    });
  }

  return { render };
}
