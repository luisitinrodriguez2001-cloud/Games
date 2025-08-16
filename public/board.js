export function createBoard(container) {
  const boardEl = container;
  boardEl.classList.add('board');

  function render(state, guess) {
    boardEl.innerHTML = '';
    const rows = [];
    // top cue
    rows.push({word: state.list[state.top], idx: state.top, cue: true});
    // current in-progress guess
    if (guess !== undefined) {
      rows.push({word: guess});
    }
    // bottom cue
    rows.push({word: state.list[state.bottom], idx: state.bottom, cue: true});

    rows.forEach(item => {
      const row = document.createElement('div');
      row.className = 'board-row';
      if (item.cue) row.classList.add('cue');
      if (item.win) row.classList.add('win');
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
      if (typeof item.idx === 'number') {
        const idx = document.createElement('span');
        idx.className = 'board-hint-distance';
        idx.textContent = `#${item.idx+1}`;
        hint.appendChild(idx);
      }
      row.appendChild(hint);
      boardEl.appendChild(row);
    });
  }

  return { render };
}
