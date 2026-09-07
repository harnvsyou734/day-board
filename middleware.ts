import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, timingSafeEqual } from '@/lib/auth';

// The gate. Everything except the secret door and the installable shell files
// requires the cookie. A request without it gets a 404 -- a stranger who
// guesses the hostname should not learn that there is anything here to find.

export const config = {
  // Excluded: Next's build output, the icons and manifest the OS fetches
  // before any cookie exists, and the secret door itself.
  matcher: ['/((?!_next/static|_next/image|d/|manifest.webmanifest|sw.js|robots.txt|icons/|favicon.ico|apple-touch-icon.png).*)'],
};

export function middleware(request: NextRequest) {
  const expected = process.env.DASHBOARD_TOKEN;

  // Fail closed. A misconfigured deploy must not serve an open board.
  if (!expected) {
    return new NextResponse('Not found', { status: 404 });
  }

  const presented = request.cookies.get(COOKIE_NAME)?.value;
  if (presented && timingSafeEqual(presented, expected)) {
    return NextResponse.next();
  }

  return new NextResponse('Not found', { status: 404 });
}
