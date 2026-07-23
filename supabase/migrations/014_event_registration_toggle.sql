-- Migration 014: manual registration open/close per event
-- Admins can close registration (event full, cutoff reached) without
-- unpublishing the event page. Registration also auto-closes 24h after the
-- event date (computed in code — see lib/events/registration.ts).
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS registration_open boolean NOT NULL DEFAULT true;

COMMIT;
