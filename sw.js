// ============================================================
//  Service Worker — Kevine Anniversaire
//  v3 — Corrigé : pré-cache complet + hors ligne garanti
// ============================================================

const CACHE_NAME  = 'kevine-aniv-v3';
const FONTS_CACHE = 'kevine-fonts-v3';

const LOCAL_ASSETS = [
  './', '/index.html', '/manifest.json',
  '/detect-devtools.js',
  '/css/style.css',
  '/fonts/css.css', '/fonts/local.css', '/fonts/google-local.css',
  '/js/script.js', '/js/Stage.js', '/js/MyMath.js', '/js/fscreen.js',
  '/images/og-image.png', '/images/icon-192.png', '/images/icon-512.png', '/images/screen.png',
  '/images/b1.webp','/images/b2.webp','/images/b3.webp','/images/b4.webp','/images/b5.webp',
  '/images/b6.webp','/images/b7.webp','/images/b8.webp','/images/b9.webp','/images/b10.webp',
  '/images/b11.webp','/images/b12.webp','/images/b13.webp','/images/b14.webp','/images/b15.webp',
  '/audio/burst1.mp3','/audio/burst2.mp3','/audio/burst-sm-1.mp3','/audio/burst-sm-2.mp3',
  '/audio/crackle1.mp3','/audio/crackle-sm-1.mp3',
  '/audio/lift1.mp3','/audio/lift2.mp3','/audio/lift3.mp3',
  '/music/music.mp3'
];

// ---- INSTALLATION : pré-cache tous les assets locaux ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // allSettled évite qu'un échec bloque tout le pré-cache
      Promise.allSettled(
        LOCAL_ASSETS.map(url =>
          cache.add(url).catch(e => console.warn('[SW] Cache miss:', url, e.message))
        )
      )
    ).then(() => {
      console.log('[SW] Installation terminée — v3');
      return self.skipWaiting();
    })
  );
});

// ---- ACTIVATION : nettoie les anciens caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== FONTS_CACHE)
          .map(k => {
            console.log('[SW] Suppression ancien cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => {
      console.log('[SW] Activation terminée — prise de contrôle immédiate');
      return self.clients.claim();
    })
  );
});

// ---- FETCH : stratégie selon la ressource ----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Google Fonts → Cache-First (mis en cache dès la 1ère visite)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(handleFonts(event.request));
    return;
  }

  // CDN externes (clippy, etc.) → Network-First avec fallback cache
  if (url.hostname !== self.location.hostname && url.protocol.startsWith('http')) {
    event.respondWith(handleExternal(event.request));
    return;
  }

  // Assets locaux → Cache-First (rapide + hors ligne)
  event.respondWith(handleLocal(event.request));
});

// ---- Gestion des polices Google (Cache-First) ----
async function handleFonts(request) {
  const cache = await caches.open(FONTS_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // Hors ligne et non encore mis en cache : retourner un CSS vide
    return new Response('/* police hors ligne — substitution locale active */', {
      headers: { 'Content-Type': 'text/css' }
    });
  }
}

// ---- Gestion des CDN externes (Network-First) ----
async function handleExternal(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('', { status: 503 });
  }
}

// ---- Gestion des assets locaux (Cache-First) ----
async function handleLocal(request) {
  const cache = await caches.open(CACHE_NAME);

  // Essai dans le cache d'abord
  const cached = await cache.match(request);
  if (cached) return cached;

  // Pas en cache → tenter le réseau et mettre en cache
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // Hors ligne et non en cache
    if (request.mode === 'navigate') {
      // Retourner la page principale depuis le cache
      return await cache.match('/index.html')
          || await cache.match('./')
          || new Response('<h1>Hors ligne</h1>', {
               status: 200,
               headers: { 'Content-Type': 'text/html' }
             });
    }
    return new Response('', { status: 503 });
  }
}
