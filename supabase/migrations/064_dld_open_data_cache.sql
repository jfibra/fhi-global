-- Migration 064: cache for Dubai Land Department open-data chunks.
--
-- The admin "Real Estate Data" page searches DLD datasets by column
-- ("contains", like SQL %term%). The DLD gateway has no such filter, so the
-- server pulls the result set in 1,000-row chunks and matches locally. Each
-- chunk pulled is stored here, keyed by dataset + filters + sort + chunk
-- index, so repeat searches over the same filters (by any admin, on any
-- server instance) read from Postgres instead of re-pulling from DLD.
--
-- Server-only: written and read through the service-role client in
-- lib/dld-cache.ts. RLS is enabled with no policies so the anon/auth keys
-- can never read it. Entries expire by age (see DLD_CACHE_TTL_MS); the app
-- prunes old rows opportunistically on write.
--
-- Additive and idempotent for the runner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.dld_open_data_cache (
  cache_key   TEXT PRIMARY KEY,
  command     TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  row_count   INTEGER NOT NULL,
  total       INTEGER NOT NULL,
  rows        JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dld_open_data_cache_fetched_at
  ON public.dld_open_data_cache (fetched_at);

ALTER TABLE public.dld_open_data_cache ENABLE ROW LEVEL SECURITY;

COMMIT;
