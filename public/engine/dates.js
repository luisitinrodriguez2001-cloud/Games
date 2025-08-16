import {createEngine} from './core.js';
import {yyyyMMddUTC, seedOf, rng} from './seed.js';

const START = new Date('2000-01-01T00:00:00Z');
const DAYS = 36525; // 2000-2099
const list = Array.from({length: DAYS}, (_,i)=>{
  const d = new Date(START.getTime() + i*86400000);
  return d.toISOString().slice(0,10);
});
const SALT = import.meta.env?.VITE_DATES_SALT || 'dates';

export function newGame({daily=true, attempts=14}={}) {
  let target;
  if (daily) {
    const s = seedOf(yyyyMMddUTC(), 'dates', 'default', SALT);
    target = list[s % list.length];
  } else {
    target = list[Math.floor(rng(Date.now())()*list.length)];
  }
  return createEngine(mode, list, target, attempts);
}

const mode = {
  id: 'dates',
  normalize: s => s.trim(),
  compare: (a,b) => a.localeCompare(b),
  indexOf: (list, v) => list.indexOf(v),
  initialBounds: list => ({top:0, bottom:list.length-1}),
  isValid: v => list.includes(v),
  toLabel: v => v,
  distancePercent: (gi, ti, top, bottom) => {
    const range = bottom - top;
    return range ? Math.round(Math.abs(gi - ti)/range*100) : 0;
  }
};
