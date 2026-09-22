-- Migration 049: self-service certificate downloads
-- Attendees can fetch their own certificate from the public event page (QR at
-- the venue) when the event's certificate settings allow it. Each download is
-- logged so the admin can see who collected one.
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_certificate_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES public.event_registrations(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_certificate_downloads_event_idx
  ON public.event_certificate_downloads (event_id, created_at DESC);

ALTER TABLE public.event_certificate_downloads ENABLE ROW LEVEL SECURITY;
-- No public policies: writes and reads go through server routes on the service role.

COMMIT;
