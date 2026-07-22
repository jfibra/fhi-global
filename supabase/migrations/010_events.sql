-- Migration 010: events + public registrations
-- Admin-created events (branded, with image/date/venue) and the public
-- registration entries collected via each event's QR/registration page.
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  -- Brand key from lib/events/brands.ts (fhiglobal, filipinohomes, homesph, ...)
  brand text NOT NULL DEFAULT 'fhiglobal',
  image_url text,
  event_date timestamptz,
  venue text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One registration per email per event.
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_event_email_uniq
  ON public.event_registrations (event_id, lower(email));

CREATE INDEX IF NOT EXISTS event_registrations_event_idx
  ON public.event_registrations (event_id);

CREATE INDEX IF NOT EXISTS events_status_idx
  ON public.events (status);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Anonymous visitors may read only published, non-deleted events (public /events pages).
DROP POLICY IF EXISTS events_public_read ON public.events;
CREATE POLICY events_public_read ON public.events
  FOR SELECT USING (status = 'published' AND deleted_at IS NULL);

-- event_registrations has NO public policies on purpose: registering and
-- reading attendee lists both go through server API routes running on the
-- service-role client, so attendee contact details are never exposed to the
-- browser-side anon key.

COMMIT;
