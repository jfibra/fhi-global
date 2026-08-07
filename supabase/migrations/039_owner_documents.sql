-- Migration 039: owner_documents (NOC / Trakheesi owner-document intake)
-- An agent creates a shareable "owner document request" from the dashboard and
-- sends the link to a property owner/landlord. The owner (UNAUTHENTICATED) opens
-- /owner-documents/<token>, enters their contact + property details, downloads a
-- pre-filled NOC authorization letter to sign, and uploads their documents
-- (title deed, Emirates ID/passport, signed NOC). Everything lands back in the
-- agent's dashboard to speed up the Trakheesi advertising-permit filing.
--
-- Writes from the public intake run through a service-role API (the token is a
-- bearer capability, validated server-side), so RLS here only needs:
--   • agent owner-scoped read + create/update of their own requests (dashboard)
--   • admin/super-admin read-all for oversight
-- No anon policies — mirrors 012_contact_submissions / 028_inquiries. Files are
-- child rows (repo convention), readable via their parent request. Idempotent;
-- the runner re-applies every file each run. is_admin_profile() is defined in
-- 008_audit_logs.sql (applied earlier).

BEGIN;

-- ── Requests ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_document_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token             text NOT NULL UNIQUE,               -- opaque capability in the URL
  agent_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label             text,                               -- agent-facing note, e.g. "Azizi Venice – Unit 1203"
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'cancelled')),
  -- Owner-submitted fields (null until the landlord submits) --
  owner_name        text,
  owner_id_number   text,                               -- Emirates ID / Passport No.
  owner_email       text,
  owner_mobile      text,
  property_building text,
  unit_number       text,
  community_area    text,
  title_deed_number text,
  noc_valid_until   date,
  submitted_at      timestamptz,
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

COMMENT ON TABLE public.owner_document_requests IS
  'Shareable owner/landlord document-intake requests for NOC/Trakheesi. Created by an agent; filled by an unauthenticated owner via a token link. Public writes go through a service-role API.';

CREATE INDEX IF NOT EXISTS owner_document_requests_agent_idx
  ON public.owner_document_requests (agent_id) WHERE deleted_at IS NULL;

ALTER TABLE public.owner_document_requests ENABLE ROW LEVEL SECURITY;

-- Creating agent reads their own (non-deleted) requests.
DROP POLICY IF EXISTS "owner_document_requests_select_own" ON public.owner_document_requests;
CREATE POLICY "owner_document_requests_select_own"
  ON public.owner_document_requests FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND agent_id = auth.uid());

-- Admin/super-admin read-all for oversight.
DROP POLICY IF EXISTS "owner_document_requests_select_staff" ON public.owner_document_requests;
CREATE POLICY "owner_document_requests_select_staff"
  ON public.owner_document_requests FOR SELECT TO authenticated
  USING (public.is_admin_profile(auth.uid()));

-- Agent creates their own request from the dashboard (browser client).
DROP POLICY IF EXISTS "owner_document_requests_insert_own" ON public.owner_document_requests;
CREATE POLICY "owner_document_requests_insert_own"
  ON public.owner_document_requests FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- Agent updates their own request (cancel / relabel). The owner's submission is
-- written by the service-role API, which bypasses RLS.
DROP POLICY IF EXISTS "owner_document_requests_update_own" ON public.owner_document_requests;
CREATE POLICY "owner_document_requests_update_own"
  ON public.owner_document_requests FOR UPDATE TO authenticated
  USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- ── Files (1:many) ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_document_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES public.owner_document_requests(id) ON DELETE CASCADE,
  doc_type    text NOT NULL CHECK (doc_type IN ('title_deed', 'emirates_id', 'passport', 'signed_noc', 'other')),
  file_name   text NOT NULL,
  file_url    text NOT NULL,                            -- final S3 URL
  file_type   text,                                     -- 'pdf' | 'image'
  file_size   bigint,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.owner_document_files IS
  'Uploaded owner documents (title deed, Emirates ID/passport, signed NOC) for an owner_document_requests row. Written by the service-role submit API; readable via the parent request.';

CREATE INDEX IF NOT EXISTS owner_document_files_request_idx
  ON public.owner_document_files (request_id);

ALTER TABLE public.owner_document_files ENABLE ROW LEVEL SECURITY;

-- Readable only when the parent request is visible to the caller (owner or admin).
DROP POLICY IF EXISTS "owner_document_files_select_via_request" ON public.owner_document_files;
CREATE POLICY "owner_document_files_select_via_request"
  ON public.owner_document_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.owner_document_requests r
      WHERE r.id = owner_document_files.request_id
        AND r.deleted_at IS NULL
        AND (r.agent_id = auth.uid() OR public.is_admin_profile(auth.uid()))
    )
  );

-- ── Storage bucket ────────────────────────────────────────────────────────────
-- PRIVATE bucket: owner uploads (sensitive title deeds / IDs) land here via a
-- server-minted signed upload URL (which bypasses bucket RLS, so NO storage
-- policy is needed), then the submit API downloads them service-side, moves them
-- to S3, and deletes the transient Supabase copy. Nothing is ever publicly
-- readable from this bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('owner-documents', 'owner-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

COMMIT;
