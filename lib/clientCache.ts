'use client';

import type { CalendarEvent, Task } from './types';

// A read-through cache so the board paints the moment it opens, with no
// full-screen spinner and no blank list -- the spec's quality bar. This is a
// cache, never the store: Neon holds the data, and every write goes there.
//
// Every access is wrapped: private windows, cleared site data and browsers
// configured to block storage all make these throw rather than return null.

const TASKS_KEY = (date: string) => `dayboard:tasks:${date}`;
const EVENTS_KEY = (date: string) => `dayboard:events:${date}`;
const HINT_KEY = 'dayboard:longPressHintSeen';

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota, private mode, or storage blocked outright. The board works
    // without the cache; it just paints a beat later.
  }
}

export const cachedTasks = (date: string) => read<Task[]>(TASKS_KEY(date));
export const cacheTasks = (date: string, tasks: Task[]) => write(TASKS_KEY(date), tasks);

export const cachedEvents = (date: string) => read<CalendarEvent[]>(EVENTS_KEY(date));
export const cacheEvents = (date: string, events: CalendarEvent[]) =>
  write(EVENTS_KEY(date), events);

export function hintSeen(): boolean {
  return read<boolean>(HINT_KEY) === true;
}

export function markHintSeen(): void {
  write(HINT_KEY, true);
}
