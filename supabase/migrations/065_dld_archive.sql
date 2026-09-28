-- Migration 065: permanent archive of Dubai Land Department open data.
--
-- Distinct from the cache in 064. That table stores raw 1,000-row gateway
-- chunks with a 6h TTL purely to make the admin page's column search fast;
-- entries there are disposable. These tables are the opposite: row-level,
-- queryable, and never expired.
--
-- Why an archive at all: the DLD gateway only serves the CURRENT calendar
-- year. Probed 2026-09-28, 2026 YTD returns 163,374 transactions while 2025
-- and 2023 both return zero. Last year's data is already unrecoverable, and
-- this year's rolls off on 1 Jan. Ingesting continuously is the only way to
-- hold Dubai transaction history at all — it cannot be backfilled later.
--
-- Written by app/api/cron/dld-ingest (service-role, see lib/admin-supabase.ts),
-- driven for one-off backfills by scripts/dld-backfill.mjs.
--
-- Keys and joins are shaped by two quirks of the open data:
--   • TRANSACTION_NUMBER is NOT unique (997 distinct per 1,000 sampled rows —
--     a transaction spanning several properties or parties repeats it), so the
--     primary key is a content hash of the identifying fields. That also makes
--     re-ingesting an overlapping window a no-op.
--   • Every internal id comes back zeroed (AREA_ID, PROPERTY_ID, PROCEDURE_ID
--     are all 0), so rows can only be joined on English name strings — and the
--     casing of those is inconsistent ('Madinat Al Mataar' next to 'JUMEIRAH
--     VILLAGE CIRCLE'). Hence the normalized *_key columns.
--
-- RLS is enabled with no policies, as in 064: these are server-only. A public
-- SELECT policy belongs in the migration that ships public pages, not here.
--
-- Additive and idempotent for the runner.

BEGIN;

-- Canonical Dubai area vocabulary, from the gateway's carea-lookup command.
-- FHI has no areas table of its own (project areas are free text), so this is
-- the authoritative list everything else normalizes against.
CREATE TABLE IF NOT EXISTS public.dld_areas (
  area_id    TEXT PRIMARY KEY,
  name_en    TEXT NOT NULL,
  name_key   TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dld_transactions (
  row_hash            TEXT PRIMARY KEY,
  transaction_number  TEXT NOT NULL,
  instance_date       TIMESTAMPTZ NOT NULL,
  area_name           TEXT,
  area_key            TEXT,
  trans_value         NUMERIC,
  actual_area         NUMERIC,
  procedure_area      NUMERIC,
  group_en            TEXT,
  procedure_en        TEXT,
  usage_en            TEXT,
  prop_type_en        TEXT,
  prop_sb_type_en     TEXT,
  rooms_en            TEXT,
  is_offplan          BOOLEAN,
  is_free_hold        BOOLEAN,
  project_en          TEXT,
  master_project_en   TEXT,
  nearest_metro_en    TEXT,
  nearest_mall_en     TEXT,
  nearest_landmark_en TEXT,
  raw                 JSONB NOT NULL,
  ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- (area, date) carries the per-area market queries; date alone carries the
-- daily/market-wide series.
CREATE INDEX IF NOT EXISTS idx_dld_transactions_area_date
  ON public.dld_transactions (area_key, instance_date);

CREATE INDEX IF NOT EXISTS idx_dld_transactions_instance_date
  ON public.dld_transactions (instance_date);

CREATE INDEX IF NOT EXISTS idx_dld_transactions_project
  ON public.dld_transactions (project_en) WHERE project_en IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.dld_projects (
  project_number        TEXT PRIMARY KEY,
  project_en            TEXT,
  developer_number      TEXT,
  developer_en          TEXT,
  project_status        TEXT,
  prj_type_en           TEXT,
  start_date            DATE,
  end_date              DATE,
  completion_date       DATE,
  percent_completed     NUMERIC,
  project_value         NUMERIC,
  escrow_account_number TEXT,
  area_name             TEXT,
  area_key              TEXT,
  master_project_en     TEXT,
  cnt_unit              INTEGER,
  cnt_building          INTEGER,
  cnt_villa             INTEGER,
  raw                   JSONB NOT NULL,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dld_projects_developer
  ON public.dld_projects (developer_number);

CREATE INDEX IF NOT EXISTS idx_dld_projects_area_key
  ON public.dld_projects (area_key) WHERE area_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.dld_developers (
  developer_number       TEXT PRIMARY KEY,
  developer_en           TEXT,
  developer_key          TEXT,
  registration_date      DATE,
  license_number         TEXT,
  license_source_en      TEXT,
  license_type_en        TEXT,
  license_issue_date     DATE,
  license_expiry_date    DATE,
  legal_status_en        TEXT,
  chamber_of_commerce_no TEXT,
  phone                  TEXT,
  fax                    TEXT,
  webpage                TEXT,
  raw                    JSONB NOT NULL,
  ingested_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- developer_key is the normalized name. FHI's own developers table has no
-- external id, so matching "Azizi Developments" to DLD's DEVELOPER_EN will
-- need this plus a mapping layer when public pages ship.
CREATE INDEX IF NOT EXISTS idx_dld_developers_key
  ON public.dld_developers (developer_key) WHERE developer_key IS NOT NULL;

-- One row per (dataset, window) ingest attempt, so a backfill interrupted
-- halfway resumes instead of restarting. window_key is a plain string
-- ('09/01/2026..09/07/2026', or 'full' for the unwindowed lookups) rather
-- than a date pair, to keep the unique constraint free of NULL semantics.
CREATE TABLE IF NOT EXISTS public.dld_ingest_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command      TEXT NOT NULL,
  window_key   TEXT NOT NULL,
  window_from  DATE,
  window_to    DATE,
  rows_seen    INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'running',
  error        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  CONSTRAINT dld_ingest_runs_status_check CHECK (status IN ('running', 'ok', 'error'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dld_ingest_runs_command_window
  ON public.dld_ingest_runs (command, window_key);

CREATE INDEX IF NOT EXISTS idx_dld_ingest_runs_status
  ON public.dld_ingest_runs (status) WHERE status <> 'ok';

ALTER TABLE public.dld_areas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dld_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dld_projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dld_developers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dld_ingest_runs  ENABLE ROW LEVEL SECURITY;

COMMIT;
