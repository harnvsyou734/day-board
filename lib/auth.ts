import { cookies } from 'next/headers';

export const COOKIE_NAME = 'db_key';
// A year. Set by the server on a redirect response, so iOS's 7-day cap on
// script-written cookies does not apply -- that limit is for document.cookie.
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Compares two strings without leaking their common prefix through timing.
 * Web Crypto has no constant-time compare, and this runs in edge middleware
 * where node:crypto is unavailable, so it is written out by hand.
 *
 * Length is compared first and separately -- string length is not a secret
 * here (the token length is fixed by however the user generated it), but the
 * loop still runs over a constant span so a wrong-length guess cannot be
 * distinguished from a wrong-value one by timing alone.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function expectedToken(): string {
  const token = process.env.DASHBOARD_TOKEN;
  if (!token) throw new Error('DASHBOARD_TOKEN is not set. See .env.example.');
  return token;
}

/**
 * Route-handler guard. Middleware already gated the request, but the API
 * routes check again so that a middleware matcher mistake cannot silently
 * expose the data -- the cheap check is worth not having to trust one regex.
 */
export async function isAuthorized(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  if (!value) return false;
  return timingSafeEqual(value, expectedToken());
}

export function unauthorized(): Response {
  // 404, not 401: a stranger should learn nothing about what lives here,
  // and there is no login flow for a browser to prompt for anyway.
  return new Response('Not found', { status: 404 });
}
