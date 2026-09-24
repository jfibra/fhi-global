-- Migration 054: the Dubai Land Department link inside a Trakheesi QR
--
-- A Trakheesi permit QR encodes a URL on trakheesi.dubailand.gov.ae that
-- opens the DLD's own validation page for that permit. We decode it once
-- when the QR is uploaded and keep it here, so the public page can make the
-- code clickable (through our verification interstitial) instead of only
-- scannable. Null when the image could not be read or did not point at the
-- DLD; the QR still shows and can be scanned.
--
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS trakheesi_permit_link text;

COMMENT ON COLUMN public.projects.trakheesi_permit_link IS
  'URL decoded from the Trakheesi QR; only accepted on dubailand.gov.ae. Null if unreadable.';

COMMIT;
