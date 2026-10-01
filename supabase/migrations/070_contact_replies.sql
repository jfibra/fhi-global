-- Migration 070: replies to contact messages (Communication → Contact Inbox).
--
-- The inbox could read and archive messages from /contact but never answer
-- them ("reply feature is under maintenance"). Replies go out through the
-- house mailbox (lib/mailer sendAdminDirectEmail) and are recorded here, one
-- row per reply, so the thread shows under the original message and the
-- bell/activity log can point at it. contact_submissions gets replied_at so
-- the inbox list can show "answered" without joining.
--
-- RLS enabled with no policies: only the service role (the admin API) reads
-- or writes these — same posture as inquiry_emails.
--
-- Additive and idempotent for the runner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.contact_replies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES public.contact_submissions(id) ON DELETE CASCADE,
  to_email       TEXT NOT NULL,
  to_name        TEXT,
  subject        TEXT NOT NULL,
  body_text      TEXT NOT NULL,
  sent_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_by_name   TEXT,
  status         TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_replies_submission
  ON public.contact_replies (submission_id, created_at);

ALTER TABLE public.contact_replies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

COMMIT;
