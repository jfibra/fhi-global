-- Optional unit type chosen by the agent (e.g. matches a developer project unit line).
BEGIN;

ALTER TABLE public.agent_listings
  ADD COLUMN IF NOT EXISTS unit_type TEXT;

COMMENT ON COLUMN public.agent_listings.unit_type IS 'Agent-selected unit type label; when set, public UI prefers this over auto-picked project unit.';

-- Listings linked to a project should use developer pricing, not a separate agent price.
UPDATE public.agent_listings
SET price = NULL
WHERE project_id IS NOT NULL;

COMMIT;
