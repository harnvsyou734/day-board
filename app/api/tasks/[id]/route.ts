import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isAuthorized, unauthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT = 500;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorized())) return unauthorized();

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  let body: { done?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }

  const done = typeof body.done === 'boolean' ? body.done : null;
  const text = typeof body.text === 'string' ? body.text.trim() : null;

  if (done === null && text === null) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  }
  if (text !== null && (!text || text.length > MAX_TEXT)) {
    return NextResponse.json({ error: 'Bad text' }, { status: 400 });
  }

  try {
    // coalesce keeps this one statement for either field or both, and leaves
    // whichever was not sent exactly as it was.
    const rows = (await sql`
      update tasks
      set done = coalesce(${done}::boolean, done),
          text = coalesce(${text}::text, text)
      where id = ${id}::uuid
      returning id
    `) as Array<{ id: string }>;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No such task' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/tasks/[id] failed', error);
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorized())) return unauthorized();

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  try {
    const rows = (await sql`
      delete from tasks where id = ${id}::uuid returning id
    `) as Array<{ id: string }>;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No such task' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/tasks/[id] failed', error);
    return NextResponse.json({ error: 'Could not delete' }, { status: 500 });
  }
}
