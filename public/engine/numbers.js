import {createEngine} from './core.js';
import {yyyyMMddUTC, seedOf, rng} from './seed.js';

const MIN = 1, MAX = 10000;
const SALT = import.meta.env?.VITE_NUMBERS_SALT || 'numbers';

export function newGame({daily=true, attempts=14}={}) {
  const list = Array.from({length: MAX - MIN + 1}, (_,i)=>MIN+i);
  let target;
  if (daily) {
    const s = seedOf(yyyyMMddUTC(), 'numbers', 'default', SALT);
    target = MIN + (s % (MAX - MIN + 1));
  } else {
    target = MIN + Math.floor(rng(Date.now())() * (MAX - MIN + 1));
  }
  return createEngine(mode, list, target, attempts);
}

const mode = {
  id: 'numbers',
  normalize: s => parseInt(s, 10),
  compare: (a,b) => a - b,
  indexOf: (list, v) => v - MIN,
  initialBounds: list => ({top:0, bottom:list.length-1}),
  isValid: v => Number.isInteger(v) && v >= MIN && v <= MAX,
  toLabel: n => String(n),
  distancePercent: (gi, ti, top, bottom) => {
    const range = bottom - top;
    return range ? Math.round(Math.abs(gi - ti)/range*100) : 0;
  }
};
