-- 042_inbound_mailbox_owner.sql
-- Which mailbox an inbound email was pulled from. NULL = the house mailbox
-- (the admin mailroom, as before); a profile id = that person's personal
-- mailbox — visible only to them, exactly like their Sent folder. Outbound
-- rows stay NULL (their identity lives in from_email/sent_by).
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

ALTER TABLE public.inquiry_emails
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inquiry_emails_owner
  ON public.inquiry_emails (owner_id, created_at DESC)
  WHERE owner_id IS NOT NULL;

COMMIT;
