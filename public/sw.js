/* Day Board service worker.
 *
 * Hand-written rather than generated: the whole offline story is "show me the
 * last day I loaded, read-only", which is about forty lines. next-pwa would
 * add a dependency and a build step for less control than this.
 *
 * There is no write queue and no sync. That is deliberate -- an offline sync
 * engine is explicitly out of scope, and the UI disables writes when offline
 * rather than pretending they landed.
 */

const VERSION = 'v1';
const SHELL = `dayboard-shell-${VERSION}`;
const DATA = `dayboard-data-${VERSION}`;

// Only what is needed to paint the board. The HTML itself is fetched
// network-first below, because the page is server-rendered per request.
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_URLS))
      // A missing shell URL must not block activation, or a single 404
      // leaves the worker permanently stuck installing.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('dayboard-') && key !== SHELL && key !== DATA)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the secret door: it is a one-shot redirect that sets a cookie.
  if (url.pathname.startsWith('/d/')) return;

  const isData = url.pathname === '/api/tasks' || url.pathname === '/api/calendar';
  const isDocument = request.mode === 'navigate';

  if (!isData && !isDocument && !SHELL_URLS.includes(url.pathname) && !url.pathname.startsWith('/icons/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache real successes. Caching the middleware's 404 would pin
        // the phone to "not found" until the cache is cleared.
        if (response.ok) {
          const copy = response.clone();
          caches.open(isData ? DATA : SHELL).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (isDocument) return caches.match('/');
          // The board treats a failed data fetch as "offline", so an explicit
          // error is better than a fabricated empty list.
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }),
      ),
  );
});
