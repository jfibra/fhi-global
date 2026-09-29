-- Migration 067: an agent's event, hand-picked for the public /events page.
--
-- events.show_on_main (default false) — switched on by admin staff only, from
-- the dashboard Events page ("Add to fhiglobal.ae" on an agent's event).
--   agent_id NULL (company event)  → always listed on /events; the flag is ignored.
--   agent_id set (agent's event)   → on their website (migration 057) and, only
--                                    while this is true, listed on /events too.
--                                    Its /events/<slug> page keeps forwarding to
--                                    the agent's website, so the lead stays theirs.
-- The API drops the field for owners (app/api/admin/events/[id]), so an agent
-- can't put themselves on the main page.
--
-- Additive and idempotent (the runner re-applies every file).

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS show_on_main boolean NOT NULL DEFAULT false;

-- The public list asks "company, or picked" — the picked ones are few.
CREATE INDEX IF NOT EXISTS idx_events_show_on_main
  ON public.events (show_on_main)
  WHERE show_on_main;

COMMIT;
