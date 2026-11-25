const CACHE = 'kidlog-v1';

const STATIC = [
  '.',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/data.js',
  'js/store.js',
  'js/lib/pdf.js',
  'js/utils/coverage.js',
  'js/views/daily.js',
  'js/views/weekly.js',
  'js/views/report.js',
  'js/views/profiles.js',
  'js/views/log.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only handle same-origin GET requests
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
