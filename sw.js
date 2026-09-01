// Service Worker — Agent Medina
// Estratègia: "cache first, network fallback" per a l'app shell, perquè
// l'app d'estudi funcioni sense connexió un cop carregada una vegada.
// El progrés de l'usuari NO es guarda aquí (va a localStorage), aquest
// fitxer només serveix per fer l'app instal·lable i disponible offline.

const CACHE_NAME = 'agent-medina-cache-v4';

const FITXERS_APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './Mossos_Preguntas.js',
  './P_L_Preguntas.js',
  './Actualidad_preguntas.js',
  './index-BNhYZkE9.css',
  './Dashboard-BJqoIV_6.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './Escut.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Fem servir "allSettled" per no fer fallar tota la instal·lació
      // si algun fitxer opcional encara no existeix (p.ex. preguntas_pl.js).
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

  event.respondWith(
    caches.match(event.request).then((resposta) => {
      if (resposta) return resposta;

      return fetch(event.request)
        .then((res) => {
          // Guardem còpia a la cau per a properes visites offline (només respostes vàlides).
          if (res && res.status === 200 && res.type === 'basic') {
            const copia = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return res;
        })
        .catch(() => {
          // Si no hi ha xarxa i tampoc a cau, i és una navegació de pàgina, servim l'index.
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return undefined;
        });
    })
  );
});
