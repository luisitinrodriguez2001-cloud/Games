const CACHE = 'sandwichlepp-v3';
const ASSETS = [
  '/public/sandwichle.html',
  '/public/numbers.html',
  '/public/countries.html',
  '/public/dates.html',
  '/public/pokemon.html',
  '/public/app.js',
  '/public/styles.css',
  '/public/data/words/manifest.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.open(CACHE).then(c => c.match(e.request).then(res => {
      const fetcher = fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; });
      return res || fetcher;
    }))
  );
});
