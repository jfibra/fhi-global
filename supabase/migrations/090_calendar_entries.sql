-- Migration 090: calendar_entries — what admins put on the company calendar
-- (boss via Juliecor, 2026-11-13).
--
-- The admin Calendar page (/admin/calendar) draws most of its blocks from
-- data the system already holds (events, project milestones, deals,
-- birthdays, owner-document expiries, the automatic emails, UAE holidays).
-- This table holds the one thing admins type in themselves: meetings,
-- trainings, roadshows, developer launches, deadlines and office closures.
--
-- An entry runs from starts_on to ends_on (the same day for a one-day entry),
-- at start_time/end_time (Dubai "HH:MM") or all day. `audience` says who the
-- entry is for — admins only, all staff, team leaders, or one team — which
-- today decides who gets the morning email when notify_morning is on
-- (app/api/cron/assistant-notes); `notified_on` is stamped when that email
-- went, so it goes once.
--
-- Service role only: the admin API (app/api/admin/calendar/entries) reads
-- and writes behind requireRole; nobody reads it through RLS.
--
-- Idempotent for the runner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.calendar_entries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  kind          text        NOT NULL DEFAULT 'meeting'
                            CHECK (kind IN ('meeting', 'training', 'roadshow', 'launch', 'deadline', 'closure', 'other')),
  starts_on     date        NOT NULL,
  ends_on       date        NOT NULL,
  -- Dubai wall-clock "HH:MM"; both null when all_day.
  start_time    text,
  end_time      text,
  all_day       boolean     NOT NULL DEFAULT false,
  place         text,
  link          text,
  notes         text,
  audience      text        NOT NULL DEFAULT 'admins'
                            CHECK (audience IN ('admins', 'staff', 'leaders', 'team')),
  team_id       uuid        REFERENCES public.teams (id) ON DELETE SET NULL,
  notify_morning boolean    NOT NULL DEFAULT false,
  notified_on   date,
  created_by    uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT calendar_entries_span CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS idx_calendar_entries_span ON public.calendar_entries (starts_on, ends_on) WHERE deleted_at IS NULL;

ALTER TABLE public.calendar_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_entries TO service_role;

COMMIT;
