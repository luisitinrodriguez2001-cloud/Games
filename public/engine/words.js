import {createEngine} from './core.js';
import {yyyyMMddUTC, seedOf, rng} from './seed.js';

const MANIFEST_URL = new URL('../data/words/manifest.json', import.meta.url);
let manifestCache = null;

export let trophyReward = 1;

export function getAttemptSettings(len) {
  if (len > 1000) return {attempts: 20, trophyReward: 5};
  if (len > 500) return {attempts: 15, trophyReward: 4};
  if (len > 250) return {attempts: 10, trophyReward: 3};
  if (len > 100) return {attempts: 5, trophyReward: 2};
  if (len <= 50) return {attempts: 3, trophyReward: 1};
  return {attempts: 4, trophyReward: 2};
}

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
  // Some of the word lists include a header row such as "word".  The
  // gameplay engine expects a simple list of words, so remove a leading
  // header if present to avoid treating it as an actual guessable word.
  if (list[0]?.toLowerCase() === 'word') {
    list.shift();
  }
  const norm = list
    .map(s => s.normalize('NFC').toLowerCase())
    .filter(w => /^[a-z]+$/.test(w));
  const uniq = Array.from(new Set(norm));
  const targetLen = uniq[0]?.length || 0;
  const filtered = uniq.filter(w => w.length === targetLen);
  if (filtered.length !== uniq.length) {
    throw new Error('Category requires all words to be the same length');
  }
  try {
    const extra = JSON.parse(localStorage.getItem(`sandwichle-custom-${slug}`) || '[]');
    extra.forEach(w => {
      const v = w.normalize('NFC').toLowerCase();
      if (v.length === targetLen && /^[a-z]+$/.test(v) && !filtered.includes(v)) {
        filtered.push(v);
      }
    });
  } catch (e) {
    // ignore
  }
  filtered.sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'}));
  return {list: filtered, info};
}

const SALT = import.meta.env?.VITE_WORDS_SALT || 'words';

export async function newGame({daily=true, category='general'}={}) {
  const {list} = await loadList(category);
  const len = list.length;
  const settings = getAttemptSettings(len);
  trophyReward = settings.trophyReward;
  const attempts = settings.attempts;
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
