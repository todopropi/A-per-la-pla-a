// Service Worker — Agent Medina
// Estratègia: "cache first, network fallback" per a l'app shell, perquè
// l'app d'estudi funcioni sense connexió un cop carregada una vegada.
// El progrés de l'usuari NO es guarda aquí (va a localStorage), aquest
// fitxer només serveix per fer l'app instal·lable i disponible offline.

const CACHE_NAME = 'agent-medina-cache-v6';

const FITXERS_APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './firebase-sync.js',
  './Mossos_Preguntas.js',
  './P_L_Preguntas.js',
  './Actualidad_preguntas.js',
  './index-BNhYZkE9.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './Escut.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        FITXERS_APP_SHELL.map((url) => cache.add(url).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((claus) =>
      Promise.all(
        claus.filter((clau) => clau !== CACHE_NAME).map((clau) => caches.delete(clau))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  // Firebase i APIs dinàmiques
  if (
    url.includes('googleapis.com') ||
    url.includes('firebaseio.com') ||
    url.includes('firebaseapp.com') ||
    url.includes('accounts.google.com') ||
    url.includes('/api/')
  ) {
    return;
  }

  // Estratègia Network-First: primer demana a la xarxa per veure canvis immediats,
  // si no hi ha connexió (offline), fa fallback a la cau.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        }
        return res;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return undefined;
        });
      })
  );
});
