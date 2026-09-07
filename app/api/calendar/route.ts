import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { eventsForDay } from '@/lib/calendar';
import { isValidISODate, todayISO } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The schedule is a bonus; the to-dos are the point. A calendar failure here
 * returns 200 with ok:false so the client renders one quiet line and a "Try
 * again", never a blank screen and never an unhandled rejection.
 */
export async function GET(request: NextRequest) {
  if (!(await isAuthorized())) return unauthorized();

  const date = request.nextUrl.searchParams.get('date') ?? todayISO();
  if (!isValidISODate(date)) {
    return NextResponse.json({ ok: false, error: 'Bad date' }, { status: 400 });
  }

  try {
    const { events, ok, partial } = await eventsForDay(date);
    // Every feed down is an error the board should name. Some feeds down is
    // still a usable schedule, flagged so the board can say so quietly.
    if (!ok) return NextResponse.json({ ok: false, error: 'Calendar unavailable' });
    return NextResponse.json({ ok: true, events, partial });
  } catch (error) {
    console.error('GET /api/calendar failed', error);
    return NextResponse.json({ ok: false, error: 'Calendar unavailable' });
  }
}
