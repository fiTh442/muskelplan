/* Muskelplan – Service Worker für den Offline-Betrieb
   App-Seite: Netz zuerst (immer die neueste Version), nach 3 s oder ohne Netz aus dem Cache.
   Übrige Dateien (Manifest, Symbole): Cache zuerst.
   Trainingsdaten liegen NICHT hier, sondern im localStorage der Seite. */
'use strict';
const CACHE = 'muskelplan-v2';
const PAGE = './index.html';
const ASSETS = [PAGE, './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('muskelplan-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function offline() {
  return new Response('Muskelplan ist offline noch nicht verfügbar – bitte einmal mit Internetverbindung öffnen.',
    { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function page() {
  const cache = await caches.open(CACHE);
  const net = fetch(PAGE, { cache: 'no-cache' }).then(res => {
    if (res.ok) cache.put(PAGE, res.clone()).catch(() => {});
    return res;
  });
  try {
    const res = await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))]);
    if (res.ok) return res;
  } catch (e) { /* langsames oder kein Netz → Cache */ }
  return (await cache.match(PAGE)) || (await net.catch(() => null)) || offline();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(page()); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
    return res;
  })));
});
