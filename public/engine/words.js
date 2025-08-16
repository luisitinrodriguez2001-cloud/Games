import {createEngine} from './core.js';
import {yyyyMMddUTC, seedOf, rng} from './seed.js';

const allow = (await fetch('./data/words-allow.txt').then(r=>r.text())).trim().split(/\s+/);
const solutions = (await fetch('./data/words-solution.txt').then(r=>r.text())).trim().split(/\s+/);

const SALT = import.meta.env?.VITE_WORDS_SALT || 'words';

export function newGame({daily=true, attempts=14}={}) {
  let idx;
  if (daily) {
    const s = seedOf(yyyyMMddUTC(), 'words', 'general', SALT);
    idx = s % solutions.length;
  } else {
    idx = Math.floor(rng(Date.now())()*solutions.length);
  }
  const target = solutions[idx];
  return createEngine(mode, solutions, target, attempts);
}

const mode = {
  id: 'words',
  normalize: s => s.normalize('NFC').toLowerCase(),
  compare: (a,b) => a.localeCompare(b),
  indexOf: (list, v) => list.indexOf(v),
  initialBounds: list => ({top:0, bottom:list.length-1}),
  randomSecret: (list, seed) => list[Math.floor(seed*list.length)],
  isValid: (v) => allow.includes(v),
  toLabel: w => w,
  distancePercent: (gi, ti, top, bottom) => {
    const range = bottom - top;
    return range ? Math.round(Math.abs(gi - ti)/range*100) : 0;
  }
};
