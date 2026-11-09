-- Migration 087: website_builder.review_ids — which approved client reviews an
-- agent's website shows, in order (boss, 2026-11-09).
--
-- NULL (every site until its agent picks) = all approved reviews, newest first,
-- as before. An array of agent_feedback ids = only those, in that order; an id
-- that is no longer approved is skipped. Read by lib/website-reviews.ts
-- (orderWebsiteReviews), written by the Website Builder's Reviews tab.

BEGIN;

ALTER TABLE public.website_builder
  ADD COLUMN IF NOT EXISTS review_ids JSONB;

COMMIT;
