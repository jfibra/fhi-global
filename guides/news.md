# News Module

## Environment Variables

Add the following to your `.env.local` (server-only — never expose to the browser):

```
HOMESPH_NEWS_API_URL=https://homesphnews-api-394504332858.asia-southeast1.run.app/api/external/articles
HOMESPH_NEWS_API_KEY=<your-key>
```

Optional (for canonical URLs and share links):
```
NEXT_PUBLIC_SITE_URL=https://fhiglobal.com
```

## Proxy Security

The `HOMESPH_NEWS_API_KEY` is **never sent to the browser**. It lives only in server-side environment variables and is injected by two server-side layers:

1. **`lib/news-service.ts`** — a server-only module that constructs and fires the external API request, injecting `X-Site-Api-Key` in the request headers. Imported only by server components and API route handlers.

2. **`app/api/news/articles/route.ts`** and **`app/api/news/article/route.ts`** — internal Next.js API routes that act as a public-facing proxy for any client-side callers. They delegate to `news-service` and return sanitized JSON with no keys or secrets.

The News pages (`/news` and `/news/[slug]`) are **Server Components** that call `news-service` directly (avoiding the extra network hop of calling the internal API routes). This is safe because those files are never bundled for the browser.

## File Structure

```
lib/
  news-service.ts          # Server-only: external API fetching + normalization

app/
  api/
    news/
      articles/route.ts    # GET /api/news/articles?page=N
      article/route.ts     # GET /api/news/article?slug=...
  news/
    page.tsx               # /news — All News page (ISR, revalidate 300s)
    [slug]/
      page.tsx             # /news/[slug] — News Detail page (ISR, revalidate 300s)
```

## Fetch Interval

All fetch calls use `next: { revalidate: 300 }` (5 minutes). Pages also export `export const revalidate = 300`.

## Slug Redirect

Visiting `/news?title=Some+Article+Title` will redirect to `/news/some-article-title` via the `slugify()` helper.
