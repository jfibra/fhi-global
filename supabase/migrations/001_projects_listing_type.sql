-- Public buy vs rent: which routes may list this project.
-- Run from your machine: npm run db:migrate (uses DATABASE_URL).
-- In Supabase: SQL Editor → paste ONLY the SQL below (BEGIN through COMMIT), not shell commands.

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'sale';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'projects'
      AND c.conname = 'projects_listing_type_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_listing_type_check
      CHECK (listing_type IN ('sale', 'rent', 'both'));
  END IF;
END $$;

COMMENT ON COLUMN public.projects.listing_type IS 'Public listing: sale (/buy), rent (/rent), or both.';

COMMIT;
