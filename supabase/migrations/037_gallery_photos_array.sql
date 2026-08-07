-- 037_gallery_photos_array.sql
-- gallery_section moves from one row per photo (photo + rank) to one row per
-- (website, category) holding a `photos` jsonb array of URLs — the array's
-- order IS the display order, so reordering is just rewriting the array.
-- 035 now creates the array shape directly on fresh databases; this migration
-- simply DROPS an old per-photo table (existing builder data is test data —
-- no need to carry it over; agents just re-save) and recreates the new shape.
--
-- Idempotent: the drop is guarded by a "does the old `photo` column exist"
-- check, so re-runs are no-ops.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gallery_section' AND column_name = 'photo'
  ) THEN
    DROP TABLE public.gallery_section;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.gallery_section (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.website_builder(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  category TEXT NOT NULL DEFAULT 'events',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (website_id, category)
);

ALTER TABLE public.gallery_section DROP CONSTRAINT IF EXISTS gallery_section_category_check;
ALTER TABLE public.gallery_section ADD CONSTRAINT gallery_section_category_check
  CHECK (category IN ('events', 'certificates', 'awards_recognition'));

ALTER TABLE public.gallery_section ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gallery_section_select_public" ON public.gallery_section;
CREATE POLICY "gallery_section_select_public"
  ON public.gallery_section FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "gallery_section_all_own" ON public.gallery_section;
CREATE POLICY "gallery_section_all_own"
  ON public.gallery_section FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

COMMIT;
