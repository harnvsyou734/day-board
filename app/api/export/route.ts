import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { todayISO } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Your whole task history as one JSON file. There is no login and no second
 * copy of this data anywhere, so this endpoint is the backup -- visit it every
 * so often and keep the file.
 */
export async function GET() {
  if (!(await isAuthorized())) return unauthorized();

  try {
    const tasks = await sql`
      select id, to_char(date, 'YYYY-MM-DD') as date, text, done, created_at
      from tasks order by date asc, created_at asc
    `;
    const summaries = await sql`
      select to_char(week_start, 'YYYY-MM-DD') as week_start, body, generated_at
      from summaries order by week_start asc
    `;

    const payload = JSON.stringify(
      { exportedAt: new Date().toISOString(), timezone: 'Asia/Bangkok', tasks, summaries },
      null,
      2,
    );

    return new NextResponse(payload, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="day-board-${todayISO()}.json"`,
      },
    });
  } catch (error) {
    console.error('GET /api/export failed', error);
    return NextResponse.json({ error: 'Could not export' }, { status: 500 });
  }
}
