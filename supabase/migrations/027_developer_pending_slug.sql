-- Migration 027: developer-requested slug changes (admin-approved)
-- Developers may propose a new public slug from their portal, but a slug change
-- affects the public URL, so it is not applied directly — it lands here as a
-- pending request that an admin approves (copies pending_slug -> slug) or
-- rejects (clears it). NULL pending_slug = no request outstanding. Idempotent.

BEGIN;

ALTER TABLE public.developers ADD COLUMN IF NOT EXISTS pending_slug text;
ALTER TABLE public.developers ADD COLUMN IF NOT EXISTS pending_slug_at timestamptz;
ALTER TABLE public.developers ADD COLUMN IF NOT EXISTS pending_slug_by uuid;

COMMENT ON COLUMN public.developers.pending_slug IS
  'Developer-requested slug awaiting admin approval; NULL = none. Approval copies it to slug.';
COMMENT ON COLUMN public.developers.pending_slug_by IS
  'profiles.id of the developer user who requested the pending slug.';

COMMIT;
