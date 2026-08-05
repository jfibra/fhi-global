-- Migration 029: construction_updates
-- Per-project construction-progress attachments (PDF or image) that a developer,
-- admin, or editor uploads in the project studio and that appear on the public
-- project page. Writes go through a service-role API (ownership-checked), so
-- RLS here only needs read policies: anon/public read when the parent project is
-- published + live, plus admin read-all for management. Idempotent; the runner
-- re-applies every file each run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.construction_updates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  file_url    text NOT NULL,
  file_type   text NOT NULL CHECK (file_type IN ('pdf', 'image')),
  uploaded_by uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.construction_updates IS
  'Per-project construction-progress files (PDF/image). Managed via service-role API; public-readable when the parent project is published.';

CREATE INDEX IF NOT EXISTS construction_updates_project_idx
  ON public.construction_updates (project_id);

ALTER TABLE public.construction_updates ENABLE ROW LEVEL SECURITY;

-- Public (anon + authenticated) read only when the parent project is published
-- and not soft-deleted — mirrors the parent-scoped pattern in 004_agent_listing_images.
DROP POLICY IF EXISTS "construction_updates_public_read" ON public.construction_updates;
CREATE POLICY "construction_updates_public_read"
  ON public.construction_updates FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = construction_updates.project_id
        AND p.is_published = true
        AND p.deleted_at IS NULL
    )
  );

-- Admin/super-admin read-all for management. Developers/editors list their own
-- (incl. unpublished) via the service-role API, which bypasses RLS.
-- is_admin_profile() is defined in 008_audit_logs.sql (applied earlier).
DROP POLICY IF EXISTS "construction_updates_admin_read" ON public.construction_updates;
CREATE POLICY "construction_updates_admin_read"
  ON public.construction_updates FOR SELECT TO authenticated
  USING (public.is_admin_profile(auth.uid()));

COMMIT;
