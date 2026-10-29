-- Migration 082: a2a_agreements — saved A2A Collaboration Agreements + the
-- agency documents attached to them.
--
-- WHAT THIS ADDS
-- The A2A Agreement page (Agent Resource) used to save nothing: the PDF was
-- built in the browser and downloaded. Agents can now Save as draft, come back
-- later and Submit, and each party can attach its agency's papers — BRN card,
-- ORN certificate, trade licence, VAT certificate / undertaking, the agency
-- owner's passport and Emirates ID — plus a copy signed on paper.
--
--   a2a_agreements        one saved agreement. `data` is the A2AInput the page
--                         edits (lib/a2a-agreement.ts), drawn signatures
--                         included as PNG data URLs. `party_names`
--                         ("A · B · C") is written by the API so lists never
--                         load `data`.
--   a2a_agreement_files   one row per uploaded file; `party` is NULL only for
--                         the agreement-level signed copy.
--   a2a-documents bucket  PRIVATE transit storage: the browser uploads through a
--                         server-minted signed URL, the API moves the file to S3
--                         and deletes the transit copy (same flow as 039's
--                         owner-documents bucket).
--
-- WHO SEES WHAT
-- SELECT only. Every write goes through the service-role routes under
-- app/api/a2a-agreements (zod-validated, ownership-checked, audited) — the same
-- model as buyer_links. The creator reads their own agreements, drafts
-- included; admin / super-admin read SUBMITTED agreements only, so a draft stays
-- private until its creator submits it. Files follow their agreement, with the
-- staff condition spelled out rather than left to the parent table's RLS.
--
-- Additive only. Idempotent (IF NOT EXISTS / DROP … IF EXISTS / ON CONFLICT)
-- because the runner re-applies every migration on each run.
-- is_admin_profile() is defined in 008_audit_logs.sql.

BEGIN;

-- ── Agreements ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.a2a_agreements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  -- Signatures are tens of KB each; 1.5 MB leaves room for three and stops
  -- anything pathological from landing in a row.
  data          jsonb NOT NULL DEFAULT '{}'::jsonb
                CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 1500000),
  party_names   text NOT NULL DEFAULT '',
  submitted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.a2a_agreements IS
  'Saved A2A Collaboration Agreements (draft / submitted). data = the A2AInput incl. signature PNG data URLs. Written only by the service-role API; creator reads own, admins read submitted.';

CREATE INDEX IF NOT EXISTS a2a_agreements_created_by_idx
  ON public.a2a_agreements (created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS a2a_agreements_submitted_idx
  ON public.a2a_agreements (submitted_at DESC) WHERE status = 'submitted';

ALTER TABLE public.a2a_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "a2a_agreements_select_own" ON public.a2a_agreements;
CREATE POLICY "a2a_agreements_select_own"
  ON public.a2a_agreements FOR SELECT TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "a2a_agreements_select_staff" ON public.a2a_agreements;
CREATE POLICY "a2a_agreements_select_staff"
  ON public.a2a_agreements FOR SELECT TO authenticated
  USING (status = 'submitted' AND public.is_admin_profile(auth.uid()));

-- ── Files (1:many) ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.a2a_agreement_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id  uuid NOT NULL REFERENCES public.a2a_agreements(id) ON DELETE CASCADE,
  party         text CHECK (party IN ('A', 'B', 'C')),
  doc_type      text NOT NULL CHECK (doc_type IN (
                  'brn', 'orn', 'trade_licence', 'vat',
                  'owner_passport', 'owner_emirates_id', 'signed_copy'
                )),
  file_name     text NOT NULL,
  -- One row per stored object: a re-used signed upload URL can't register the
  -- same S3 key twice (deleting one row would break the other).
  file_url      text NOT NULL UNIQUE,
  file_type     text,                                  -- 'pdf' | 'image'
  file_size     bigint,
  uploaded_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  -- The signed copy belongs to the whole agreement; everything else to a party.
  CONSTRAINT a2a_agreement_files_party_doc_check CHECK ((doc_type = 'signed_copy') = (party IS NULL))
);

COMMENT ON TABLE public.a2a_agreement_files IS
  'Documents attached to an a2a_agreements row (BRN card, ORN certificate, trade licence, VAT, agency owner passport / Emirates ID per party; one signed copy per agreement). Written only by the service-role API.';

CREATE INDEX IF NOT EXISTS a2a_agreement_files_agreement_idx
  ON public.a2a_agreement_files (agreement_id);

ALTER TABLE public.a2a_agreement_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "a2a_agreement_files_select_via_agreement" ON public.a2a_agreement_files;
CREATE POLICY "a2a_agreement_files_select_via_agreement"
  ON public.a2a_agreement_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.a2a_agreements a
      WHERE a.id = a2a_agreement_files.agreement_id
        AND (
          a.created_by = auth.uid()
          OR (a.status = 'submitted' AND public.is_admin_profile(auth.uid()))
        )
    )
  );

-- ── Transit bucket ──────────────────────────────────────────────────────────
-- PRIVATE. Uploads arrive through server-minted signed upload URLs (which
-- bypass bucket RLS, so no storage policy is needed); the API moves each file
-- to S3 and deletes the transit copy. Supabase itself enforces the size and
-- type limits the page shows.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'a2a-documents', 'a2a-documents', false, 26214400,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
