-- 028_inquiries.sql
-- "Inquire Now" leads captured on public project pages, surfaced in the admin
-- Leads Inquiries page (Communication hub). Writes happen through the
-- service-role client (public POST /api/inquiries and the admin routes);
-- regular clients get no write path. RLS enables admin read.
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.inquiries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  email              TEXT NOT NULL,
  phone_country_code TEXT NOT NULL DEFAULT '+971',
  phone              TEXT NOT NULL,
  looking_for        TEXT NOT NULL CHECK (looking_for IN ('myself', 'agent')),
  property_category  TEXT NOT NULL CHECK (property_category IN ('off_plan', 'ready', 'rent')),
  -- Project context: FK for joins (projects.id is INTEGER) plus name snapshots
  -- resolved server-side at submit time, so the lead survives project deletion.
  project_id         INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name       TEXT,
  developer_name     TEXT,
  status             TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  contacted_at       TIMESTAMPTZ,
  source             TEXT NOT NULL DEFAULT 'project_page',
  ip_address         TEXT,
  user_agent         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inquiries_created
  ON public.inquiries (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inquiries_status
  ON public.inquiries (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inquiries_project
  ON public.inquiries (project_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.inquiries IS 'Inquire Now leads from public project pages; managed in the admin Leads Inquiries page.';

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Admin / super_admin may read; all writes go through the service-role client.
-- is_admin_profile() is defined in 008_audit_logs.sql (applied before this file).
DROP POLICY IF EXISTS "inquiries_select_admin" ON public.inquiries;
CREATE POLICY "inquiries_select_admin"
  ON public.inquiries FOR SELECT TO authenticated
  USING (public.is_admin_profile(auth.uid()));

COMMIT;
