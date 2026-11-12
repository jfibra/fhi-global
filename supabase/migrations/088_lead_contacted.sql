-- Migration 088: buyer_link_leads.contacted_at — lead follow-up tracking
-- (boss via Juliecor, 2026-11-12).
--
-- An agent marks a Buyers Link / Sellers Link brief as contacted (the Buyers
-- Link page's button, or "mark Maria as contacted" in their FHI Assistant);
-- NULL = not yet. The assistant's "which leads haven't I contacted" and the
-- "Leads to follow up" tile read it. Written only through
-- app/api/buyer-links/leads/[id]/contacted on the service role, by the lead's
-- own agent; the owner-only SELECT policy (060) already lets the page read it.
--
-- Idempotent for the runner.

BEGIN;

ALTER TABLE public.buyer_link_leads
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz;

COMMIT;
