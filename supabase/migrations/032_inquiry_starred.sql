-- 032_inquiry_starred.sql
-- Starred flag for the admin Emails page — admins pin hot leads and find
-- them under the Starred folder. A timestamp rather than a boolean, so
-- "when was it flagged" is free. Written by the service-role client only
-- (same PATCH route that owns read_at).
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS starred_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_inquiries_starred
  ON public.inquiries (starred_at DESC)
  WHERE starred_at IS NOT NULL AND deleted_at IS NULL;

COMMIT;
