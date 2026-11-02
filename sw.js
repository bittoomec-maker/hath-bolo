/* Hath Bolo — offline cache for the web version (not used inside the native apps). */
const CACHE = 'hath-bolo-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/config.js', 'js/engine.js', 'js/i18n.js', 'js/fx.js', 'js/app.js',
  'img/icon.svg', 'img/icon-192.png', 'img/icon-512.png', 'img/apple-touch-icon.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/ws') || u.pathname.startsWith('/download')) return;
  // network first (so updates show up), cache as offline fallback
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
