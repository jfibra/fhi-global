-- Featured flag for agent listings.
--
-- `projects` already carries is_featured (toggled on the project Settings tab);
-- agent_listings had no equivalent, so an agent had no way to say which of their
-- own listings should lead. This adds the matching flag plus the index the
-- featured feed reads it through.
--
-- The runner re-applies every file on each run and does not wrap them in a
-- transaction, so this is written to be idempotent and is wrapped explicitly.

BEGIN;

ALTER TABLE public.agent_listings
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Partial: only featured rows are ever selected by this path, and there are
-- few of them, so the index stays small no matter how many listings exist.
CREATE INDEX IF NOT EXISTS idx_agent_listings_featured
  ON public.agent_listings (agent_id, updated_at DESC)
  WHERE is_featured AND deleted_at IS NULL;

COMMIT;
