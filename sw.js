const CACHE_NAME = 'gastos-ai-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js'
];

// Instalar el Service Worker y guardar los archivos base en caché
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// Interceptar peticiones para que cargue rápido
self.addEventListener('fetch', event => {
    // Ignoramos las peticiones a la base de datos de Firebase para que los datos siempre sean en vivo
    if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('identitytoolkit')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Si el archivo está en caché, lo devuelve. Si no, lo descarga de internet.
                return response || fetch(event.request);
            })
    );
});
