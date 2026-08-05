-- 033_inbound_emails.sql
-- Two-way threads for the admin Emails page: replies a lead sends from their
-- own mail client are pulled in over IMAP (lib/inbound-mail.ts) and stored in
-- inquiry_emails alongside what we sent, distinguished by `direction`.
-- message_id (the email's Message-ID header) is the dedup key so a message is
-- never ingested twice; outbound rows leave it NULL.
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

ALTER TABLE public.inquiry_emails
  ADD COLUMN IF NOT EXISTS direction  TEXT NOT NULL DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS from_email TEXT,
  ADD COLUMN IF NOT EXISTS from_name  TEXT,
  ADD COLUMN IF NOT EXISTS message_id TEXT;

-- Re-created on every run to stay idempotent under the tracking-free runner.
ALTER TABLE public.inquiry_emails DROP CONSTRAINT IF EXISTS inquiry_emails_direction_check;
ALTER TABLE public.inquiry_emails ADD CONSTRAINT inquiry_emails_direction_check
  CHECK (direction IN ('outbound', 'inbound'));

-- Inbound rows carry status 'received' (outbound keeps sent/failed).
ALTER TABLE public.inquiry_emails DROP CONSTRAINT IF EXISTS inquiry_emails_status_check;
ALTER TABLE public.inquiry_emails ADD CONSTRAINT inquiry_emails_status_check
  CHECK (status IN ('sent', 'failed', 'received'));

-- Unique dedup guard for the IMAP sync; Postgres allows many NULLs here, so
-- outbound rows are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inquiry_emails_message_id
  ON public.inquiry_emails (message_id);

CREATE INDEX IF NOT EXISTS idx_inquiry_emails_direction
  ON public.inquiry_emails (direction, created_at DESC);

COMMIT;
