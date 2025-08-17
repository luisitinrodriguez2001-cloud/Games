import {createEngine} from './core.js';
import {yyyyMMddUTC, seedOf, rng} from './seed.js';

const MANIFEST_URL = new URL('../data/words/manifest.json', import.meta.url);
let manifestCache = null;

export async function loadManifest() {
  if (!manifestCache) {
    manifestCache = await fetch(MANIFEST_URL).then(r => r.json());
  }
  return manifestCache;
}

async function loadList(slug) {
  const manifest = await loadManifest();
  const info = manifest[slug];
  if (!info) throw new Error('Unknown category');
  const dataUrl = new URL(info.file, MANIFEST_URL);
  const text = await fetch(dataUrl).then(r => r.text());
  const list = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const norm = list
    .map(s => s.normalize('NFC').toLowerCase())
    .filter(w => /^[a-z]+$/.test(w));
  const uniq = Array.from(new Set(norm));
  const targetLen = uniq[0]?.length || 0;
  const filtered = uniq.filter(w => w.length === targetLen);
  if (filtered.length !== uniq.length) {
    throw new Error('Category requires all words to be the same length');
  }
  filtered.sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'}));
  return {list: filtered, info};
}

const SALT = import.meta.env?.VITE_WORDS_SALT || 'words';

export async function newGame({daily=true, attempts=14, category='general'}={}) {
  const {list} = await loadList(category);
  let idx;
  if (daily) {
    const s = seedOf(yyyyMMddUTC(), 'words', category, SALT);
    idx = s % list.length;
  } else {
    idx = Math.floor(rng(Date.now())()*list.length);
  }
  const target = list[idx];

  const mode = {
    id: 'words',
    normalize: s => s.normalize('NFC').toLowerCase(),
    compare: (a,b) => a.localeCompare(b),
    indexOf: (lst, v) => lst.indexOf(v),
    initialBounds: lst => ({top:0, bottom:lst.length-1}),
    randomSecret: (lst, seed) => lst[Math.floor(seed*lst.length)],
    isValid: (v, lst) => lst.includes(v),
    toLabel: w => w,
    distancePercent: (gi, ti, top, bottom) => {
      const range = bottom - top;
      return range ? Math.round(Math.abs(gi - ti)/range*100) : 0;
    }
  };
  return createEngine(mode, list, target, attempts);
}
