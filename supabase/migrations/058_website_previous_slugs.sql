-- Migration 058: stable, name-based agent website addresses.
--
-- A site's slug used to be minted from its hero HEADLINE and re-minted every
-- time the headline changed — so every agent shared addresses like
-- "guiding-you-to-the-right-move-3", none carried the agent's name, and an
-- edit silently broke every link (and event link, migration 057) already
-- shared. Slugs are now minted once from the agent's NAME and never follow the
-- headline (lib/website-builder-service.ts).
--
--   website_builder.previous_slugs  every address the site answered to before;
--                                   /website/<old> (and /website/<old>/events/…)
--                                   308-redirects to the current slug, so no
--                                   shared link or printed QR ever breaks. New
--                                   slugs never reuse anyone's previous slug.
--
-- The one-off rename of the existing sites to name-based slugs is a separate
-- data script (it must not re-run with the runner). Additive; idempotent.

BEGIN;

ALTER TABLE public.website_builder
  ADD COLUMN IF NOT EXISTS previous_slugs text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_website_builder_previous_slugs
  ON public.website_builder USING gin (previous_slugs);

COMMIT;
