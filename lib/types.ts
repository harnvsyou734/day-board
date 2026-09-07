export type Task = {
  id: string;
  text: string;
  done: boolean;
  /** Days between the day it was first written down and the day it now sits on. */
  ageDays: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  location: string | null;
  /** "09:00" in Bangkok, or null for an all-day event. */
  time: string | null;
  allDay: boolean;
};

export type CalendarPayload =
  | { ok: true; events: CalendarEvent[] }
  | { ok: false; error: string };

export type SummaryPayload = {
  weekStart: string;
  body: string | null;
  generatedAt: string | null;
};
