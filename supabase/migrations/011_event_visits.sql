-- Migration 011: event visit counters
-- Tracks how many times each public event page is viewed, and how many of
-- those visits arrived by scanning a QR code (?src=qr). Incremented by
-- POST /api/events/visit via the service-role client.
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS qr_scan_count bigint NOT NULL DEFAULT 0;

-- Atomic increment (read-modify-write from the API would lose counts under
-- concurrent visits).
CREATE OR REPLACE FUNCTION public.increment_event_view(p_event_id uuid, p_from_qr boolean DEFAULT false)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.events
  SET view_count = view_count + 1,
      qr_scan_count = qr_scan_count + CASE WHEN p_from_qr THEN 1 ELSE 0 END
  WHERE id = p_event_id
    AND status = 'published'
    AND deleted_at IS NULL;
$$;

-- Only the server (service role) may call it — not the browser anon key.
REVOKE ALL ON FUNCTION public.increment_event_view(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_event_view(uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.increment_event_view(uuid, boolean) FROM authenticated;

COMMIT;
