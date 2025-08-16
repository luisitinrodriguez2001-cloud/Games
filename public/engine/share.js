export function encodeShare(guesses, targetIdx) {
  return guesses.map(g => {
    if (g.idx === targetIdx) return '🎯';
    const dir = g.idx < targetIdx ? '↑' : '↓';
    const dots = Math.max(1, Math.round((100 - g.distance) / 20));
    return dir + '•'.repeat(dots);
  }).join('\n');
}
