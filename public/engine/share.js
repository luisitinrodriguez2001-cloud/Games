export function encodeShare(guesses, targetIdx) {
  return guesses.map(g => {
    const dir = g.idx === targetIdx ? '🎯' : g.idx < targetIdx ? '⬆️' : '⬇️';
    const blocks = Math.max(1, Math.round((100 - g.distance)/20));
    return dir + '▮'.repeat(blocks);
  }).join('\n');
}
