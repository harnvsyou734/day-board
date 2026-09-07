import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Day Board',
    short_name: 'Day Board',
    description: 'One day at a time.',
    // The whole reason this app exists rather than living in a chat window.
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    scope: '/',
    background_color: '#f3f2f2',
    theme_color: '#f3f2f2',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
