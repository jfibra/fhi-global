-- Agent-created property listings (sale/rent), optional link to a developer project.
-- Apply: npm run db:migrate or paste in Supabase SQL Editor (SQL only).

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  project_id INTEGER NULL REFERENCES public.projects (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  listing_kind TEXT NOT NULL CHECK (listing_kind IN ('sale', 'rent')),
  price NUMERIC(14, 2),
  currency TEXT NOT NULL DEFAULT 'AED',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_listings_agent_id
  ON public.agent_listings (agent_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_agent_listings_status_kind
  ON public.agent_listings (status, listing_kind)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.agent_listings IS 'Listings created by agents (sale/rent); optional link to developer project.';

ALTER TABLE public.agent_listings ENABLE ROW LEVEL SECURITY;

-- Policies are OR'd: own rows OR staff read-all
CREATE POLICY "agent_listings_select_own"
  ON public.agent_listings FOR SELECT
  USING (deleted_at IS NULL AND agent_id = auth.uid());

CREATE POLICY "agent_listings_select_staff"
  ON public.agent_listings FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_deleted, false) = false
        AND LOWER(TRIM(p.role)) IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "agent_listings_insert_own"
  ON public.agent_listings FOR INSERT
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agent_listings_update_own"
  ON public.agent_listings FOR UPDATE
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

COMMIT;
