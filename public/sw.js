const CACHE = 'betweenlepp-v1';
const ASSETS = [
  '/public/betweenle.html',
  '/public/numbers.html',
  '/public/countries.html',
  '/public/dates.html',
  '/public/pokemon.html',
  '/public/app.js',
  '/public/styles.css'
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
