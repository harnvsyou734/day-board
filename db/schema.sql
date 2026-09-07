-- Day Board schema. Run once against your Neon database:
--   psql "$DATABASE_URL" -f db/schema.sql
-- or paste it into the Neon SQL Editor.

-- Tasks belong to a calendar day, not an instant, so `date` is a DATE.
-- It is always a day in Asia/Bangkok; the app never converts it.
--
-- `created_at` is the one timestamp, and it never moves. The daily
-- roll-forward rewrites `date` so an unfinished task follows you to today,
-- which is why the past looks clean -- but created_at still records when the
-- task was first written down. That difference is what gives the list its
-- "carried" ordering and the margin age ("4d"), and what lets the weekly
-- summary rank open work by how long you have been pushing it.
create table if not exists tasks (
  id         uuid        primary key default gen_random_uuid(),
  date       date        not null,
  -- The day this task was FIRST put on. Set once at insert and never changed.
  --
  -- `date` moves (the roll-forward below), `first_date` does not, so
  -- `date - first_date` is exactly "how many days this has been pushed".
  --
  -- created_at cannot answer that question: a task written today and filed
  -- against Wednesday would read as two days old the moment you create it,
  -- which is both a wrong margin mark and a wrong nudge in the summary.
  -- Planning ahead is not procrastinating.
  first_date date        not null,
  text       text        not null check (length(btrim(text)) between 1 and 500),
  done       boolean     not null default false,
  created_at timestamptz not null default now()
);

-- Upgrade path for a database created before first_date existed. Backfills
-- from created_at, which is the best available guess for old rows.
alter table tasks add column if not exists first_date date;
update tasks set first_date = (created_at at time zone 'Asia/Bangkok')::date
  where first_date is null;
alter table tasks alter column first_date set not null;

-- The day view's only query: everything on one date, carried lines first.
create index if not exists tasks_date_idx on tasks (date, first_date, created_at);

-- Open tasks from before today, i.e. exactly what the roll-forward moves.
create index if not exists tasks_open_idx on tasks (date) where not done;

-- One cached summary per week, keyed by that week's Monday. Tapping the
-- button twice must not spend two API calls; the refresh button overwrites.
create table if not exists summaries (
  week_start   date        primary key,
  body         text        not null,
  generated_at timestamptz not null default now()
);
