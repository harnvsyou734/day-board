# Wiring up Google Calendar

No OAuth. No Google Cloud project. No consent screen. No refresh token to
store or rotate. Google will hand you a private URL that returns your calendar
as an `.ics` file, and the server fetches it.

## Getting the URL

1. Open **[calendar.google.com](https://calendar.google.com)** on a laptop.
   The setting below does not exist in the phone app.
2. Click the **gear icon** (top right) → **Settings**.
3. In the left sidebar, under **Settings for my calendars**, click the calendar
   you want. For your primary one this is your own name or email address.
   Click the *name*, not "Add calendar".
4. Scroll down the middle pane to **Integrate calendar**.
5. Find **Secret address in iCal format**. It is masked until you click it.
   Click the copy button. It looks like:
   `https://calendar.google.com/calendar/ical/you%40gmail.com/private-1a2b3c.../basic.ics`
6. Paste it into `.env.local` as `CALENDAR_ICS_URL`, and into your Vercel
   project's environment variables.

> Do not use "Public address in iCal format". That one requires making your
> calendar public to the world.

## More than one calendar

**There is no combined feed.** Google publishes a separate secret address per
calendar, so repeat steps 3-5 for each one you want and join them with commas:

```
CALENDAR_ICS_URL=https://.../personal/basic.ics,https://.../uni/basic.ics
```

Commas or newlines both work; whitespace is trimmed.

They are merged into one timetable in time order, with all-day events pinned
above timed ones. There is no per-calendar colour or label: at 08:00 you want
to know what is happening and when, not which calendar it came from. An event
sitting on two of your calendars keeps the same UID, so it prints once, not
twice.

**Pick two to four, not ten.** The phone layout caps the schedule at 42% of the
screen height so a heavy day can never push the to-dos off the page -- feed it
ten calendars and you get a scrolling wall above your actual list.

Each feed is downloaded and parsed once per request, no matter how many days
are being rendered: the weekly summary across four calendars is four requests,
not twenty-eight.

### When one calendar fails

- **Some feeds fail:** the rest still render, with a quiet line reading "One of
  your calendars didn't load." A missing feed must never pass for a free
  afternoon.
- **Every feed fails:** the schedule shows "Couldn't load the schedule." with a
  **Try again**. The to-dos are unaffected either way.

## Treat that URL as a password

Anyone holding it can read your entire calendar, forever, without signing in.
It is why `.env.local` is gitignored and why it belongs in Vercel's
environment variables rather than in the repo.

If it leaks, open the same screen and click **Reset** next to the secret
address. The old URL dies immediately; paste the new one into Vercel.

## The one real drawback

**Google caches this feed.** An event you add on your phone can take a while to
show up on the board — often minutes, sometimes hours. Google controls that
cache and nothing in this codebase can shorten it.

This is the tradeoff you chose over full OAuth. If it starts to bite, only
`lib/calendar.ts` has to change: everything above it consumes a
`CalendarEvent[]` and does not care where the events came from. Adding an
OAuth implementation later means writing a second function with the same
signature, not restructuring the app.

## What the parser handles

Verified against a fixture feed, under both a UTC server (what Vercel runs) and
an Asia/Bangkok one (what your WSL box runs), producing identical output:

| Case | Behaviour |
|---|---|
| Simple timed events | Shown at their Bangkok clock time |
| Weekly recurring events | Expanded, including late-evening ones |
| `EXDATE` | That single occurrence is dropped |
| `RECURRENCE-ID` | The edited instance replaces the generated one |
| All-day events | Pinned above timed events, no time printed |
| Multi-day all-day events | Shown on each day; `DTEND` is exclusive |
| `STATUS:CANCELLED` | Hidden |
| Declined invitations | Hidden — see the caveat below |

### Two deliberate decisions

**An event belongs to the day it starts on.** A session running 23:00–01:00
appears on the day it began, not on both. Showing it on both put a "23:00" line
above the next morning's "09:00" — an event already over by the time you opened
the board.

**Declined events are filtered only when `CALENDAR_OWNER_EMAIL` is set.**
Google's private feed is inconsistent about whether declined events appear at
all, and about whether the `ATTENDEE` line carries your address. So the filter
only fires when an attendee's address matches that variable exactly *and* its
`PARTSTAT` is `DECLINED`. With the variable unset, nothing is filtered on those
grounds and nothing is silently hidden. **Check this against your own feed**
before relying on it — it is the one behaviour here I could not verify against
real Google output.
