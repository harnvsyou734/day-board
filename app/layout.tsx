import type { Metadata, Viewport } from 'next';
import { Source_Serif_4 } from 'next/font/google';
import './globals.css';

// Self-hosted by next/font: no request to Google at runtime, no flash of
// fallback text, and it still works on a phone with a bad connection.
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
  variable: '--font-source-serif',
});

export const metadata: Metadata = {
  title: 'Day Board',
  // The board is private and reachable only with the secret token; keep it
  // out of every index that might otherwise stumble on the URL.
  robots: { index: false, follow: false, nocache: true },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // iOS reads this one when you Add to Home Screen.
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Day Board',
    // 'default' leaves the status bar as its own opaque strip. black-translucent
    // lets the paper ground run under it, which is what makes it read as an app
    // window rather than a page in a frame. The board already pads for the
    // notch via env(safe-area-inset-top).
    statusBarStyle: 'black-translucent',
  },
  other: {
    // REQUIRED for iOS to launch this standalone instead of bouncing to Safari.
    //
    // Next's `appleWebApp.capable` emits only <meta name="mobile-web-app-capable">,
    // the modern standard name. Safari does not read that one for standalone
    // mode -- it reads the apple-prefixed legacy name, and without it an
    // installed icon is just a bookmark. Both names have to be present.
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The design is a fixed-height board; letting it zoom on a double-tap turns
  // every mis-tap into a zoom. Text is 18-20px precisely so this is safe.
  maximumScale: 1,
  // Paints under the notch and the home indicator; the CSS pads for both.
  viewportFit: 'cover',
  themeColor: '#f3f2f2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sourceSerif.variable}>
      <body>{children}</body>
    </html>
  );
}
