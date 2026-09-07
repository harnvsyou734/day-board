import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { isValidISODate, todayISO } from '@/lib/dates';
import type { Task } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TEXT = 500;

type Row = { id: string; text: string; done: boolean; age_days: number };

const toTask = (row: Row): Task => ({
  id: row.id,
  text: row.text,
  done: row.done,
  ageDays: Number(row.age_days),
});

/**
 * The roll-forward. Anything still open on an earlier day moves to today, so
 * nothing is lost and the past reads as settled.
 *
 * It runs only when today is actually being loaded -- looking back at last
 * Tuesday must not drag that day's leftovers onto it. Idempotent, so the
 * second load of the day is a no-op.
 *
 * Note the shape of this: `date` moves, `first_date` does not. Their
 * difference is how long a task has been pushed -- and because `first_date`
 * is whatever day you filed the task against, a task planned three days
 * ahead is not mistaken for one you have been avoiding for three days.
 */
async function rollForward(today: string): Promise<void> {
  await sql`update tasks set date = ${today}::date where not done and date < ${today}::date`;
}

async function tasksOn(date: string): Promise<Task[]> {
  const rows = (await sql`
    select
      id,
      text,
      done,
      date - first_date as age_days
    from tasks
    where date = ${date}::date
    order by
      -- Carried lines first: booleans sort false < true, so desc puts the
      -- ones pushed from an earlier day at the top of the page.
      (first_date < date) desc,
      first_date asc,
      created_at asc
  `) as Row[];
  return rows.map(toTask);
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized())) return unauthorized();

  const date = request.nextUrl.searchParams.get('date') ?? todayISO();
  if (!isValidISODate(date)) {
    return NextResponse.json({ error: 'Bad date' }, { status: 400 });
  }

  try {
    if (date === todayISO()) await rollForward(date);
    return NextResponse.json({ date, tasks: await tasksOn(date) });
  } catch (error) {
    console.error('GET /api/tasks failed', error);
    return NextResponse.json({ error: 'Could not load tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized())) return unauthorized();

  let body: { date?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }

  const date = typeof body.date === 'string' ? body.date : todayISO();
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (!isValidISODate(date)) {
    return NextResponse.json({ error: 'Bad date' }, { status: 400 });
  }
  if (!text || text.length > MAX_TEXT) {
    return NextResponse.json({ error: 'Bad text' }, { status: 400 });
  }

  try {
    const rows = (await sql`
      insert into tasks (date, first_date, text)
      values (${date}::date, ${date}::date, ${text})
      returning
        id,
        text,
        done,
        date - first_date as age_days
    `) as Row[];
    return NextResponse.json({ task: toTask(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks failed', error);
    return NextResponse.json({ error: 'Could not add task' }, { status: 500 });
  }
}
