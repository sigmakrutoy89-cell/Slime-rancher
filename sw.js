const CACHE_NAME = 'slime-rancher-v1';
const CRITICAL_ASSETS = [
    '/',
    '/index.html',
    'TemplateData/style.css',
    'TemplateData/favicon.ico',
    'TemplateData/UnityProgress.js',
    'Build/UnityLoader.js'
];

// Установка Service Worker и кэширование критических файлов
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching critical assets');
            return Promise.allSettled(
                CRITICAL_ASSETS.map(url => 
                    cache.add(url).catch(err => console.warn(`Failed to cache ${url}:`, err))
                )
            );
        }).then(() => self.skipWaiting())
    );
});

// Активация Service Worker и очистка старого кэша
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Стратегия: Network First для данных игры, Cache First для статики
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Игровые данные - сначала сеть, потом кэш
    if (url.pathname.includes('/Build/') || url.pathname.includes('.unityweb')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request)
                        .then((response) => response || createOfflineResponse());
                })
        );
    }
    // Статические файлы - кэш в приоритете
    else if (url.pathname.includes('TemplateData') || url.pathname.includes('.css') || url.pathname.includes('.js')) {
        event.respondWith(
            caches.match(event.request)
                .then((response) => response || fetch(event.request))
        );
    }
    // Остальное - сеть с fallback на кэш
    else {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, response.clone());
                        });
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    }
});

// Ответ для оффлайн режима
function createOfflineResponse() {
    return new Response(
        'Game data is loading... Check your connection.',
        { status: 503, statusText: 'Service Unavailable', headers: new Headers() }
    );
}
