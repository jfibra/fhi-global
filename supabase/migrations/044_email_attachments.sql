-- 044_email_attachments.sql
-- File attachments on dashboard emails. Stored as descriptors — name, S3
-- url, size, content type — the bytes live under
-- fhi_global/email-attachments/ like every other upload in the app.
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

ALTER TABLE public.inquiry_emails
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
