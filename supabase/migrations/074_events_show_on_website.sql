-- Migration 074: agents choose where their events appear (boss, 2026-10-04).
--
-- events.show_on_website (default true) joins show_on_main (067). For an
-- agent's event (agent_id set) the two flags are now the AGENT's choice:
--   fhiglobal.ae only → show_on_main true,  show_on_website false
--   website only      → show_on_main false, show_on_website true
--   both              → show_on_main true,  show_on_website true
-- Never both false (app/api/admin/events refuses it). Company events
-- (agent_id NULL) ignore both: always on /events.
--
-- Same day, every agent event that already existed was put on the main page
-- too (and kept on its website). That one-time update runs only when this
-- migration first adds the column — the runner re-applies every file, and a
-- plain UPDATE here would keep undoing agents' later choices.
--
-- Additive and idempotent for the runner.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'show_on_website'
  ) THEN
    ALTER TABLE public.events ADD COLUMN show_on_website boolean NOT NULL DEFAULT true;

    UPDATE public.events
      SET show_on_main = true
      WHERE agent_id IS NOT NULL AND deleted_at IS NULL AND show_on_main = false;
  END IF;
END $$;

COMMIT;
