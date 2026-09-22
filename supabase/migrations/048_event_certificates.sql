-- Migration 048: certificates of attendance for events
--
-- Each event carries its certificate design settings (heading, wording and
-- up to two signatories) and each registration records when its certificate
-- was emailed, so the admin can send in bulk to everyone not yet sent, or
-- one at a time, and see who has received theirs.
--
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

-- { "heading": "Certificate of Attendance", "line": "for attending",
--   "note": "", "signatories": [{ "name": "…", "title": "…" }, …] }
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS certificate jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS certificate_sent_at timestamptz;

COMMIT;
