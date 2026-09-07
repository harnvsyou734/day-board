/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // The board is a private, single-user page reachable only with the
        // secret token. Keep it out of every index, and out of shared caches.
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
      {
        // The service worker must never be served stale, or a deploy can
        // leave a phone pinned to an old shell indefinitely.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};
export default nextConfig;
