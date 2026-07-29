-- Index the project_units → projects foreign key.
--
-- Postgres does NOT create an index for a FK column automatically, and this one
-- was missing. `project_units` is read by every surface that shows a listing's
-- beds / baths / size, always keyed by project_id:
--
--   • the agent dashboard  (features/dashboard/listings — one embed per load)
--   • /buy and /rent       (lib/buy/agent-listings-public.ts — up to 120
--                           listings per request, each embedding project_units)
--   • /listings/[slug]     (the public listing page)
--   • /api/agent-listings/project-gallery (the unit-type picker in the form)
--
-- PostgREST resolves those embeds as `WHERE project_id IN (…)`, which was a
-- sequential scan. Harmless at today's 4 rows, but this table grows with every
-- unit line a developer configures, and the public pages are the app's hottest
-- read path.
--
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

-- Plain (not CONCURRENTLY) because the migration runner wraps files in a
-- transaction and CONCURRENTLY cannot run inside one. Safe here: the table is
-- tiny, so the brief write lock is negligible. If project_units ever grows large
-- before this is applied, build it manually outside a transaction instead:
--   CREATE INDEX CONCURRENTLY idx_project_units_project_id
--     ON public.project_units (project_id);
CREATE INDEX IF NOT EXISTS idx_project_units_project_id
  ON public.project_units (project_id);

COMMENT ON INDEX public.idx_project_units_project_id IS
  'Supports the project_units embed (WHERE project_id IN …) used by the listing cards, public listing pages and the unit-type picker.';

COMMIT;
