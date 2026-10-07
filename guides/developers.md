-- 1. Create the Developers table
CREATE TABLE public.developers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  rating NUMERIC(3,2) DEFAULT 0.00,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 2. Indexing for performance
CREATE INDEX idx_developers_slug ON public.developers(slug);
CREATE INDEX idx_developers_is_active ON public.developers(is_active);

-- 3. Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_developer_update
  BEFORE UPDATE ON public.developers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Slug rules (documentation only — enforced in code, lib/reserved-slugs.ts)
-- ─────────────────────────────────────────────────────────────────────────────
-- A developer's page lives at the site root: /<slug>, in the same flat namespace as the app's routes, the
--   curated landing pages and guides (lib/seo-pages.ts) and the role dashboards. So a slug must be:
--   1. lower-case letters and digits in hyphen-separated words (DEVELOPER_SLUG_RE) — the form and the browser
--      service lower-case and hyphenate what is typed; a space or a capital would make a URL that 404s;
--   2. not a route, a public/ folder, a role dashboard or an SEO page (reservedSlugReason).
--   developerSlugError() checks both, in that order, for the admin form, createDeveloper/updateDeveloper and
--   (via reservedSlugReason) the two server routes that set a slug: the developer's own request
--   (/api/developer/company -> pending_slug) and the admin approval (/api/admin/developers/[id]/slug).
-- Changing a slug MOVES the page: the old address stops resolving (there is no redirect table yet — see the
--   optional previous_slugs migration in the SEO plan). Approving a change purges both addresses and the lists
--   that carry the developer, and tells IndexNow about the developer page and each published project under
--   both slugs, so the move is learned at once instead of on a re-crawl.
-- Uppercase URLs (/Azizi-Developments) answer a 308 to the lower-case page; only plain slugs are re-cased.
-- developers.updated_at is stamped by every write path in code (the sitemap's lastmod for developers).
