-- 038_website_builder_theme.sql
-- Per-agent color palette for the Website Builder: {"gold": "#c9a24b",
-- "brand": "#001f3f"}. Empty object = the default design. All derived colors
-- (gradients, glass, tints) are computed client-side from these two.
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

ALTER TABLE public.website_builder
  ADD COLUMN IF NOT EXISTS theme JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
