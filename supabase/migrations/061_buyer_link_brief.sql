-- Migration 061: Buyers Link becomes one link per agent with a buyer brief.
--
-- Revision of 060. Instead of many links, each with hand-picked projects, an
-- agent now has ONE permanent link (/b/<code>). A client who opens it answers
-- a four-step brief (details, buying profile, preferences, financials) and it
-- lands in that agent's Buyers Link page, like recruits on the Invite page.
--
-- * buyer_links: at most one row per agent. title / note / project_ids stay
--   for compatibility but are no longer used by the app.
-- * buyer_link_leads.profile: the brief's answers as validated option keys
--   (see BUYER_QUESTIONS in lib/buyer-links.ts). Name, WhatsApp, email,
--   budget, best time and message keep their own columns.
--
-- Both tables were empty when this shipped, so the unique index is safe.
-- Additive and idempotent for the runner.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_links_agent
  ON public.buyer_links (agent_id);

ALTER TABLE public.buyer_link_leads
  ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
