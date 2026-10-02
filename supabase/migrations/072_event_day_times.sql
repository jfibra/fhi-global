-- Migration 072: a start time per day for multi-day events.
--
-- Agents asked for day 2 at 10:00 and day 3 at 11:00 and so on. day_times
-- holds one "HH:MM" Dubai start time per day, day 1 first (day 1 mirrors
-- event_date); a null entry means "same time as day 1". Written by
-- lib/events/validate.ts through normalizeDayTimes, read by lib/events/dates.ts.
--
-- Additive and idempotent for the runner.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS day_times jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
