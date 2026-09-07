'use client';

import type { CalendarEvent } from '@/lib/types';

type Props = {
  state: 'loading' | 'ok' | 'error';
  events: CalendarEvent[];
  /** Some calendars loaded and others did not. */
  partial: boolean;
  onRetry: () => void;
};

/**
 * The printed half of the board: a single locked column with a solid ink edge,
 * ruled rows and tabular times. Nothing here is interactive except the retry
 * link, because nothing here is yours to change -- it is a read of the calendar.
 *
 * A calendar failure is a quiet line, never a blank screen: the to-dos are the
 * point and they render regardless.
 */
export default function Schedule({ state, events, partial, onRetry }: Props) {
  if (state === 'error') {
    return (
      <section className="scheduleError">
        <div className="scheduleErrorText">Couldn&rsquo;t load the schedule.</div>
        <button type="button" className="linkBtn" onClick={onRetry}>
          Try again
        </button>
      </section>
    );
  }

  // While it is still in flight the space stays empty rather than showing a
  // spinner -- the schedule fills in when it arrives.
  if (state === 'loading') return null;

  if (events.length === 0) {
    return (
      <section className="scheduleNote">
        Nothing scheduled.
        {partial ? <div className="schedulePartial">One of your calendars didn&rsquo;t load.</div> : null}
      </section>
    );
  }

  return (
    <section className="schedule pane" aria-label="Schedule">
      {events.map((event) => (
        <div className="event" key={event.id}>
          <div className="eventTime">{event.allDay ? 'all day' : event.time}</div>
          <div>
            <div className="eventTitle">{event.title}</div>
            {event.location ? <div className="eventLoc">{event.location}</div> : null}
          </div>
        </div>
      ))}
      {/* Never let a dead feed pass for an empty day. */}
      {partial ? (
        <div className="schedulePartial">One of your calendars didn&rsquo;t load.</div>
      ) : null}
    </section>
  );
}
