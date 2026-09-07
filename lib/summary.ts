import Anthropic from '@anthropic-ai/sdk';
import type { CalendarEvent, Task } from './types';
import { addDays, weekdayName } from './dates';

// Called only from the server. The API key must never reach the browser --
// nothing in this file is importable from a client component, and the only
// caller is app/api/summary/route.ts.

const MODEL = 'claude-opus-5';

const SYSTEM = `You write a weekly orientation for one person's day board. They open it on their phone on a bright street; they will read it once and act on it.

Write exactly three paragraphs, separated by a blank line, with no headings, labels, bullets, numbers, or markdown of any kind:

1. The shape of the week: which days are heavy, where the pressure sits.
2. What is still unfinished, in the order to tackle it. Lead with whatever has been open longest -- the data gives you each task's age in days, and something carried for days is more urgent than its wording suggests.
3. One thing to watch out for: a collision, a squeeze, a deadline sitting behind a busy evening.

Rules: under 200 words total. Plain sentences. Name specific tasks and days rather than generalising. If a section has nothing real to say, say so in one short sentence instead of padding. Never invent a task or an event that is not in the data. Do not open with a preamble or close with encouragement -- start with the first observation and stop after the third paragraph.`;

type WeekData = {
  weekStart: string;
  tasks: Array<Task & { date: string }>;
  eventsByDay: Record<string, CalendarEvent[]>;
};

function renderWeek({ weekStart, tasks, eventsByDay }: WeekData): string {
  const lines: string[] = [];
  const monday = weekStart;
  const sunday = addDays(weekStart, 6);
  lines.push(`Week of ${monday} (Monday) to ${sunday} (Sunday). All times Asia/Bangkok.`);

  lines.push('', 'SCHEDULE');
  let anyEvent = false;
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const events = eventsByDay[day] ?? [];
    if (events.length === 0) {
      lines.push(`${weekdayName(day)} ${day}: nothing scheduled`);
      continue;
    }
    anyEvent = true;
    lines.push(`${weekdayName(day)} ${day}:`);
    for (const event of events) {
      const when = event.allDay ? 'all day' : event.time;
      const where = event.location ? ` (${event.location})` : '';
      lines.push(`  - ${when} ${event.title}${where}`);
    }
  }
  if (!anyEvent) {
    lines.push('(The calendar returned no events for this week. It may simply be empty, or it may have failed to load -- do not speculate about which.)');
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  lines.push('', 'STILL OPEN');
  if (open.length === 0) {
    lines.push('(nothing open)');
  } else {
    // Oldest first: this ordering is itself the signal for paragraph two.
    for (const task of [...open].sort((a, b) => b.ageDays - a.ageDays)) {
      const age =
        task.ageDays <= 0
          ? 'written today'
          : `carried ${task.ageDays} day${task.ageDays === 1 ? '' : 's'}`;
      lines.push(`  - ${task.text} [on ${task.date}, ${age}]`);
    }
  }

  lines.push('', 'FINISHED THIS WEEK');
  lines.push(done.length === 0 ? '(nothing finished yet)' : done.map((t) => `  - ${t.text}`).join('\n'));

  return lines.join('\n');
}

export async function generateSummary(data: WeekData): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  const client = new Anthropic();

  // `output_config` and `fallbacks` are cast through because the installed
  // SDK's type for them can lag the API. The shapes below are the documented
  // ones; the cast keeps a type-only drift from breaking the build.
  //
  // effort "low": the task is short and well-specified, so the cheapest depth
  // is the right one -- this tunes spend within the model, it is not a
  // downgrade to a smaller one.
  //
  // fallbacks "default": if a safety classifier ever declines the request,
  // the server reroutes rather than handing back an empty summary. It will
  // not fire on a to-do list; it costs two lines to not have to care.
  const params = {
    model: MODEL,
    max_tokens: 1200,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: renderWeek(data) }],
  } as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

  const message = await client.beta.messages.create(params);

  if (message.stop_reason === 'refusal') {
    throw new Error('The model declined to write this summary.');
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  if (!text) throw new Error('The model returned an empty summary.');
  return text;
}

