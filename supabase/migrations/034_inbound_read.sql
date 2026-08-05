-- 034_inbound_read.sql
-- Unread state for inbound replies to composed (non-lead) emails. A reply
-- arrives with read_at NULL; opening its correspondence in the Sent folder
-- stamps it. Lead replies don't use this — they flip the inquiry itself back
-- to unread (inquiries.read_at), which feeds the Inbox badge.
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

ALTER TABLE public.inquiry_emails
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_inquiry_emails_unread_inbound
  ON public.inquiry_emails (from_email)
  WHERE direction = 'inbound' AND read_at IS NULL;

COMMIT;
