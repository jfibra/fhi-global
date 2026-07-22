-- 012_contact_submissions.sql
-- Public /contact form submissions, surfaced in the admin Contact Inbox.
-- Writes happen through the service-role client (public POST /api/contact and
-- the admin routes); regular clients get no write path. RLS enables admin read.
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  company     TEXT,
  subject     TEXT,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  source      TEXT NOT NULL DEFAULT 'contact_page',
  ip_address  TEXT,
  user_agent  TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created
  ON public.contact_submissions (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contact_submissions_status
  ON public.contact_submissions (status)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.contact_submissions IS 'Public /contact form submissions; managed in the admin Contact Inbox.';

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Admin / super_admin may read; all writes go through the service-role client.
-- is_admin_profile() is defined in 008_audit_logs.sql (applied before this file).
DROP POLICY IF EXISTS "contact_submissions_select_admin" ON public.contact_submissions;
CREATE POLICY "contact_submissions_select_admin"
  ON public.contact_submissions FOR SELECT TO authenticated
  USING (public.is_admin_profile(auth.uid()));

COMMIT;
