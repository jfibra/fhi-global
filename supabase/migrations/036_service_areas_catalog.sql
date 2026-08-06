-- 036_service_areas_catalog.sql
-- Service areas become SHARED data. 035 had every site storing its own
-- name+photo copy of each area; now there is one catalog row per area
-- (unique by name, case-insensitive) and websites just link to it:
--
--   service_areas            the catalog: name + photo, created once by the
--                            first agent to use the area, shared afterwards.
--   service_areas_section    now a join table: website_id → area_id + rank.
--
-- Saving a site "chooses or inserts": an area name that already exists in the
-- catalog is linked as-is; a new name inserts one catalog row.
--
-- Idempotent: the migration runner re-applies every file on each run. The
-- restructure of service_areas_section is guarded by a column check, and any
-- rows saved under the 035 shape are migrated into the catalog first.

BEGIN;

CREATE TABLE IF NOT EXISTS public.service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  photo TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One catalog row per area name, case-insensitively.
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_areas_name_unique
  ON public.service_areas ((lower(name)));

-- ── One-time restructure of service_areas_section (035 shape → join table) ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_areas_section' AND column_name = 'name'
  ) THEN
    -- Preserve anything saved under the old shape: seed the catalog…
    INSERT INTO public.service_areas (name, photo, created_by)
      SELECT DISTINCT ON (lower(s.name)) s.name, s.photo, s.agent_id
      FROM public.service_areas_section s
      WHERE s.name <> ''
      ORDER BY lower(s.name), s.created_at
    ON CONFLICT ((lower(name))) DO NOTHING;

    -- …then swap the per-site columns for a catalog reference.
    ALTER TABLE public.service_areas_section ADD COLUMN area_id UUID;

    UPDATE public.service_areas_section s
      SET area_id = a.id
      FROM public.service_areas a
      WHERE lower(a.name) = lower(s.name);

    DELETE FROM public.service_areas_section WHERE area_id IS NULL;

    ALTER TABLE public.service_areas_section
      DROP COLUMN name,
      DROP COLUMN photo,
      ALTER COLUMN area_id SET NOT NULL,
      ADD CONSTRAINT service_areas_section_area_fk
        FOREIGN KEY (area_id) REFERENCES public.service_areas(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_areas_section_area ON public.service_areas_section (area_id);

-- ── RLS for the catalog: public read; authenticated users may add areas ─────
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_areas_select_public" ON public.service_areas;
CREATE POLICY "service_areas_select_public"
  ON public.service_areas FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "service_areas_insert_authenticated" ON public.service_areas;
CREATE POLICY "service_areas_insert_authenticated"
  ON public.service_areas FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

COMMIT;
