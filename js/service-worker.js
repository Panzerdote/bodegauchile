const CACHE_NAME = 'cehaq-bodega-v5.0.0';
const STATIC_ASSETS = [
    '/',
    '/login.html',
    '/seleccionar.html',
    '/index.html',
    '/inventario.html',
    '/movimientos.html',
    '/css/styles.css',
    '/js/config.js',
    '/js/database.js',
    '/js/ui.js',
    '/js/scanner.js',
    '/js/modales.js',
    '/js/app.js',
    '/js/dashboard.js',
    '/js/inventario.js',
    '/js/movimientos.js',
    '/img/escudo.svg',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://unpkg.com/html5-qrcode'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Cache abierto');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((error) => {
                console.error('Error al cachear:', error);
            })
    );
    self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Eliminando cache antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Estrategia de caché: Network First con fallback a caché
self.addEventListener('fetch', (event) => {
    // No interceptar llamadas a la API de Supabase
    if (event.request.url.includes('supabase.co')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Si la respuesta es válida, la guardamos en caché
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si no hay conexión, intentamos servir desde caché
                return caches.match(event.request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Si es una página HTML, mostrar página offline
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/login.html');
                        }
                        return new Response('Sin conexión', { status: 503 });
                    });
            })
    );
});

// Manejar mensajes
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
