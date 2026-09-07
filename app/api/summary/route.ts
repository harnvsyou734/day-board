import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { eventsForDays } from '@/lib/calendar';
import { generateSummary } from '@/lib/summary';
import { addDays, isValidISODate, todayISO, weekStart } from '@/lib/dates';
import type { CalendarEvent, Task } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// The model call plus seven calendar days needs more than the default 10s.
export const maxDuration = 60;

type TaskRow = { id: string; text: string; done: boolean; date: string; age_days: number };

function weekOf(request: NextRequest): string | null {
  const raw = request.nextUrl.searchParams.get('week') ?? todayISO();
  if (!isValidISODate(raw)) return null;
  // The week containing the day being viewed, so looking back at last week
  // and tapping the button gives last week's summary.
  return weekStart(raw);
}

async function cached(week: string) {
  const rows = (await sql`
    select body, generated_at from summaries where week_start = ${week}::date
  `) as Array<{ body: string; generated_at: string }>;
  return rows[0] ?? null;
}

/** Read the cache. Never spends an API call. */
export async function GET(request: NextRequest) {
  if (!(await isAuthorized())) return unauthorized();

  const week = weekOf(request);
  if (!week) return NextResponse.json({ error: 'Bad week' }, { status: 400 });

  try {
    const row = await cached(week);
    return NextResponse.json({
      weekStart: week,
      body: row?.body ?? null,
      generatedAt: row?.generated_at ?? null,
    });
  } catch (error) {
    console.error('GET /api/summary failed', error);
    return NextResponse.json({ error: 'Could not load summary' }, { status: 500 });
  }
}

/**
 * Generate. Returns the cached copy unless ?refresh=1, so tapping the button
 * twice costs one API call, and the refresh button is the way to spend another.
 */
export async function POST(request: NextRequest) {
  if (!(await isAuthorized())) return unauthorized();

  const week = weekOf(request);
  if (!week) return NextResponse.json({ error: 'Bad week' }, { status: 400 });
  const force = request.nextUrl.searchParams.get('refresh') === '1';

  try {
    if (!force) {
      const row = await cached(week);
      if (row) {
        return NextResponse.json({
          weekStart: week,
          body: row.body,
          generatedAt: row.generated_at,
        });
      }
    }

    const weekEndDate = addDays(week, 6);
    const taskRows = (await sql`
      select
        id,
        text,
        done,
        to_char(date, 'YYYY-MM-DD') as date,
        date - first_date as age_days
      from tasks
      where date between ${week}::date and ${weekEndDate}::date
      order by date asc, first_date asc, created_at asc
    `) as TaskRow[];

    const tasks: Array<Task & { date: string }> = taskRows.map((row) => ({
      id: row.id,
      text: row.text,
      done: row.done,
      date: row.date,
      ageDays: Number(row.age_days),
    }));

    // Each calendar feed is downloaded and parsed once for the whole week,
    // not once per day -- seven days across four calendars is four requests.
    // A total failure degrades to an empty schedule rather than losing the
    // summary: a summary of the tasks alone is still worth having.
    const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
    let eventsByDay: Record<string, CalendarEvent[]>;
    try {
      eventsByDay = (await eventsForDays(days)).byDay;
    } catch (error) {
      console.error('Calendar unavailable for summary', error);
      eventsByDay = Object.fromEntries(days.map((day) => [day, []]));
    }

    const body = await generateSummary({ weekStart: week, tasks, eventsByDay });

    const rows = (await sql`
      insert into summaries (week_start, body, generated_at)
      values (${week}::date, ${body}, now())
      on conflict (week_start)
      do update set body = excluded.body, generated_at = excluded.generated_at
      returning generated_at
    `) as Array<{ generated_at: string }>;

    return NextResponse.json({ weekStart: week, body, generatedAt: rows[0].generated_at });
  } catch (error) {
    console.error('POST /api/summary failed', error);
    return NextResponse.json({ error: 'Could not write the summary' }, { status: 500 });
  }
}
