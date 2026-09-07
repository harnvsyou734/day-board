import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, COOKIE_MAX_AGE, timingSafeEqual } from '@/lib/auth';

// The secret door, used once per device.
//
// The token rides in the URL exactly this once. We set the cookie and redirect
// to "/", so it stops appearing in the address bar, in browser history, and in
// every subsequent line of the server's access log. Keep the original link in
// a password manager: clearing cookies is the only thing that makes you need
// it again.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const expected = process.env.DASHBOARD_TOKEN;
  const { token } = await params;

  if (!expected || !timingSafeEqual(decodeURIComponent(token), expected)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const response = NextResponse.redirect(new URL('/', _request.url), 303);
  response.cookies.set(COOKIE_NAME, expected, {
    httpOnly: true,
    // Written by the server on the response, not by script, so iOS's 7-day
    // cap on document.cookie storage does not apply and this really does
    // last a year.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}
