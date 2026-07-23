-- Migration 013: human-readable slugs for agent listings
-- Public listing URLs become /listings/<slug> (from the title). Old
-- /listings/<uuid> links keep working. A BEFORE INSERT trigger generates the
-- slug for every creation path (agent form, admin, imports); slugs stay
-- stable across title edits so shared links never break.
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

ALTER TABLE public.agent_listings ADD COLUMN IF NOT EXISTS slug text;

-- Backfill existing listings from their titles.
UPDATE public.agent_listings
SET slug = NULLIF(left(trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), 80), '')
WHERE slug IS NULL;

-- Listings often share titles ("Luxury 2BR Apartment") — keep the clean slug
-- on the oldest and suffix the rest with an id fragment.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.agent_listings
  WHERE slug IS NOT NULL
)
UPDATE public.agent_listings l
SET slug = l.slug || '-' || substr(l.id::text, 1, 6)
FROM ranked r
WHERE l.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS agent_listings_slug_uniq
  ON public.agent_listings (slug) WHERE slug IS NOT NULL;

-- Auto-generate the slug on insert, whatever the creation path.
CREATE OR REPLACE FUNCTION public.agent_listings_set_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  IF NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;
  base := NULLIF(left(trim(both '-' from regexp_replace(lower(coalesce(NEW.title, '')), '[^a-z0-9]+', '-', 'g')), 80), '');
  IF base IS NULL THEN
    RETURN NEW; -- no usable title characters; URL falls back to the uuid
  END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.agent_listings WHERE slug = candidate AND id <> NEW.id) LOOP
    n := n + 1;
    candidate := base || '-' || substr(NEW.id::text, 1, 3 + n);
    IF n > 10 THEN
      candidate := base || '-' || NEW.id::text;
      EXIT;
    END IF;
  END LOOP;
  NEW.slug := candidate;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS agent_listings_slug_trg ON public.agent_listings;
CREATE TRIGGER agent_listings_slug_trg
  BEFORE INSERT ON public.agent_listings
  FOR EACH ROW EXECUTE FUNCTION public.agent_listings_set_slug();

COMMIT;
