-- Migration 041: retail property type and airport nearby
-- Applied with: npm run db:migrate (requires DATABASE_URL)
--
-- Two developer/editor project additions requested by the sales team:
--   1. "Retail" as a selectable project Property Type.
--   2. "Airport" as a Nearby Places category.
--
-- Idempotent: the runner re-applies every file on each run. The INSERT is a
-- no-op once the row exists (property_types.name is UNIQUE); the CHECK is
-- dropped by its conventional name and recreated identically (same approach as
-- migration 040).

BEGIN;

-- 1) Property types are rows in property_types; the editor tab and the buy
--    filters read them dynamically, so seeding the row is all that's needed.
INSERT INTO public.property_types (name)
  VALUES ('Retail')
  ON CONFLICT (name) DO NOTHING;

-- 2) Widen the Nearby Places category CHECK (was school/hospital/shopping) so
--    'airport' can be saved on project_neighbors.
ALTER TABLE public.project_neighbors
  DROP CONSTRAINT IF EXISTS project_neighbors_category_check;

ALTER TABLE public.project_neighbors
  ADD CONSTRAINT project_neighbors_category_check
  CHECK (category = ANY (ARRAY['school'::text, 'hospital'::text, 'shopping'::text, 'airport'::text]));

COMMIT;
