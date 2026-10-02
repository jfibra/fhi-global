-- Migration 071: multi-day events.
--
-- Agents run two- and three-day events (summits, roadshows). An event keeps
-- its start in event_date and now says how many consecutive days it runs;
-- the end is derived (lib/events/dates.ts), so it can never come before the
-- start. Existing events are one-day events.
--
-- Additive and idempotent for the runner.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_days smallint NOT NULL DEFAULT 1;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_days_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_event_days_check CHECK (event_days BETWEEN 1 AND 14);

COMMIT;
