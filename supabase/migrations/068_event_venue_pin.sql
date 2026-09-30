-- Migration 068: the exact spot of an event's venue.
--
-- The venue box in the dashboard's event form suggests real places (Google
-- Places); picking one stores its coordinates and place id here, and the
-- public event page shows it on a map. `venue` stays the text printed on the
-- page and the flyer. All three are NULL when the venue was typed freely
-- (older events, or no suggestion picked) — the page then shows no map rather
-- than guessing a spot from text like "Manila".
--
-- Additive and idempotent (the runner re-applies every file).

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_lat double precision,
  ADD COLUMN IF NOT EXISTS venue_lng double precision,
  ADD COLUMN IF NOT EXISTS venue_place_id text;

COMMIT;
