-- Migration 057: agents' own events, shown on their personal website.
--
-- events.agent_id NULL      → a COMPANY event: created by admin staff, listed on
--                             the public /events page (unchanged behaviour).
-- events.agent_id = profile → that agent's OWN event: managed from their own
--                             dashboard Events page (they only ever see their
--                             own), shown only on their Website Builder site at
--                             /website/<site>/events/<event>, never on /events.
--
-- Registration, raffle, certificates and the flyer QR work the same for both.
-- Access is enforced in the app/api/admin/events routes (service-role client —
-- the events tables keep RLS on with only the public published-read policy).
--
-- Mirrors events.created_by: a plain reference, no ON DELETE action, so a
-- profile that owns events can't be hard-deleted out from under them (profiles
-- are soft-deleted in practice).
--
-- Additive: every existing event keeps agent_id NULL (a company event).
-- Idempotent for the runner, which re-applies every file on each run.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_events_agent_id
  ON public.events (agent_id)
  WHERE agent_id IS NOT NULL;

COMMIT;
