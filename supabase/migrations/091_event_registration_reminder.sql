-- Migration 091: event_registrations.reminder_sent_at — the day-before
-- reminder email (boss via Juliecor, 2026-11-14).
--
-- The daily cron (app/api/cron/assistant-notes, 09:00 Dubai) emails everyone
-- registered for an event that starts tomorrow — "See you tomorrow", the
-- venue, the map, and Add-to-calendar buttons. This stamp makes it go once
-- per registration, however often the cron is run by hand.
--
-- Idempotent for the runner.

BEGIN;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS event_registrations_unreminded_idx
  ON public.event_registrations (event_id)
  WHERE reminder_sent_at IS NULL;

COMMIT;
