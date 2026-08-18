/* Service worker — lets the prototype open with no signal.

   IMPORTANT: this is deliberately "network first" for the page itself.
   An earlier version cached the page and kept serving it, so testers went on
   seeing an old build after a new one was uploaded. Now the newest page is
   fetched whenever there is a connection, and the cached copy is used only
   when there is not. */

const BUILD = '20260818-1332';                 // replaced at build time
const CACHE = 'trichy-asset-trial-' + BUILD;
const SHELL = ['./', './index.html', './manifest.webmanifest', './config.json',
               './assets/icons/icon-192.png', './assets/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // settings must always be the newest, never the cached copy
  if (/config\.json/.test(e.request.url)) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request)));
    return;
  }

  const isPage = e.request.mode === 'navigate' ||
                 (e.request.destination === 'document') ||
                 /index\.html($|\?)/.test(e.request.url);

  if (isPage) {
    // newest page when online, cached page when not
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
