-- Migration 069: document template library (admin Library → Documents).
--
-- Lets admin staff upload document templates through the dashboard — DLD
-- contract forms (Form A, Form B, Form F, …), agency agreements, company
-- templates — instead of the Materials/Ebooks pattern, where a developer
-- drops a file into a repo folder and redeploys. Files live in S3
-- (app/api/upload/document); this table is just the catalog: title, an
-- optional free-text category, the S3 URL, and who uploaded it.
--
-- Admin-staff only for now, both read and write — the feature is reachable
-- only from the admin/superadmin Library hub today. Widening it to other
-- roles later is a one-line RLS change (swap is_admin_profile for a broader
-- check), not a new table.
--
-- Additive and idempotent for the runner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  category    text,
  file_url    text NOT NULL,
  file_name   text NOT NULL,
  file_size   integer,
  mime_type   text,
  uploaded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents (category);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents (created_at DESC);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- is_admin_profile(uuid) already exists (008_audit_logs.sql).
DROP POLICY IF EXISTS "documents_select_admin" ON public.documents;
CREATE POLICY "documents_select_admin"
  ON public.documents FOR SELECT TO authenticated
  USING (public.is_admin_profile(auth.uid()));

DROP POLICY IF EXISTS "documents_insert_admin" ON public.documents;
CREATE POLICY "documents_insert_admin"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_profile(auth.uid()));

-- No update policy — a new upload replaces an old template rather than
-- editing one in place, matching the simple "upload / delete" UI.
DROP POLICY IF EXISTS "documents_delete_admin" ON public.documents;
CREATE POLICY "documents_delete_admin"
  ON public.documents FOR DELETE TO authenticated
  USING (public.is_admin_profile(auth.uid()));

COMMIT;
