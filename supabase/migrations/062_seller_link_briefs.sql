-- Migration 062: Sellers Link.
--
-- The agent's one link (migration 061) now has two public pages: /b/<code>
-- for buyers and /s/<code> for owners who want to sell a property through
-- that agent. Both briefs land in buyer_link_leads; `kind` says which form
-- sent it, and a seller's answers live in `profile` like a buyer's (budget
-- stays NULL for sellers). RLS is unchanged: owners read their own rows.
--
-- Additive and idempotent for the runner.

BEGIN;

ALTER TABLE public.buyer_link_leads
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'buyer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'buyer_link_leads_kind_check'
  ) THEN
    ALTER TABLE public.buyer_link_leads
      ADD CONSTRAINT buyer_link_leads_kind_check CHECK (kind IN ('buyer', 'seller'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_buyer_link_leads_agent_kind
  ON public.buyer_link_leads (agent_id, kind, created_at DESC);

COMMIT;
