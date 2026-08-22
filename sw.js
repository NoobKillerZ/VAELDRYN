/* Service worker de VAELDRYN: cache-first para jugar sin conexión */
'use strict';

var CACHE = 'vaeldryn-v1';
var CORE = [
  './',
  './index.html',
  './css/style.css',
  './js/artkit.js',
  './js/audio.js',
  './js/config.js',
  './js/director.js',
  './js/enemies.js',
  './js/game.js',
  './js/main.js',
  './js/maps.js',
  './js/progress.js',
  './js/relics.js',
  './js/towers.js',
  './js/waves.js',
  './js/weather.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (resp) {
        if (resp.ok && resp.type === 'basic') {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return resp;
      }).catch(function () { return caches.match('./'); });
    })
  );
});
