-- Migration 042: commercial office property type
-- Applied with: npm run db:migrate (requires DATABASE_URL)
--
-- Adds "Commercial Office" as a selectable project Property Type, requested by
-- the sales team (e.g. Samana Barari Avenue's commercial office units).
--
-- Property types are rows in property_types; the editor Property Types tab and
-- the buy filters read them dynamically, so seeding the row is all that's needed
-- and it appears for every role that can edit projects. Idempotent: the runner
-- re-applies every file each run and the INSERT is a no-op once the row exists
-- (property_types.name is UNIQUE). Same approach as migration 041's "Retail".

BEGIN;

INSERT INTO public.property_types (name)
  VALUES ('Commercial Office')
  ON CONFLICT (name) DO NOTHING;

COMMIT;
