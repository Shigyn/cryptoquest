'use strict';
// Service worker : le jeu s'ouvre même sans réseau.
// Réseau d'abord (une mise à jour s'affiche tout de suite), cache en secours quand on est hors ligne.
// Changer VERSION à chaque livraison pour forcer le renouvellement complet.
const VERSION = 'cq-ui-15';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/data.js', './js/state.js', './js/engine.js', './js/economy.js', './js/ui.js', './js/pages.js', './js/hero.js', './js/forge.js', './js/content.js',
  './js/auction.js', './js/market.js', './js/stones.js', './js/arena.js', './js/comfort.js', './js/premium.js', './js/guild.js', './js/abyss.js', './js/team.js', './js/season.js', './js/cloud-config.js', './js/cloud.js', './js/progress.js', './js/town.js', './js/townart.js', './js/hud.js', './js/interiors.js', './js/herohub.js', './js/worldmap.js', './js/combatui.js', './js/shell.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/favicon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(caches.open(VERSION).then((cache) => fetch(req).then((res) => {
    // polices Google (réponses opaques) comprises
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => cache.match(req, { ignoreSearch: true }))));
});
// clic sur une notification : revenir au jeu
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow('./index.html'))));
});
