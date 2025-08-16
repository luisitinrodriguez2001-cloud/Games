export function yyyyMMddUTC(date = new Date()) {
  return date.toISOString().slice(0,10).replace(/-/g, '');
}

function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function seedOf(dateStr, mode, category, salt) {
  return fnv1a(`${dateStr}:${mode}:${category}:${salt}`);
}

export function rng(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
