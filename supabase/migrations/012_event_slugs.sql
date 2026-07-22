-- Migration 012: human-readable event slugs
-- Public event URLs become /events/<slug> (generated from the title at
-- creation). The old /events/<uuid> URLs keep working — printed QR codes and
-- shared links never break. Slugs stay stable even if the title is edited.
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS slug text;

-- Backfill existing events from their titles.
UPDATE public.events
SET slug = NULLIF(trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), '')
WHERE slug IS NULL;

-- If two events share a title, keep the clean slug on the oldest and suffix
-- the rest with a short id fragment.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.events
  WHERE slug IS NOT NULL
)
UPDATE public.events e
SET slug = e.slug || '-' || substr(e.id::text, 1, 6)
FROM ranked r
WHERE e.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS events_slug_uniq ON public.events (slug) WHERE slug IS NOT NULL;

COMMIT;
