# News (HomesPH News integration)

The public News section (`/news`, `/news/[slug]`) renders articles distributed to the
**fhiglobal** site by the HomesPH News service (`api.homes.ph`). The full upstream API
contract is documented in [`NewsIntegration.md`](./NewsIntegration.md) — read that before
touching the integration.

## Env

```
HOMESPH_NEWS_API_URL=https://api.homes.ph/api   # BARE api base — code appends /external/*
HOMESPH_NEWS_API_KEY=<64-char site key>          # server-side only, never in client bundles
```

Feature-gated: with either var unset, everything silently no-ops (hub shows the empty
state, sitemap index skips news shards, view/subscribe endpoints answer without error).

## Architecture

- `lib/news-service.ts` — server-only client (`import "server-only"`). List
  (`fetchArticlesList`, per_page hard-capped at 100 upstream), detail
  (`fetchArticleBySlug` — the only call with populated `content_blocks`), category
  pairs (`fetchCategoriesCountries`), view forwarding (`trackArticleView`), and
  `toManilaIso()` (upstream dates are naive Asia/Manila wall-clock → `+08:00`).
- `lib/news-sanitize.ts` — `sanitizeNewsHtml()` (sanitize-html allowlist). The upstream
  stores rich-text blocks as RAW UNSANITIZED HTML — every text block must pass through
  this before `dangerouslySetInnerHTML`.
- `components/news/content-blocks.tsx` — Server Component renderer for the
  `content_blocks[]` body (text / image / centered-image / left|right-image /
  split-* / grid / dynamic-images; unknown types skipped; legacy plain-`content`
  fallback).
- `components/news/news-view-tracker.tsx` → `POST /api/news/view` — client fires one
  view per session per article with a stable localStorage `visitor_id`; the route
  forwards it upstream with the key (12h dedup happens upstream).
- `components/news/newsletter-signup.tsx` → `POST /api/news/subscribe` — forwards to
  `/external/subscribe` with categories/countries derived from the live distributed
  category × country pairs.
- Pages are ISR (`revalidate = 300`); the detail page prerenders the newest 12 slugs
  in production only (`generateStaticParams` gated on `VERCEL_ENV`).
- SEO: NewsArticle + BreadcrumbList JSON-LD on detail, CollectionPage + ItemList on the
  hub; titles truncated ~43 chars (`truncateTitle` in `lib/seo.ts`).
- Hub extras: category filter chips (`/news?category=<slug>` fed by the category ×
  country counts) and the `?title=` → slug redirect (legacy shared links).

## Sitemaps

- `/sitemap-news-N.xml` — all distributed articles (1000-URL shards aggregated from
  upstream pages of 100), part of the sitemap index. See `lib/sitemap-sections.ts`.
- `/news-sitemap.xml` — Google News sitemap: ONLY articles published in the last 48
  hours, `publication_date` normalized to `+08:00`. Fresh articles are also pinged to
  IndexNow from this route.

## Gotchas

- The old env convention stored the FULL articles endpoint in `HOMESPH_NEWS_API_URL`;
  `newsBase()` strips a legacy `/external/articles` suffix defensively, but new
  deployments should use the bare base.
- `keywords` from the API is a comma-joined STRING, not an array.
- Article `id` is a UUID string — never coerce to number.
- An empty feed is almost always a distribution problem (articles are targeted at the
  `fhiglobal` site name upstream), not an auth problem.
