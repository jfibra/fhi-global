-- 038_gallery_albums.sql
-- Company photo gallery: public albums of event photos at fhiglobal.ae/gallery.
-- (Distinct from gallery_section, which is the per-agent Website Builder
-- gallery.) Photos are ingested by scripts/ingest-gallery.mjs: originals are
-- re-encoded to a ~2000px web rendition plus a ~640px thumbnail on our S3
-- prefix, and each row keeps the source URL as the idempotency key so a
-- re-run never duplicates a photo.
--
-- Writes happen only through the service-role/owner connection (the ingest
-- script and future admin routes) — no client write policies. Anon may read
-- published albums.
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gallery_albums (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  description  TEXT,
  event_date   DATE,
  cover_url    TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gallery_photos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id   UUID NOT NULL REFERENCES public.gallery_albums(id) ON DELETE CASCADE,
  -- Section within the album (from the source folder), e.g. "Awarding".
  section    TEXT,
  url        TEXT NOT NULL,
  thumb_url  TEXT NOT NULL,
  width      INTEGER,
  height     INTEGER,
  file_name  TEXT,
  -- The original's URL at ingest time — unique so re-runs skip existing rows.
  source_url TEXT UNIQUE,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_photos_album
  ON public.gallery_photos (album_id, sort);

ALTER TABLE public.gallery_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gallery_albums_select_published" ON public.gallery_albums;
CREATE POLICY "gallery_albums_select_published"
  ON public.gallery_albums FOR SELECT
  USING (is_published);

DROP POLICY IF EXISTS "gallery_photos_select_published" ON public.gallery_photos;
CREATE POLICY "gallery_photos_select_published"
  ON public.gallery_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.gallery_albums a
    WHERE a.id = album_id AND a.is_published
  ));

COMMIT;
