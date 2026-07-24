-- Migration 015: indexes for the admin users list (search / filter / sort)
-- Speeds up GET /api/admin/users:
--   * visibility (is_deleted) + default joined_at DESC ordering
--   * role / status equality filters
--   * ILIKE '%term%' name search on fullname / fname / lname
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

-- Trigram support so ILIKE '%term%' can use an index (plain btree can't).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Visibility + default ordering: nearly every list query filters is_deleted
-- and orders by joined_at DESC. Leading is_deleted also serves the toggle's
-- "only soft-deleted" archive view.
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_joined
  ON public.profiles (is_deleted, joined_at DESC);

-- Equality filters.
CREATE INDEX IF NOT EXISTS idx_profiles_role   ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);

-- Case-insensitive substring name search.
CREATE INDEX IF NOT EXISTS idx_profiles_fullname_trgm ON public.profiles USING gin (fullname gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_fname_trgm    ON public.profiles USING gin (fname    gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_lname_trgm    ON public.profiles USING gin (lname    gin_trgm_ops);

COMMIT;
