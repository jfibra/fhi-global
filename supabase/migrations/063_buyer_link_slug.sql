-- Migration 063: readable Buyers Link addresses.
--
-- Each agent's link gets a name-based slug (e.g. juliecor-repompo), so the
-- two pages read /buy-with/<slug> and /sell-with/<slug> instead of
-- /b/<code> and /s/<code>. The app mints it once (lib/buyer-link-page.ts,
-- the same naming rule as agent websites) and never changes it, so printed
-- QR codes keep working; the old code addresses 308-redirect to it. The
-- code stays the link's internal id for brief submissions.
--
-- Additive and idempotent for the runner.

BEGIN;

ALTER TABLE public.buyer_links ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_links_slug
  ON public.buyer_links (slug) WHERE slug IS NOT NULL;

COMMIT;
