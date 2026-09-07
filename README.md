# Day Board

A personal daily board for one person, built to live behind an icon on a phone
home screen. To-dos for a day, that day's calendar read-only beside them, and a
button that writes a summary of the week.

Phone first: 390px is the design target, the laptop layout is secondary.

## What it does, and what it deliberately does not

Three things: to-dos per day, a read-only schedule, a weekly summary.

No notifications. No streaks, stats, or habit tracking. No accounts or login
screen. No tags, priorities, subtasks, or recurring tasks. No offline sync
engine.

## How a task moves through a day

A task belongs to a calendar day in **Asia/Bangkok**, stored as a `DATE`. Not a
timestamp — a task belongs to a day, not an instant.

When you open **today**, anything still unfinished from an earlier day is moved
onto today in one statement:

```sql
update tasks set date = current_date where not done and date < current_date;
```

So nothing gets lost, and the past reads as settled — go back to last Tuesday
and you see what you finished, not what you abandoned.

`created_at` never moves. That single fact does three jobs:

- **Ordering.** Anything written on an earlier day sorts above today's new
  lines.
- **The margin age.** A task carried four days prints `4d` beside it.
- **The summary.** It can rank open work by how long you have been pushing it,
  which is why the second paragraph can tell you what to do first.

One consequence to know about: if you do not open the board for two weeks,
every open task from that period lands on today at once.

## Setup

You need a [Neon](https://neon.tech) database, one or more Google Calendar
secret iCal URLs, an [Anthropic](https://console.anthropic.com) API key, and a
random token.

```bash
npm install
cp .env.example .env.local     # then fill in all four values
openssl rand -hex 32           # use this for DASHBOARD_TOKEN
psql "$DATABASE_URL" -f db/schema.sql
npm run dev
```

For the calendar URLs, follow **[docs/CALENDAR.md](docs/CALENDAR.md)** — six
clicks per calendar, no OAuth. Multiple calendars go in one comma-separated
variable; two to four is the sensible number.

## Deploying

1. Push to a GitHub repo, then import it at [vercel.com/new](https://vercel.com/new).
2. Add all four environment variables under **Settings → Environment
   Variables**, for Production *and* Preview.
3. Deploy. The app is at `https://<project>.vercel.app`.
4. Run `db/schema.sql` against your Neon database once, if you have not already.

## Getting in

There is no login. Access is one secret URL:

```
https://<project>.vercel.app/d/<your DASHBOARD_TOKEN>
```

Opening it sets an `httpOnly` cookie that lasts a year, then redirects to `/`,
so the token stops appearing in the address bar, in history, and in every
subsequent line of the access log. Every other request without that cookie gets
a **404** — a stranger learns nothing.

**Keep that link in a password manager.** Clearing cookies is the only thing
that makes you need it again.

## Installing it on your iPhone

1. Open the secret `/d/<token>` link **in Safari** and wait for the board.
2. **Share** → **Add to Home Screen** → Add.
3. Open it from the icon.

If the installed app shows a 404 instead of the board, iOS gave it its own
cookie jar: paste the secret link into the installed app's address bar once and
it will stick.

## Using it

| Action | Gesture |
|---|---|
| Tick a task off | Tap the line |
| Edit or delete | **Hold** the line |
| Another day | `‹` `›`, then **Today** to come back |
| Weekly summary | **Summarize my week →** |

Everything you tap updates instantly and saves behind you. If a save fails the
line snaps back and flashes, so a lost write is never silent.

The summary is cached per week — tapping the button twice costs one API call.
**Write it again** is the only thing that spends another. At roughly 2k tokens
in and 300 out on `claude-opus-5`, a weekly summary costs on the order of a
cent a month.

Offline, the last day you loaded stays readable and writing is disabled. There
is no sync queue, by design.

## Backups

`/api/export` returns every task and summary as JSON, behind the same cookie.
There is no other copy of this data — visit it occasionally and keep the file.

## Layout of the code

```
app/
  page.tsx              the board (server-rendered, so "today" is always right)
  d/[token]/route.ts    the secret door: sets the cookie, redirects to /
  api/tasks/            list + add; roll-forward runs here on today's load
  api/tasks/[id]/       toggle, edit, delete
  api/calendar/         parses the iCal feed; fails quietly, never fatally
  api/summary/          cached per week; POST ?refresh=1 to spend a call
  api/export/           the backup
lib/
  dates.ts              every Bangkok-day rule lives here
  calendar.ts           iCal fetch + recurrence expansion
  summary.ts            the Anthropic call; server-only, key never ships
middleware.ts           the gate: no cookie, no board
db/schema.sql           two tables
```

## Verified

- `npm run build` clean; `tsc --noEmit` clean.
- Schema and every query run against a real Postgres: roll-forward moves only
  open past tasks and is idempotent, ages and carried-first ordering are
  correct, `PATCH` touches only the field you sent, the text constraint rejects
  blank and oversize input.
- The gate returns 404 for no cookie, a wrong cookie, a wrong token, and a
  near-miss token, on pages and every API route alike.
- Interaction: a tap toggles, a hold opens edit/delete without toggling, a
  scroll that starts as a press does not open it, a failed write rolls back and
  flashes, and the offline state can be recovered from.
- Calendar: recurrence, `EXDATE`, `RECURRENCE-ID`, all-day, multi-day, and
  cancelled events all produce byte-identical output on a UTC server and an
  Asia/Bangkok one.
- Multiple calendars merge in time order, an event on two feeds prints once,
  one dead feed still renders the others with a warning, and every feed dead
  falls back to the error line.

## Known limits

- **The calendar feed lags.** Google's cache, not ours. See
  [docs/CALENDAR.md](docs/CALENDAR.md).
- **Declined-event filtering is unverified** against real Google output, and is
  off unless `CALENDAR_OWNER_EMAIL` is set.
- **The timezone is hardcoded** to Asia/Bangkok. Travel and "today" stays
  Bangkok's today.
- **The schedule is capped** at 42% of the screen and scrolls beyond that, so a
  heavy day can never push the to-dos off the page. This is why two to four
  calendars works and ten does not.
- **Calendars are not visually distinguished.** Merged in time order, no colour
  or label, by design.
- **Recurring events in DST-observing timezones** may be an hour out around a
  transition. Bangkok and UTC have no DST, so this does not affect this
  deployment.
