export const GUESS_BANDS = [5, 3, 3, 2, 1];

export const BAND_COLORS = [
  'bg-green-500',
  'bg-sky-500',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-red-500'
];

export function getBandForGuess(count) {
  let total = 0;
  for (let i = 0; i < GUESS_BANDS.length; i++) {
    total += GUESS_BANDS[i];
    if (count <= total) {
      return i;
    }
  }
  return GUESS_BANDS.length - 1;
}

export function getScoreForGuess(count) {
  const band = getBandForGuess(count);
  return GUESS_BANDS.length - band;
}
