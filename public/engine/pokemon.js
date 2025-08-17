import {createEngine} from './core.js';
import {yyyyMMddUTC, seedOf, rng} from './seed.js';

const pokemon = await fetch('./data/pokemon.json').then(r=>r.json());
const list = pokemon.map(p=>p.name.toLowerCase());
const SALT = import.meta.env?.VITE_POKEMON_SALT || 'pokemon';

export function newGame({daily=true, attempts=14}={}) {
  let idx;
  if (daily) {
    const s = seedOf(yyyyMMddUTC(), 'pokemon', 'default', SALT);
    idx = 1 + (s % (list.length - 2));
  } else {
    idx = 1 + Math.floor(rng(Date.now())() * (list.length - 2));
  }
  const target = list[idx];
  return createEngine(mode, list, target, attempts);
}

const mode = {
  id: 'pokemon',
  normalize: s => s.trim().toLowerCase(),
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
