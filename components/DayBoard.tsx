'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ActionSheet from './ActionSheet';
import Schedule from './Schedule';
import SummaryView from './SummaryView';
import TaskRow from './TaskRow';
import { useMediaQuery } from './useMediaQuery';
import { useOnline } from './useOnline';
import {
  cacheEvents,
  cacheTasks,
  cachedEvents,
  cachedTasks,
  hintSeen,
  markHintSeen,
} from '@/lib/clientCache';
import { addDays, dayNumber, monthName, weekdayName } from '@/lib/dates';
import type { CalendarEvent, Task } from '@/lib/types';

const FLASH_MS = 1000;

export default function DayBoard({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksReady, setTasksReady] = useState(false);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calState, setCalState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [calPartial, setCalPartial] = useState(false);

  const [draft, setDraft] = useState('');
  const [failedId, setFailedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionTask, setActionTask] = useState<Task | null>(null);
  const [showHint, setShowHint] = useState(false);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryState, setSummaryState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [summaryBody, setSummaryBody] = useState<string | null>(null);
  const [summaryAt, setSummaryAt] = useState<string | null>(null);

  const [online, setOnline] = useOnline();
  const wide = useMediaQuery('(min-width: 960px)');

  // Guards against a slow response for a day you have already navigated away
  // from overwriting the day you are now looking at.
  const requestSeq = useRef(0);
  const loadCalendarRef = useRef<((date: string) => void) | null>(null);

  const isToday = date === today;
  const writesDisabled = !online;

  useEffect(() => {
    setShowHint(!hintSeen());
  }, []);

  const flashFail = useCallback((id: string, message: string) => {
    setFailedId(id);
    setNotice(message);
    setTimeout(() => {
      setFailedId((current) => (current === id ? null : current));
    }, FLASH_MS);
  }, []);

  /* ----------------------------------------------------------------- */
  /* Loading                                                            */
  /* ----------------------------------------------------------------- */

  const loadTasks = useCallback(
    (forDate: string, { fromCache }: { fromCache: boolean }) => {
      const seq = ++requestSeq.current;

      if (fromCache) {
        // Paint from the cache first. No spinner covers the board, and on a
        // repeat visit the list is there before the network answers.
        const cached = cachedTasks(forDate);
        setTasks(cached ?? []);
        setTasksReady(cached !== null);
      }

      fetch(`/api/tasks?date=${forDate}`, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
        .then((data: { tasks: Task[] }) => {
          if (seq !== requestSeq.current) return;
          setTasks(data.tasks);
          setTasksReady(true);
          cacheTasks(forDate, data.tasks);
          setOnline(true);
        })
        .catch(() => {
          if (seq !== requestSeq.current) return;
          setTasksReady(true);
          // A failed read while a cache exists is an offline read, not an
          // error screen -- the cached day stays on screen behind the bar.
          setOnline(false);
        });
    },
    [setOnline],
  );

  useEffect(() => {
    loadTasks(date, { fromCache: true });
  }, [date, loadTasks]);

  /**
   * Getting back out of the offline state.
   *
   * navigator.onLine going false fires an 'online' event on recovery, but a
   * single failed request on a connection the browser still believes in does
   * not -- without this the board would sit with writes disabled until the
   * day changed. So: retry when the app is brought back to the foreground,
   * which is exactly when you would look at it again.
   */
  useEffect(() => {
    if (online) return;
    const recheck = () => {
      if (document.visibilityState === 'visible') {
        loadTasks(date, { fromCache: false });
        loadCalendarRef.current?.(date);
      }
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, [online, date, loadTasks]);

  const loadCalendar = useCallback(
    (forDate: string) => {
      const seq = requestSeq.current;
      setCalState('loading');

      const cached = cachedEvents(forDate);
      if (cached) setEvents(cached);

      fetch(`/api/calendar?date=${forDate}`, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
        .then((data: { ok: boolean; events?: CalendarEvent[]; partial?: boolean }) => {
          if (seq !== requestSeq.current) return;
          if (!data.ok || !data.events) {
            setCalState('error');
            return;
          }
          setEvents(data.events);
          setCalPartial(data.partial === true);
          setCalState('ok');
          cacheEvents(forDate, data.events);
        })
        .catch(() => {
          if (seq !== requestSeq.current) return;
          setCalState(cached ? 'ok' : 'error');
        });
    },
    [],
  );

  // The recovery effect above runs before loadCalendar is declared, so it
  // reaches it through this ref rather than by reordering the file.
  useEffect(() => {
    loadCalendarRef.current = loadCalendar;
  }, [loadCalendar]);

  useEffect(() => {
    loadCalendar(date);
  }, [date, loadCalendar]);

  // The service worker is what makes the icon useful with no signal.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // An unregistrable worker costs offline support, nothing else.
    });
  }, []);

  /* ----------------------------------------------------------------- */
  /* Writes -- update first, persist after, roll back visibly           */
  /* ----------------------------------------------------------------- */

  const persist = useCallback(
    async (input: RequestInfo, init: RequestInit): Promise<boolean> => {
      try {
        const response = await fetch(input, init);
        if (!response.ok) return false;
        setOnline(true);
        return true;
      } catch {
        setOnline(false);
        return false;
      }
    },
    [setOnline],
  );

  const toggleTask = useCallback(
    async (task: Task) => {
      const next = !task.done;
      setNotice(null);
      setTasks((current) => {
        const updated = current.map((t) => (t.id === task.id ? { ...t, done: next } : t));
        cacheTasks(date, updated);
        return updated;
      });

      const ok = await persist(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: next }),
      });

      if (!ok) {
        setTasks((current) => {
          const reverted = current.map((t) => (t.id === task.id ? { ...t, done: task.done } : t));
          cacheTasks(date, reverted);
          return reverted;
        });
        flashFail(task.id, "That didn't save.");
      }
    },
    [date, flashFail, persist],
  );

  const addTask = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const text = draft.trim();
      if (!text || writesDisabled) return;

      const tempId = `pending-${Date.now()}`;
      const optimistic: Task = { id: tempId, text, done: false, ageDays: 0 };
      setDraft('');
      setNotice(null);
      setTasks((current) => [...current, optimistic]);

      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, text }),
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { task: Task };
        setTasks((current) => {
          const updated = current.map((t) => (t.id === tempId ? data.task : t));
          cacheTasks(date, updated);
          return updated;
        });
        setOnline(true);
      } catch {
        // Drop the line and hand the text back to the field, so the rollback
        // costs a tap rather than the sentence.
        setTasks((current) => current.filter((t) => t.id !== tempId));
        setDraft(text);
        setNotice("That didn't save. Try again.");
        setOnline(false);
      }
    },
    [date, draft, setOnline, writesDisabled],
  );

  const deleteTask = useCallback(
    async (task: Task) => {
      setActionTask(null);
      setNotice(null);
      const index = tasks.findIndex((t) => t.id === task.id);
      setTasks((current) => {
        const updated = current.filter((t) => t.id !== task.id);
        cacheTasks(date, updated);
        return updated;
      });

      const ok = await persist(`/api/tasks/${task.id}`, { method: 'DELETE' });
      if (!ok) {
        // Put it back exactly where it was, not at the end.
        setTasks((current) => {
          const restored = [...current];
          restored.splice(Math.max(0, index), 0, task);
          cacheTasks(date, restored);
          return restored;
        });
        flashFail(task.id, "Couldn't delete that.");
      }
    },
    [date, flashFail, persist, tasks],
  );

  const editTask = useCallback(
    async (task: Task, text: string) => {
      setActionTask(null);
      setNotice(null);
      setTasks((current) => {
        const updated = current.map((t) => (t.id === task.id ? { ...t, text } : t));
        cacheTasks(date, updated);
        return updated;
      });

      const ok = await persist(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!ok) {
        setTasks((current) => {
          const reverted = current.map((t) => (t.id === task.id ? { ...t, text: task.text } : t));
          cacheTasks(date, reverted);
          return reverted;
        });
        flashFail(task.id, "That didn't save.");
      }
    },
    [date, flashFail, persist],
  );

  /* ----------------------------------------------------------------- */
  /* Summary                                                            */
  /* ----------------------------------------------------------------- */

  const openSummary = useCallback(async () => {
    setSummaryOpen(true);
    setSummaryState('loading');
    try {
      // Read the cache first: this costs nothing, so tapping twice cannot
      // spend two API calls.
      const cachedResponse = await fetch(`/api/summary?week=${date}`, { cache: 'no-store' });
      if (cachedResponse.ok) {
        const data = await cachedResponse.json();
        if (data.body) {
          setSummaryBody(data.body);
          setSummaryAt(data.generatedAt);
          setSummaryState('ready');
          return;
        }
      }
      const generated = await fetch(`/api/summary?week=${date}`, { method: 'POST' });
      if (!generated.ok) throw new Error(String(generated.status));
      const data = await generated.json();
      setSummaryBody(data.body);
      setSummaryAt(data.generatedAt);
      setSummaryState('ready');
    } catch {
      setSummaryState('error');
    }
  }, [date]);

  const refreshSummary = useCallback(async () => {
    setSummaryState('loading');
    try {
      const response = await fetch(`/api/summary?week=${date}&refresh=1`, { method: 'POST' });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      setSummaryBody(data.body);
      setSummaryAt(data.generatedAt);
      setSummaryState('ready');
    } catch {
      setSummaryState('error');
    }
  }, [date]);

  /* ----------------------------------------------------------------- */
  /* Render                                                             */
  /* ----------------------------------------------------------------- */

  const goto = (delta: number) => {
    setSummaryOpen(false);
    setSummaryState('idle');
    setSummaryBody(null);
    setDate((current) => addDays(current, delta));
  };

  const dismissHint = () => {
    markHintSeen();
    setShowHint(false);
  };

  const summaryOpener = (
    <button type="button" className="summaryOpener" onClick={summaryOpen && wide ? () => setSummaryOpen(false) : openSummary}>
      {summaryOpen && wide ? 'Hide the week' : 'Summarize my week →'}
    </button>
  );

  return (
    <main className="board">
      {!online ? (
        <div className="offlineBar" role="status">
          Offline &mdash; showing the last day you loaded.{' '}
          <button
            type="button"
            className="offlineRetry"
            onClick={() => {
              loadTasks(date, { fromCache: false });
              loadCalendar(date);
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      <header className="header">
        <div className="headerDate">
          <div className="weekday">{weekdayName(date)}</div>
          <div className="dateLine">
            <span className="dayNum">{dayNumber(date)}</span>
            <span className="monthName">{monthName(date)}</span>
          </div>
        </div>

        {!isToday ? (
          <button type="button" className="todayBtn" onClick={() => setDate(today)}>
            Today
          </button>
        ) : null}

        <div className="navGroup">
          <button type="button" className="navBtn" aria-label="Previous day" onClick={() => goto(-1)}>
            &lsaquo;
          </button>
          <button type="button" className="navBtn" aria-label="Next day" onClick={() => goto(1)}>
            &rsaquo;
          </button>
        </div>

        {wide ? summaryOpener : null}
        {wide && summaryOpen ? (
          <SummaryView
            inline
            state={summaryState}
            body={summaryBody}
            generatedAt={summaryAt}
            onRefresh={refreshSummary}
            onClose={() => setSummaryOpen(false)}
          />
        ) : null}
      </header>

      <div className="body">
        <Schedule
          state={calState}
          events={events}
          partial={calPartial}
          onRetry={() => loadCalendar(date)}
        />

        <div className="taskColumn">
          <section className="tasks pane" aria-label="To-dos">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                failed={failedId === task.id}
                disabled={writesDisabled}
                onToggle={() => toggleTask(task)}
                onOpenActions={() => {
                  if (writesDisabled) return;
                  dismissHint();
                  setActionTask(task);
                }}
              />
            ))}

            {tasksReady && tasks.length === 0 ? (
              <div className="emptyTasks">
                {isToday
                  ? 'Nothing yet — add the first thing.'
                  : `Nothing on this day. Add something, or tap Today to go back.`}
              </div>
            ) : null}

            {showHint && tasks.length > 0 ? (
              <div className="hint">Hold a line to edit or delete it.</div>
            ) : null}

            {notice ? (
              <div className="hint" role="alert">
                {notice}
              </div>
            ) : null}
          </section>

          {!wide ? summaryOpener : null}

          <form className="addForm" onSubmit={addTask}>
            <input
              className="addInput"
              value={draft}
              maxLength={500}
              disabled={writesDisabled}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={isToday ? 'Add to today' : `Add to ${weekdayName(date)}`}
              aria-label={isToday ? 'Add to today' : `Add to ${weekdayName(date)}`}
              enterKeyHint="done"
              autoCapitalize="sentences"
              autoCorrect="on"
            />
            <button type="submit" className="addBtn" disabled={writesDisabled || !draft.trim()}>
              Add
            </button>
          </form>
        </div>
      </div>

      {actionTask ? (
        <ActionSheet
          task={actionTask}
          onClose={() => setActionTask(null)}
          onSave={(text) => editTask(actionTask, text)}
          onDelete={() => deleteTask(actionTask)}
        />
      ) : null}

      {!wide && summaryOpen ? (
        <SummaryView
          inline={false}
          state={summaryState}
          body={summaryBody}
          generatedAt={summaryAt}
          onRefresh={refreshSummary}
          onClose={() => setSummaryOpen(false)}
        />
      ) : null}
    </main>
  );
}
