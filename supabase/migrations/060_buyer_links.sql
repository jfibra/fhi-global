-- Migration 060: Buyers Link.
--
-- Agent Resource → Buyers Link: an agent picks up to six projects and gets a
-- short link (/b/<code>) to send a client. The client sees those projects —
-- photos, price, payment plan — and can leave their details (name, WhatsApp,
-- optional email, budget, best time to contact, message, which projects), and
-- the lead goes to that agent's Buyers Link page.
--
-- Every write goes through the service-role API (app/api/buyer-links/*): link
-- creation, pausing and deleting are role-guarded and owner-only, lead inserts
-- come from the public form (validated, honeypot, rate-limited). Owners read their own links and
-- leads under RLS; nobody else does.
--
-- Additive and idempotent for the runner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.buyer_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The /b/<code> address: 8 random characters, no look-alikes (0/o, 1/l/i).
  code        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  note        TEXT,
  -- projects.id values in the agent's order; the page shows only published ones.
  project_ids INTEGER[] NOT NULL DEFAULT '{}',
  -- Paused links show "no longer available" and accept no new leads.
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buyer_links_agent
  ON public.buyer_links (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.buyer_link_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id       UUID NOT NULL REFERENCES public.buyer_links(id) ON DELETE CASCADE,
  -- Copied from the link so RLS and the agent's lead list need no join.
  agent_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  whatsapp_code TEXT NOT NULL,
  whatsapp      TEXT NOT NULL,
  email         TEXT,
  budget        TEXT,
  contact_time  TEXT,
  message       TEXT,
  -- The projects the client ticked (a subset of the link's).
  project_ids   INTEGER[] NOT NULL DEFAULT '{}',
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buyer_link_leads_agent
  ON public.buyer_link_leads (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_link_leads_link
  ON public.buyer_link_leads (link_id);

ALTER TABLE public.buyer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_link_leads ENABLE ROW LEVEL SECURITY;

-- Owners read their own; there are no client write policies at all.
DROP POLICY IF EXISTS "buyer_links_select_own" ON public.buyer_links;
CREATE POLICY "buyer_links_select_own"
  ON public.buyer_links FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

DROP POLICY IF EXISTS "buyer_link_leads_select_own" ON public.buyer_link_leads;
CREATE POLICY "buyer_link_leads_select_own"
  ON public.buyer_link_leads FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

COMMIT;
