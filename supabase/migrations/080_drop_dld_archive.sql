-- Migration 080: drop the Dubai Land Department archive (migrations 065/066).
--
-- The archive stored a permanent copy of DLD open data (transactions,
-- projects, developers, areas) fed by a nightly cron and a backfill script.
-- Decision 2026-10-15: no DLD data is to be kept in our database. The cron,
-- the backfill script and the writer are deleted with this migration, and the
-- one reader — the project → developer lookup behind the Developers
-- Breakdown tab (lib/dld-developer-lookup.ts) — now reads DLD's projects
-- register live from the gateway instead.
--
-- Migrations 065 and 066 are removed from the repo so the runner, which
-- re-applies every file, never recreates these tables. The six-hour chunk
-- cache from 064 (dld_open_data_cache) is NOT touched: it is a disposable
-- performance cache behind the admin Open Data page, not an archive.
--
-- Idempotent: safe to re-run.

BEGIN;

DROP TABLE IF EXISTS public.dld_ingest_runs;
DROP TABLE IF EXISTS public.dld_transactions;
DROP TABLE IF EXISTS public.dld_projects;
DROP TABLE IF EXISTS public.dld_developers;
DROP TABLE IF EXISTS public.dld_areas;

COMMIT;
