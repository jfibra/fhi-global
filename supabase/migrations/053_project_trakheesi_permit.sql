-- Migration 053: Trakheesi advertising permit on projects
--
-- Trakheesi is the Dubai Land Department's permit system for real estate
-- advertising. A project that carries a permit shows its QR code and permit
-- number in the public project page's sidebar so a buyer can verify the
-- listing with the DLD; a project without one shows nothing there. The QR
-- is uploaded as an image (the DLD issues it as one) and stored as-is, so
-- it stays scannable.
--
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS trakheesi_permit_url text,
  ADD COLUMN IF NOT EXISTS trakheesi_permit_number text;

COMMENT ON COLUMN public.projects.trakheesi_permit_url IS
  'Image URL of the Trakheesi (DLD advertising permit) QR code. Shown in the public sidebar when set.';
COMMENT ON COLUMN public.projects.trakheesi_permit_number IS
  'Trakheesi permit number as printed by the Dubai Land Department. Optional.';

COMMIT;
