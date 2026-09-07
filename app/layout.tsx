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
    statusBarStyle: 'default',
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
