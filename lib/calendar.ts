import ical from 'node-ical';
import type { CalendarEvent } from './types';
import { bangkokTime, dayRangeUTC } from './dates';

// Read-only Google Calendar with no OAuth: Google publishes a private .ics
// feed per calendar ("Secret address in iCal format"). We fetch and parse them.
//
// There is no combined feed -- one URL per calendar is how Google works -- so
// CALENDAR_ICS_URL holds a list, separated by commas or newlines.
//
// The tradeoff, stated plainly because it will be noticed: Google caches those
// feeds. An event you add on your phone can take a while -- sometimes hours --
// to appear here. Nothing in this code can shorten that. If it becomes
// intolerable, this file is the only thing that has to change: everything
// above it just consumes CalendarEvent[].

const FETCH_TIMEOUT_MS = 8000;

type AnyEvent = ical.VEvent & {
  datetype?: string;
  recurrences?: Record<string, ical.VEvent>;
  exdate?: Record<string, Date>;
};

export type DayEvents = {
  /** Events per requested day, keyed by "YYYY-MM-DD". */
  byDay: Record<string, CalendarEvent[]>;
  /** False when every feed failed -- the caller should show the error line. */
  ok: boolean;
  /** True when some feeds loaded and others did not. */
  partial: boolean;
};

function feedUrls(): string[] {
  const raw = process.env.CALENDAR_ICS_URL;
  if (!raw) throw new Error('CALENDAR_ICS_URL is not set');
  return raw
    .split(/[\n,]+/)
    .map((url) => url.trim())
    .filter(Boolean);
}

/**
 * rrule returns occurrence Dates whose UTC fields carry the *wall clock* of
 * the occurrence in the process's local timezone, not a true instant. On a
 * UTC server the two coincide and everything looks correct; on a machine set
 * to Asia/Bangkok every recurring event lands 7 hours late.
 *
 * Vercel runs UTC, so this only bites in local development -- which is
 * exactly why it is worth correcting rather than leaving as a trap.
 *
 * Both timezones that matter here (UTC, and Asia/Bangkok for local dev) are
 * DST-free, so a single offset lookup is exact. In a DST-observing zone this
 * could be an hour out for occurrences either side of a transition.
 */
function rruleInstant(occurrence: Date): Date {
  return new Date(occurrence.getTime() + occurrence.getTimezoneOffset() * 60_000);
}

/**
 * The calendar date an all-day event's boundary falls on.
 *
 * node-ical builds a DATE-valued DTSTART as local midnight, so the local date
 * components are the intended calendar date whatever the server's zone.
 */
function localDateISO(at: Date): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const d = String(at.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Whether an all-day event covers the given Bangkok day.
 *
 * All-day events must be compared as dates, never as instants. Their
 * [DTSTART, DTEND) spans a full 24 hours, and on a UTC server that window
 * overlaps two Bangkok days -- so an instant comparison shows a one-day event
 * on two consecutive days. DTEND is exclusive, per RFC 5545.
 */
function allDayCoversDay(event: AnyEvent, iso: string): boolean {
  const start = localDateISO(event.start as Date);
  const rawEnd = event.end as Date | undefined;
  const end = rawEnd ? localDateISO(rawEnd) : start;
  // A malformed feed can give DTEND == DTSTART; treat that as a single day.
  return end > start ? iso >= start && iso < end : iso === start;
}

function isAllDay(event: AnyEvent): boolean {
  // node-ical marks a DATE-typed (rather than DATE-TIME) value two ways
  // depending on version, so check both.
  const start = event.start as Date & { dateOnly?: boolean };
  return event.datetype === 'date' || start?.dateOnly === true;
}

/**
 * Best-effort "hide events I have declined".
 *
 * Whether this can work at all depends on what Google actually puts in the
 * private feed, which varies -- often declined events are simply absent, and
 * when present the ATTENDEE line may or may not carry your address. So: only
 * drop an event when an attendee's address matches CALENDAR_OWNER_EMAIL *and*
 * that attendee's PARTSTAT is DECLINED. With the variable unset, no
 * attendee-based filtering happens and nothing is silently hidden.
 */
function isDeclined(event: AnyEvent, ownerEmail: string | null): boolean {
  if (!ownerEmail) return false;
  const raw = (event as { attendee?: unknown }).attendee;
  if (!raw) return false;
  const attendees = Array.isArray(raw) ? raw : [raw];
  return attendees.some((attendee) => {
    if (!attendee || typeof attendee !== 'object') return false;
    const entry = attendee as { val?: string; params?: Record<string, string> };
    const address = (entry.val ?? '').replace(/^mailto:/i, '').toLowerCase();
    const status = entry.params?.PARTSTAT ?? '';
    return address === ownerEmail && status.toUpperCase() === 'DECLINED';
  });
}

function occurrenceKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function toCalendarEvent(source: AnyEvent, start: Date, suffix: string): CalendarEvent {
  const allDay = isAllDay(source);
  return {
    id: `${String(source.uid ?? 'event')}:${suffix}`,
    title: String(source.summary ?? '(untitled)').trim() || '(untitled)',
    location: source.location ? String(source.location).trim() || null : null,
    time: allDay ? null : bangkokTime(start),
    allDay,
  };
}

async function fetchFeed(url: string): Promise<ical.CalendarResponse> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    // Google's feed is cached upstream anyway; don't add a second layer that
    // could hold a stale copy past the point where Google refreshed.
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Calendar feed returned ${response.status}`);
  return ical.async.parseICS(await response.text());
}

/** Expand one already-parsed feed onto one Bangkok day. */
function expandDay(
  parsed: ical.CalendarResponse,
  iso: string,
  ownerEmail: string | null,
  into: Array<{ start: Date; event: CalendarEvent }>,
): void {
  const { start: dayStart, end: dayEnd } = dayRangeUTC(iso);

  for (const value of Object.values(parsed)) {
    const event = value as AnyEvent;
    if (event.type !== 'VEVENT' || !event.start) continue;
    if (String(event.status ?? '').toUpperCase() === 'CANCELLED') continue;
    if (isDeclined(event, ownerEmail)) continue;

    const baseStart = event.start as Date;
    const rule = (event as { rrule?: { between: (a: Date, b: Date, inc: boolean) => Date[] } }).rrule;

    if (!rule) {
      if (isAllDay(event)) {
        if (allDayCoversDay(event, iso)) {
          into.push({ start: baseStart, event: toCalendarEvent(event, baseStart, 'single') });
        }
        continue;
      }
      // A timed event belongs to the day it STARTS on.
      //
      // The alternative -- any overlap -- puts a session that ran 23:00-01:00
      // last night at the top of today's timetable, printed as "23:00" above
      // this morning's 09:00. It is over by the time you open the board, and
      // it makes an ascending list of times look broken. It still appears in
      // full on the day it started.
      if (baseStart >= dayStart && baseStart < dayEnd) {
        into.push({ start: baseStart, event: toCalendarEvent(event, baseStart, 'single') });
      }
      continue;
    }

    // rrule is queried in its own skewed space (see rruleInstant), so the
    // window has to be wider than the day by more than any timezone offset --
    // otherwise a 23:00 occurrence, whose raw value lands past midnight, is
    // never returned at all. A day either side is ample; the corrected
    // instants are filtered exactly below.
    let occurrences: Date[] = [];
    try {
      occurrences = rule.between(
        new Date(dayStart.getTime() - 86_400_000),
        new Date(dayEnd.getTime() + 86_400_000),
        true,
      );
    } catch {
      // A malformed RRULE should cost us that one series, not the whole day.
      continue;
    }

    for (const raw of occurrences) {
      const occurrence = rruleInstant(raw);
      // EXDATE and RECURRENCE-ID are keyed by the corrected instant's date --
      // keying off the raw value would miss an override whenever the offset
      // pushes the occurrence across midnight.
      const key = occurrenceKey(occurrence);

      // EXDATE: this instance was deleted from the series.
      if (event.exdate && event.exdate[key]) continue;

      // RECURRENCE-ID: this instance was edited, so its own VEVENT wins.
      const override = event.recurrences?.[key] as AnyEvent | undefined;
      if (override) {
        const overrideStart = override.start as Date;
        if (String(override.status ?? '').toUpperCase() === 'CANCELLED') continue;
        if (isDeclined(override, ownerEmail)) continue;
        if (overrideStart >= dayStart && overrideStart < dayEnd) {
          into.push({ start: overrideStart, event: toCalendarEvent(override, overrideStart, key) });
        }
        continue;
      }

      if (occurrence >= dayStart && occurrence < dayEnd) {
        into.push({ start: occurrence, event: toCalendarEvent(event, occurrence, key) });
      }
    }
  }
}

function sortAndDedupe(collected: Array<{ start: Date; event: CalendarEvent }>): CalendarEvent[] {
  collected.sort((a, b) => {
    // All-day events are pinned above timed ones -- they have no time to sort
    // by, and giving them a fake 00:00 would be a lie about when they happen.
    if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
    return a.start.getTime() - b.start.getTime();
  });

  // The same event can sit on two of your calendars -- an invitation that
  // lands on both a personal and a shared one keeps its UID, so this collapses
  // it to a single line rather than printing it twice.
  const seen = new Set<string>();
  return collected.filter(({ event }) => !seen.has(event.id) && seen.add(event.id)).map((c) => c.event);
}

/**
 * Every event on the given Bangkok days, across every configured calendar.
 *
 * Each feed is fetched and parsed exactly ONCE regardless of how many days are
 * asked for. That matters for the weekly summary: seven days across four
 * calendars is four downloads here, not twenty-eight.
 *
 * A feed that fails costs only its own events. All seven days still come back,
 * with `partial` set, because a schedule missing one calendar is far more
 * useful than no schedule.
 */
export async function eventsForDays(isoDates: string[]): Promise<DayEvents> {
  const urls = feedUrls();
  const ownerEmail = process.env.CALENDAR_OWNER_EMAIL?.trim().toLowerCase() || null;

  const settled = await Promise.allSettled(urls.map(fetchFeed));
  const parsed = settled
    .filter((r): r is PromiseFulfilledResult<ical.CalendarResponse> => r.status === 'fulfilled')
    .map((r) => r.value);

  for (const result of settled) {
    if (result.status === 'rejected') console.error('Calendar feed failed', result.reason);
  }

  const byDay: Record<string, CalendarEvent[]> = {};
  for (const iso of isoDates) {
    const collected: Array<{ start: Date; event: CalendarEvent }> = [];
    for (const feed of parsed) expandDay(feed, iso, ownerEmail, collected);
    byDay[iso] = sortAndDedupe(collected);
  }

  return {
    byDay,
    ok: parsed.length > 0,
    partial: parsed.length > 0 && parsed.length < urls.length,
  };
}

export async function eventsForDay(iso: string): Promise<Omit<DayEvents, 'byDay'> & { events: CalendarEvent[] }> {
  const { byDay, ok, partial } = await eventsForDays([iso]);
  return { events: byDay[iso] ?? [], ok, partial };
}
