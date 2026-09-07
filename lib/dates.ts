// Every date in this app is a calendar day in Asia/Bangkok, carried around as
// a "YYYY-MM-DD" string. Nothing here ever depends on the server's own clock
// zone -- Vercel runs in UTC, so relying on the local zone would roll the day
// over at 07:00 Bangkok time.
//
// Thailand has never observed DST and has no plans to, so the offset is a
// fixed +07:00. That is what lets `dayRangeUTC` below build instants by string
// concatenation instead of dragging in a timezone library.

export const TZ = 'Asia/Bangkok';
export const TZ_OFFSET = '+07:00';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// en-CA formats as YYYY-MM-DD, which is exactly the shape we store.
const isoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Today, as a Bangkok calendar day. */
export function todayISO(): string {
  return isoFormatter.format(new Date());
}

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  // Rejects 2026-02-31 and friends, which the regex alone lets through.
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/**
 * Date arithmetic on the string form. We anchor to UTC midnight purely as a
 * calendar abstraction -- these Dates are never compared against real
 * instants, so there is no zone bug hiding here.
 */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  probe.setUTCDate(probe.getUTCDate() + days);
  return probe.toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

/** The Monday of the week containing `iso`. Weeks run Monday-Sunday. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  const dow = probe.getUTCDay(); // 0 = Sunday
  probe.setUTCDate(probe.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return probe.toISOString().slice(0, 10);
}

export function weekEnd(iso: string): string {
  return addDays(weekStart(iso), 6);
}

/**
 * The half-open instant range [start, end) covering one Bangkok day.
 * Used to decide which calendar events belong to a day.
 */
export function dayRangeUTC(iso: string): { start: Date; end: Date } {
  return {
    start: new Date(`${iso}T00:00:00${TZ_OFFSET}`),
    end: new Date(`${addDays(iso, 1)}T00:00:00${TZ_OFFSET}`),
  };
}

/** An instant, as the Bangkok clock time the design prints ("09:00"). */
export function bangkokTime(at: Date): string {
  return timeFormatter.format(at);
}

/** An instant, as the Bangkok calendar day it falls on. */
export function bangkokDay(at: Date): string {
  return isoFormatter.format(at);
}

export function weekdayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function monthName(iso: string): string {
  return MONTHS[Number(iso.slice(5, 7)) - 1];
}

export function dayNumber(iso: string): string {
  return String(Number(iso.slice(8, 10)));
}
