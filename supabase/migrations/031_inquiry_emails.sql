-- 031_inquiry_emails.sql
-- The admin Emails page (formerly Leads Inquiries) becomes a Gmail-style
-- inbox: every reply an admin sends to a lead — and every standalone email
-- composed from the dashboard — is recorded here so the thread persists.
-- Sending happens server-side through lib/mailer.ts (SMTP); rows are written
-- by the service-role client only. RLS enables admin read.
--
-- Also adds inquiries.read_at: Gmail-style unread. "Read" (an admin opened
-- it) is deliberately separate from status 'contacted' (an admin actually
-- reached out).
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Leads someone already acted on shouldn't come back as unread when the
-- column first appears. read_at IS NULL keeps this a one-time backfill.
UPDATE public.inquiries
SET read_at = COALESCE(contacted_at, updated_at, created_at)
WHERE read_at IS NULL AND status <> 'new';

CREATE TABLE IF NOT EXISTS public.inquiry_emails (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = a standalone composed email (not tied to a lead). Deleting a lead
  -- takes its thread with it.
  inquiry_id   UUID REFERENCES public.inquiries(id) ON DELETE CASCADE,
  to_email     TEXT NOT NULL,
  to_name      TEXT,
  subject      TEXT NOT NULL,
  -- What the admin typed. The branded HTML wrapper is regenerated at send
  -- time and already lands in the audit log (category "mailer").
  body_text    TEXT NOT NULL,
  sent_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_by_name TEXT,
  status       TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_emails_inquiry
  ON public.inquiry_emails (inquiry_id, created_at);

CREATE INDEX IF NOT EXISTS idx_inquiry_emails_created
  ON public.inquiry_emails (created_at DESC);

COMMENT ON TABLE public.inquiry_emails IS 'Emails sent from the admin Emails page: replies to leads (inquiry_id set) and standalone composed messages (inquiry_id NULL).';

ALTER TABLE public.inquiry_emails ENABLE ROW LEVEL SECURITY;

-- Admin / super_admin may read; all writes go through the service-role client.
-- is_admin_profile() is defined in 008_audit_logs.sql (applied before this file).
DROP POLICY IF EXISTS "inquiry_emails_select_admin" ON public.inquiry_emails;
CREATE POLICY "inquiry_emails_select_admin"
  ON public.inquiry_emails FOR SELECT TO authenticated
  USING (public.is_admin_profile(auth.uid()));

COMMIT;
