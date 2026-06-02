const CACHE = 'gdy-v1';
const URLS = ['index.html','css/style.css','js/config.js','js/cards.js','js/rules.js','js/ai.js','js/game.js','js/ui.js','manifest.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});