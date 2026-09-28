-- Migration 066: dld_areas.name_key and .slug are not unique after all.
--
-- 065 assumed one row per area name. The gateway's carea-lookup returns 437
-- entries but only 428 distinct names: nine names carry two AREA_IDs each,
-- apparently one per classification (the ids are prefixed A- and C-):
--
--   business bay                 -> C-19,  A-526
--   palm deira                   -> A-432, C-109
--   dubai investment park first  -> A-458, C-39
--   oud al muteena               -> A-474, A-381
--   mushrif                      -> A-420, A-404
--   … and four more
--
-- So the UNIQUE constraints rejected the whole 437-row upsert. Both columns
-- become plain indexes. Dropping the duplicate ids instead was the
-- alternative and is worse: AREA_ID is the gateway's own filter parameter
-- (P_AREA_ID), so discarding one would make later queries for that area
-- silently incomplete.
--
-- Consequence for joins: matching a transaction's AREA_EN to dld_areas by
-- name_key can return two rows. That ambiguity is real in the source data —
-- anything grouping by area should group on name_key, not area_id.
--
-- Additive and idempotent for the runner.

BEGIN;

ALTER TABLE public.dld_areas DROP CONSTRAINT IF EXISTS dld_areas_name_key_key;
ALTER TABLE public.dld_areas DROP CONSTRAINT IF EXISTS dld_areas_slug_key;

CREATE INDEX IF NOT EXISTS idx_dld_areas_name_key ON public.dld_areas (name_key);
CREATE INDEX IF NOT EXISTS idx_dld_areas_slug     ON public.dld_areas (slug);

COMMIT;
