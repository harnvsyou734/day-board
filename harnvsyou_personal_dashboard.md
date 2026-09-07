# Build spec: personal day board

## Read this first

Do not start coding. Read the whole spec, then ask me the questions in
"Before you write anything" at the bottom. Wait for my answers. Then write
a short plan (files, data model, routes) and let me approve it.

## What I'm building and why

A personal daily board I open on my phone. One user — me. It does three things:

1. I add to-dos for a specific day, and check them off.
2. It shows my Google Calendar events for that day, read-only.
3. A button gives me a weekly summary: what's heavy, what's still unfinished,
   what to watch out for.

I already have a working prototype as a Claude artifact. It works, but it lives
inside a chat conversation, so I have to hunt for it. The whole point of this
rebuild is that it gets an icon on my phone's home screen.

## Non-goals — do not build these

- No notifications, reminders, or anything that pings me. I open it myself.
- No habit tracking, streaks, stats, or analytics. I don't want to be tracked.
- No accounts, login screens, or multi-user support. Single user, me.
- No task categories, tags, priorities, subtasks, or recurring tasks. Flat list
  per day. If you think I need more structure, say so, don't build it.
- No offline sync engine. Being online is fine.

If a feature isn't in the three numbered items above, it's out of scope. Ask
before adding anything.

## Stack

Propose one and tell me why. My context, so you can pick sensibly:

- I'm a computer engineering student, comfortable with Python and JS.
- Windows with WSL Ubuntu, VS Code.
- I already run a Telegram bot on the Anthropic SDK, so I have a place to host
  a small service if that's the sane route.
- I'd rather have few moving parts than a clever architecture.

Requirements the stack has to satisfy:

- Installable to an iOS/Android home screen (PWA with a manifest and an icon).
  This is the main reason the rebuild exists — don't treat it as optional polish.
- Phone-first layout. Assume a 390px viewport is the primary target and a laptop
  is the secondary one.
- Data survives reinstalls and is readable from more than one device. That rules
  out localStorage as the only store.

## Data model

Tasks, keyed by date:

```
{ date: "2026-09-07", id: string, text: string, done: boolean, created_at }
```

That's it. Dates are local time, Asia/Bangkok. Don't store UTC timestamps for
the date field — a task belongs to a calendar day, not an instant.

Calendar events are never stored. Always fetched live.

## Google Calendar

This is the part most likely to eat a whole evening, so plan it explicitly
before writing code.

- Read-only access, one calendar (my primary), one user.
- Walk me through getting OAuth credentials from Google Cloud Console step by
  step — I've never done it. Tell me exactly which screens and which scope.
- Handle the refresh token so I authorize once and never again. Tell me where
  the token is stored and make sure it's gitignored.
- If the calendar call fails, the app still works. To-dos are the core; the
  schedule is a bonus. Fail quietly with a small "couldn't load schedule" line,
  never a blank screen or a crash.

If you think there's a meaningfully simpler path than full OAuth for a
single-user read-only case, propose it before building.

## Weekly summary

- Uses the Anthropic SDK, called from the server, never from the browser. The
  API key must not reach the client.
- Input: the current week's tasks (done and open) plus that week's calendar events.
- Output: three short parts — shape of the week, what's still unfinished in the
  order to tackle it, one thing to watch out for. Under 200 words.
- Show it in the UI as plain text. Don't render markdown.
- Cache the result for the week so tapping twice doesn't spend two API calls.
  Add a way to force a refresh.

## Quality bar

- Tapping a checkbox feels instant. Update the UI first, persist after; roll
  back visibly if the write fails.
- Empty states say what to do next, not "No data".
- Keyboard focus is visible. Text is readable in bright sunlight — this gets
  opened outdoors.
- No loading spinner covering the whole screen. To-dos render immediately from
  storage; the schedule fills in when it arrives.

## Before you write anything

Ask me:

1. Where should this be hosted, and do I already have somewhere?
2. Do I want the same repo as my Telegram bot, or a fresh one?
3. Since there's no login, how do we keep a stranger with the URL from seeing
   my tasks? Give me two or three options with the tradeoffs, and let me pick.

Then give me the plan before the code.
