export function createEngine(mode, list, target, attempts = 14) {
  const targetIdx = mode.indexOf(list, target);
  const state = {
    list,
    top: mode.initialBounds(list).top,
    bottom: mode.initialBounds(list).bottom,
    target,
    targetIdx,
    attemptsLeft: attempts,
    guesses: [],
    closestIdx: null
  };

  function insertGuess(g) {
    let lo = 0, hi = state.guesses.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (state.guesses[mid].idx < g.idx) lo = mid + 1; else hi = mid;
    }
    state.guesses.splice(lo, 0, g);
  }

  function updateClosest() {
    let best = null;
    state.guesses.forEach((g, i) => {
      const dist = Math.abs(g.idx - state.targetIdx);
      if (best == null || dist < best.dist) {
        best = {i, dist};
      }
    });
    state.closestIdx = best ? best.i : null;
  }

  function guess(raw) {
    if (state.attemptsLeft <= 0) return {done: true};
    const value = mode.normalize(raw);
    if (!mode.isValid(value, list)) {
      return {error: 'invalid'};
    }
    const idx = mode.indexOf(list, value);
    const cmp = mode.compare(value, state.target);
    if (cmp < 0 && idx > state.top) state.top = idx;
    else if (cmp > 0 && idx < state.bottom) state.bottom = idx;
    const distance = mode.distancePercent(idx, state.targetIdx, state.top, state.bottom);
    insertGuess({value, idx, distance});
    updateClosest();
    state.attemptsLeft--;
    const win = cmp === 0;
    const lose = !win && state.attemptsLeft === 0;
    return {win, lose, cmp, distance, state};
  }

  return {state, guess};
}
