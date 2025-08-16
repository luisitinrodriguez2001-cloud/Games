import {createEngine} from './core.js';
import {yyyyMMddUTC, seedOf, rng} from './seed.js';

const countries = await fetch('./data/countries.json').then(r=>r.json());
const list = countries.map(c=>c.name);
const SALT = import.meta.env?.VITE_COUNTRIES_SALT || 'countries';

export function newGame({daily=true, attempts=14}={}) {
  let target;
  if (daily) {
    const s = seedOf(yyyyMMddUTC(), 'countries', 'default', SALT);
    target = list[s % list.length];
  } else {
    target = list[Math.floor(rng(Date.now())()*list.length)];
  }
  return createEngine(mode, list, target, attempts);
}

const mode = {
  id: 'countries',
  normalize: s => s.trim(),
  compare: (a,b) => a.localeCompare(b,'en',{sensitivity:'base'}),
  indexOf: (list, v) => list.indexOf(v),
  initialBounds: list => ({top:0, bottom:list.length-1}),
  isValid: v => list.includes(v),
  toLabel: v => v,
  distancePercent: (gi, ti, top, bottom) => {
    const range = bottom - top;
    return range ? Math.round(Math.abs(gi - ti)/range*100) : 0;
  }
};
