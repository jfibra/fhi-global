-- 035_website_builder.sql
-- Per-agent personal websites for the dashboard Website Builder. One site per
-- agent (website_builder.agent_id UNIQUE). Content is split by section:
--
--   website_builder          the site row: title (mirrors the hero headline),
--                            an immutable unique slug generated from it, the
--                            hero description as title_description, contact +
--                            cta jsonb blobs, and FKs to the 1:1 sections.
--   hero_section             headline jsonb ({"Headline","Headline accent"} +
--                            colors), description, banner photo, overlay
--                            strength, FK to website_stats.
--   website_stats            hero_stats + stats_section jsonb arrays of
--                            {"icon","name","value"}.
--   about_section            heading, bio, photo, views/listing_count/rating,
--                            socials jsonb ({"facebook","linkedin",...}).
--   featured_section         one row per featured item: project_id (projects)
--                            OR listing_id (agent_listings), ordered by rank.
--   service_areas_section    one row per area (name + photo), ordered by rank.
--   gallery_section          one row per photo with its category
--                            (events / certificates / awards_recognition).
--
-- RLS: owners have full CRUD on their own rows; everyone (anon included) can
-- read — the sites are public pages served at /website/[slug].
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

-- ── 1:1 section tables (created first — website_builder references them) ────

CREATE TABLE IF NOT EXISTS public.website_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hero_stats JSONB NOT NULL DEFAULT '[]'::jsonb,
  stats_section JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hero_section (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- {"Headline": "...", "Headline accent": "...", "headline_color": "...",
  --  "accent_color": "...", "description_color": "..."}
  headline JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT NOT NULL DEFAULT '',
  banner TEXT NOT NULL DEFAULT '',
  overlay SMALLINT NOT NULL DEFAULT 0,
  stats_id UUID REFERENCES public.website_stats(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.about_section (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  heading TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  views TEXT NOT NULL DEFAULT '',
  listing_count TEXT NOT NULL DEFAULT '',
  rating TEXT NOT NULL DEFAULT '',
  -- {"twitter": null, "facebook": "...", "linkedin": null, "instagram": null, "youtube": null}
  socials JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── The site row ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.website_builder (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Mirrors the hero headline; the slug is generated from its FIRST value and
  -- never changes afterwards (collisions get a -2/-3/... suffix).
  title TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  title_description TEXT NOT NULL DEFAULT '',
  -- Agent contact block: name/title/brn/orn/brokerage/phone/whatsapp/email/office.
  contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Closing CTA: {"heading": "...", "sub": "..."}.
  cta JSONB NOT NULL DEFAULT '{}'::jsonb,
  hero_id UUID REFERENCES public.hero_section(id) ON DELETE SET NULL,
  about_id UUID REFERENCES public.about_section(id) ON DELETE SET NULL,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 1:N section tables ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.featured_section (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.website_builder(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.agent_listings(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Exactly one of project_id / listing_id per row.
  CONSTRAINT featured_section_one_target
    CHECK ((project_id IS NULL) <> (listing_id IS NULL))
);

CREATE TABLE IF NOT EXISTS public.service_areas_section (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.website_builder(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  rank INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (website, category); photos is a jsonb array of URLs whose
-- array order IS the display order (see 037 for the per-photo → array move).
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

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_featured_section_website ON public.featured_section (website_id, rank);
CREATE INDEX IF NOT EXISTS idx_service_areas_section_website ON public.service_areas_section (website_id, rank);

-- ── RLS: owner CRUD + public read ────────────────────────────────────────────

ALTER TABLE public.website_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_section ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.about_section ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_builder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_section ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas_section ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_section ENABLE ROW LEVEL SECURITY;

-- website_builder: public sees published sites; owners see + manage their own.
DROP POLICY IF EXISTS "website_builder_select_public" ON public.website_builder;
CREATE POLICY "website_builder_select_public"
  ON public.website_builder FOR SELECT
  USING (is_published OR agent_id = auth.uid());

DROP POLICY IF EXISTS "website_builder_all_own" ON public.website_builder;
CREATE POLICY "website_builder_all_own"
  ON public.website_builder FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- Section tables: public read (their site is public), owner CRUD.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'website_stats', 'hero_section', 'about_section',
    'featured_section', 'service_areas_section', 'gallery_section'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_public" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_select_public" ON public.%I FOR SELECT USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_all_own" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_all_own" ON public.%I FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid())',
      t, t);
  END LOOP;
END $$;

COMMIT;
