# News Integration Guide

How to embed Homes news content (articles, restaurant listings, newsletter sign-up) into an
**external website**.

This document describes the **site-key integration surface** of `Service.News` — the
`/api/external/*` route group served by
[`SiteContentController`](app/Http/Controllers/Api/SiteContentController.php) and guarded by
[`VerifySiteApiKey`](app/Http/Middleware/VerifySiteApiKey.php). It is the only surface intended for
third-party publisher sites.

> `Service.News` is a standalone Laravel app inside this monorepo. It is **not** part of the .NET
> fleet and shares none of its auth (no opaque tokens, no OpenFGA). See
> [`CLAUDE.md`](./CLAUDE.md).

---

## 1. Quick start

```bash
# 1. List the articles distributed to your site
curl -s "https://api.homes.ph/api/external/articles?per_page=10" \
  -H "X-Site-Api-Key: YOUR_SITE_API_KEY" \
  -H "Accept: application/json"

# 2. Fetch one article by slug (this is the only call that returns the article body)
curl -s "https://api.homes.ph/api/external/articles/your-article-slug" \
  -H "X-Site-Api-Key: YOUR_SITE_API_KEY"

# 3. Report that a visitor read it
curl -s -X POST "https://api.homes.ph/api/external/articles/your-article-slug/view" \
  -H "X-Site-Api-Key: YOUR_SITE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"placement":"homepage-rail","visitor_id":"abc123"}'
```

**Base URL**

| Environment | Base URL |
| --- | --- |
| Production | `https://api.homes.ph/api` |
| Local dev | `http://localhost:8000/api` |

Every path in this guide is relative to that base — Laravel serves `routes/api.php` under the `api`
prefix (`bootstrap/app.php`), so the full path is `…/api/external/articles`. A base URL **without**
the trailing `/api` is the single most common integration mistake.

---

## 2. Get credentials

Integration is per **site**. A Homes operator creates a `Site` row for you in the admin console
(`PATCH/POST /api/v1/admin/sites`, [`Admin\SiteController`](app/Http/Controllers/Api/Admin/SiteController.php)):

| Field | Purpose |
| --- | --- |
| `site_name` | The distribution name. Articles are targeted at sites **by this name** — it is how content reaches you. |
| `site_url` | Your public origin. **Enforced** against the browser `Origin` header (§3). |
| `site_status` | Must be `active`. Anything else → all calls return **403**. |
| `api_key` | Auto-generated 64-char random string on create (`Site::booted()`). This is your credential. |
| `site_keywords` | The categories assigned to your site (surfaced as `categories` in the admin API). |

An operator can rotate your key with `PATCH /api/v1/admin/sites/{id}/refresh-key`, which replaces
`api_key` with a fresh 64-char string. Rotation is **immediate and breaking** — the old key stops
working on the next request, so coordinate it.

---

## 3. Authentication

Send your key on **every** request as either header (both are accepted, identically):

```http
X-Site-Api-Key: YOUR_SITE_API_KEY
```
```http
X-Site-Key: YOUR_SITE_API_KEY
```

The middleware then applies two checks:

**a. Key lookup.** The key must match a site with `site_status = 'active'`.

**b. Origin validation** — applied in every environment except `local`, and **only when the request
carries an `Origin` header** (browsers send it on cross-origin calls; server-to-server clients
normally do not). The check compares your registered `site_url` to the `Origin`, after lowercasing
and stripping the scheme, a leading `www.`, and any trailing slash. It passes on an exact host match
**or a proper subdomain**:

| Registered `site_url` | `Origin` | Result |
| --- | --- | --- |
| `https://partner.com` | `https://partner.com` | ✅ |
| `https://partner.com` | `https://www.partner.com` | ✅ (`www.` stripped) |
| `https://partner.com` | `https://news.partner.com` | ✅ (subdomain) |
| `https://partner.com` | `https://partner.com.evil.com` | ❌ 403 |
| `https://partner.com` | `https://other.com` | ❌ 403 |

### Errors

| Status | Body | Cause |
| --- | --- | --- |
| 401 | `{"error":"API Key missing"}` | Neither header present. |
| 403 | `{"error":"Invalid or Suspended API Key"}` | Unknown key, or `site_status != 'active'`. |
| 403 | `{"error":"Unauthorized Origin","message":"This API key is strictly for …"}` | `Origin` present and not matching `site_url`. |

### ⚠️ Call from your server, not the browser

Two independent reasons:

1. **The key is a bearer secret with no scoping beyond your site.** Putting it in client-side JS
   publishes it. Origin validation is a partial mitigation only — it is skipped entirely when no
   `Origin` header is sent, so anyone who copies the key out of your page source can use it with
   `curl`.
2. **Browser calls need your origin in the server's CORS allowlist.**
   [`config/cors.php`](config/cors.php) is an **explicit list** (`allowed_origins`, with
   `allowed_origins_patterns` empty) containing only Homes-operated origins. Your domain is not in
   it, so a `fetch()` from your page is blocked by the browser regardless of a valid key and a
   passing Origin check. Adding a partner origin is a **code change to `config/cors.php` plus a
   deploy** — request it explicitly if you need direct browser calls.

The recommended shape is: **your server** holds the key, calls this API, and caches/renders the
result. See §8 for a proxy example.

---

## 4. What content you receive

You are not reading the whole Homes catalogue — reads are **scoped to your site**, and the scoping
rule differs by resource:

- **Articles** — `status = 'published'` **and** joined to your site through the `article_site`
  pivot. An editor targets an article at sites by name (`published_sites`), which is synced to the
  pivot on publish (`Article::publishedSites()`). Until an article is distributed to your site, it
  does not exist as far as your key is concerned — including for detail and view-tracking calls.
- **Restaurants** — `status = 'published'` **and** the JSON `published_sites` column contains your
  **`site_name`** (matched by name, not id).
- **Metadata** (categories, countries, provinces, cities) — global reference data, mostly filtered to
  `is_active` rows. Not site-scoped.

So an empty `data` array is almost always a **distribution** problem, not an auth problem. Ask your
Homes contact to target content at your `site_name`.

---

## 5. Endpoint reference

All endpoints require the site-key header. All are `GET` unless noted.

### 5.1 `GET /external/articles` — article list

The primary feed endpoint.

**Query parameters**

| Parameter | Notes |
| --- | --- |
| `search` (alias `q`) | `LIKE` match across title, summary, keywords, topics, and article body. |
| `category` | Matches the category **name** exactly. |
| `category_slug` | Resolves an active category slug → name. Takes precedence over `category`. Unknown slug → empty result (not an error). |
| `country` | Matches the country **name** exactly. |
| `country_slug` | Resolves a country by id, name, or slugified name. Takes precedence over `country`. |
| `province` / `province_slug` | Accepts a numeric province id **or** a slugified province name. |
| `city` / `city_slug` | Accepts a numeric city id **or** a slugified city name. Narrowed by the resolved province/country when unambiguous. |
| `topic` | Exact match inside the article's `topics` JSON array (`JSON_CONTAINS`). |
| `page` | 1-based. Default `1`. |
| `per_page` (alias `limit`) | Default `20`, **hard cap `100`** (silently clamped). |

Unknown query parameters are ignored. Sort order is fixed: `published_at DESC`, then
`created_at DESC`.

**Response** — note the **two levels of `data`**:

```json
{
  "site": { "name": "Partner News", "url": "https://partner.com", "description": "…" },
  "data": {
    "data": [ { "id": "…", "title": "…", "…": "…" } ],
    "current_page": 1,
    "per_page": 20,
    "total": 137,
    "last_page": 7,
    "from": 1,
    "to": 20
  }
}
```

Your articles are at `response.data.data`; pagination metadata sits beside it at `response.data.*`.

> **`content_blocks` is always `[]` in list responses.** The list query deliberately does not select
> the article body — it dominated payload size (a `per_page=40` response measured 161 KB) while the
> list only renders title/summary/image. The empty key is a **deprecated transitional shim** kept so
> existing consumers get an array instead of a missing key, and it **will be removed**. Do not read
> the body from the list; fetch the detail endpoint (§5.2).

### 5.2 `GET /external/articles/{identifier}` — article detail

`{identifier}` is either the article **slug** or its **UUID** — detected by shape (a leading
`########-####-` hex pattern means UUID, otherwise slug).

This is the **only** endpoint that returns populated `content_blocks`.

```json
{ "article": { "id": "…", "title": "…", "content_blocks": [ … ] } }
```

Not published, or not distributed to your site → **404** (`Article not found`).

### 5.3 `POST /external/articles/{identifier}/view` — record a read

Increments the per-site view count, the global article view count, and writes an
`ArticleViewEvent` analytics row. Rate limited to **120 requests/minute**.

**Body** (all fields optional):

| Field | Max | Notes |
| --- | --- | --- |
| `placement` | 255 | Where on your site it rendered, e.g. `homepage-rail`. |
| `referrer` | 2048 | |
| `utm_source` / `utm_medium` / `utm_campaign` | 255 each | |
| `visitor_id` | 255 | Stable per-visitor id. **Omitted → the server derives one from IP + User-Agent.** If you proxy server-side, every visitor collapses onto your server's IP+UA, so pass your own `visitor_id` (a cookie value) or your counts will be wrong. |

**Deduplication:** an `(article, site, visitor)` triple counts once per **12 hours**
([`ArticleViewRecorder`](app/Services/ArticleViewRecorder.php)). A duplicate is not an error — you
get **201** with `"message": "View already recorded"` and unchanged counts.

```json
{
  "message": "View recorded",
  "article_id": "…",
  "site_id": 7,
  "views_on_this_site": 42,
  "article_views_total": 5130
}
```

404 if the article is not published or not distributed to your site.

### 5.4 `GET /external/restaurants` — restaurant listings

Parameters: `search` (name/description), `country`, `city`, `cuisine_type` (alias `topic`),
`per_page` (alias `limit`, default 20, cap 100), `page`. Sorted `created_at DESC`. Same
`{ site, data: { data, current_page, … } }` envelope as the article list.

> Unrelated to the fleet's `Service.Restaurants` — this is a news-directory listing that merely
> shares the word.

### 5.5 Metadata — for filter UI

| Endpoint | Returns |
| --- | --- |
| `GET /external/categories` | Active categories: `[{id, name, slug}]` |
| `GET /external/countries` | Active countries: `[{id, name}]` |
| `GET /external/provinces?country_id=` | `[{id, name, country_id}]`, name-ordered. ⚠️ The only metadata endpoint that does **not** filter `is_active` — it can return inactive provinces. The nested form below does filter. |
| `GET /external/cities?country_id=&province_id=` | `[{city_id, name, province_id, country_id}]` — note the key is **`city_id`**, not `id` |
| `GET /external/countries/{country}/provinces` | Nested form; `{country}` = id or slug. 404 if unknown. |
| `GET /external/countries/{country}/provinces/{province}/cities` | Nested form; `{province}` = id or slugified name. **422** if a slug matches several provinces (`Ambiguous province; use numeric province id in the path`). |
| `GET /external/categories/countries` | The category × country pairs that actually have published articles **on your site**, with counts — ideal for building only the filters that will return results. |

`categories/countries` response:

```json
{
  "site": { "name": "…", "url": "…", "description": "…" },
  "data": [
    { "category": "Real Estate", "category_slug": "real-estate",
      "country": "Philippines", "country_id": "PH", "article_count": 42 }
  ]
}
```

These metadata endpoints are **not** site-scoped (except `categories/countries`) and return the
global reference lists — so a category or country appearing here does **not** guarantee your site has
articles under it. Use `categories/countries` to build filters that will actually return results.

### 5.6 `POST /external/subscribe` — newsletter sign-up

Registers a subscriber for the tailored daily newsletter and attributes them to your site
(`source_site` = your site id, taken from the authenticated key — a client-supplied `source_site` is
ignored on this route). Handled by
[`SubscriptionController::store`](app/Http/Controllers/Api/SubscriptionController.php).

| Field | Rules |
| --- | --- |
| `email` | **required**, email |
| `categories` | **required**, array |
| `countries` | **required**, array |
| `phone_no`, `company_name`, `features`, `time` | optional strings |
| `target_province`, `target_city` | optional — news-interest targeting |
| `user_country`, `user_province`, `user_city` | optional — subscriber's own location |

`time` is normalised to `H:i` (e.g. `"08:00 AM"` → `"08:00"`) to line up with the newsletter cron's
time slots.

**Responses**

| Status | Meaning |
| --- | --- |
| 201 | New subscriber created; welcome email sent. |
| 200 | Email already known. `is_existing: true`. A previously unsubscribed address is **re-activated**; an active one just gets a "manage preferences" email. Treat both as success. |
| 422 | `{"status":"error","message":"Validation failed","errors":{…}}` |
| 500 | `{"status":"error","message":"Internal server error occurred.", "error":"…"}` |

Email delivery failures are logged, not surfaced — a 201 means the subscriber was stored, not that
mail was delivered.

---

## 6. Article payload

Shape produced by
[`ExternalArticleResource`](app/Http/Resources/Articles/ExternalArticleResource.php).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | UUID. |
| `slug` | string | Use for URLs and detail lookups. |
| `title`, `summary` | string | |
| `description` | string | **Duplicate of `summary`**, kept for compatibility. |
| `category`, `category_slug` | string, string\|null | Slug resolved from an active category; `null` if the name doesn't match one. |
| `country`, `location` | string | `location` duplicates `country`. Defaults to `"Global"`. |
| `status` | string | Always `published` on this surface. |
| `published_at`, `created_at`, `date` | string | Format `Y-m-d H:i:s`, **no timezone/offset** — server-local. `date` falls back to `created_at` when unpublished-dated. Empty string, not `null`, when absent. |
| `views_count` | int | Global count across all sites. |
| `views` | string | Pre-formatted, e.g. `"5,130 views"`. |
| `image` | string | Primary image URL. Legacy rows stored this JSON-wrapped (`"[\"https://…\"]"`); the resource unwraps it. Empty string when absent. |
| `topics` | string[] | |
| `keywords` | **string** | Comma-joined, **not** an array — `"a, b, c"`. |
| `author` | string | |
| `published_sites` | string[] | **Filtered to your site only** — you never see which other partners carry an article. |
| `province_id`, `city_id` | int\|null | |
| `province_name`, `city_name` | string\|null | Populated on list + detail reads. |
| `province_slug`, `city_slug` | string\|null | Slugified names, for building URLs. |
| `content_blocks` | array | The body. **`[]` in list responses** (§5.1) — populated only on detail. |

---

## 7. Rendering `content_blocks`

The article body is a **block array**, not HTML. Each element is
`{ id?, type, content, settings? }`. Render in array order. The reference implementation is
`Web.News`'s `ContentBlocksRenderer`.

| `type` | Read from | Renders as |
| --- | --- | --- |
| `text` | `content` (string) **or** `content.text` | Rich-text HTML |
| `image` | `content.src` (fallback `block.image`), `content.caption` | Full-width figure |
| `centered-image` | same as `image` | Narrower, centered figure |
| `left-image` / `right-image` | `content.image`, `content.text` | Image floated beside text |
| `split-left` / `split-right` | `content.image`, `content.text` | Half-and-half hero panel |
| `grid` | `content.images` (string[]) | 2- or 3-column grid (3 columns when exactly 3 images) |
| `dynamic-images` | `content.images` (string[]) | Stacked full-width images |

`settings` is an optional presentation hint: `textAlign`, `fontSize`, `color`, `fontWeight`,
`isItalic`, `isUnderline`, `listType` (`bullet` \| `number`).

> **🔒 `text` blocks contain raw HTML — sanitize before injecting.** The body is authored in a rich
> text editor and stored as HTML; it is **not** escaped or sanitized on the way out. Rendering it
> with `innerHTML`/`dangerouslySetInnerHTML` unsanitized is an XSS vector. Run it through a
> sanitizer (DOMPurify, or your framework's equivalent) — `Web.News` does this via
> `sanitizeArticleHtml`.

**Handle unknown types gracefully.** The list is not a stable contract; skip block types you don't
recognise rather than throwing. And handle the legacy case: older articles may have an empty
`content_blocks` with the body in a plain `content` HTML field instead.

---

## 8. Integration patterns

### 8.1 Server-side proxy (recommended)

Keeps the key server-side, sidesteps CORS entirely, and lets you cache. Next.js route handler:

```ts
// app/api/news/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qs = new URLSearchParams({
    per_page: searchParams.get('per_page') ?? '12',
    page: searchParams.get('page') ?? '1',
  });

  const res = await fetch(`${process.env.NEWS_API_URL}/external/articles?${qs}`, {
    headers: {
      'X-Site-Api-Key': process.env.NEWS_SITE_KEY!, // server-only env var
      Accept: 'application/json',
    },
    next: { revalidate: 300 }, // match the upstream cache TTL
  });

  if (!res.ok) return Response.json({ error: 'Upstream error' }, { status: 502 });

  const body = await res.json();
  return Response.json({ articles: body.data.data, pagination: body.data });
}
```

PHP equivalent:

```php
$ch = curl_init(getenv('NEWS_API_URL') . '/external/articles?per_page=12');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'X-Site-Api-Key: ' . getenv('NEWS_SITE_KEY'),
        'Accept: application/json',
    ],
]);
$payload = json_decode(curl_exec($ch), true);
$articles = $payload['data']['data'] ?? [];
```

### 8.2 View tracking from the browser

Track views from the client (that's where the visitor is), but route the call through **your own**
endpoint so the key stays server-side:

```html
<script>
  // Runs on your article page; hits YOUR backend, which forwards with the site key.
  fetch('/api/news/view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: 'your-article-slug',
      placement: 'article-page',
      visitor_id: localStorage.getItem('visitor_id'), // your own stable id
      referrer: document.referrer,
    }),
  });
</script>
```

Your handler forwards to `POST /external/articles/{slug}/view`, passing `visitor_id` through so
dedup works per visitor rather than per proxy host (§5.3).

### 8.3 Newsletter sign-up widget

The admin console generates a copy-paste widget at **Admin → Sites → Integration**
(`Web.News/app/admin/sites/integration/page.tsx`): an HTML form that `POST`s directly to
`/external/subscribe` with `X-Site-Key` inline. It's the fastest path to a working sign-up box, with
two caveats before you ship it:

1. It embeds the site key in page source, and it is a **direct browser call** — so your origin must
   be added to `config/cors.php` first (§3). A server-side proxy avoids both issues.
2. It hardcodes `countries: ["Philippines"]`, `time: "08:00 AM"`, and `features: "Daily"`, and pulls
   `categories` from your site's assigned keywords. Adjust for your audience.

---

## 9. Caching, rate limits, and freshness

**Upstream list cache.** `GET /external/articles` responses are cached server-side, keyed by your
site id plus the exact filter and pagination inputs
([`ExternalArticleListCache`](app/Support/ExternalArticleListCache.php)). Default TTL **300s**
(`EXTERNAL_ARTICLES_CACHE_TTL`; `0` disables). Consequences:

- A newly published article can take **up to the TTL** to appear in your list. Detail reads are
  uncached and immediate.
- `per_page=50` and `limit=50` share one cache entry, as do `page=1` and an absent `page` — the key
  is built from *effective* values.
- If the cache backend fails the payload is recomputed from the database rather than erroring, so
  you should never see a 500 from a cache problem.

Setting your own client-side TTL to ~300s to match is a reasonable default.

**Rate limits.**

| Scope | Limit |
| --- | --- |
| All `/api/*` routes (global) | **300 requests/minute**, keyed on a fingerprint of IP + `User-Agent` + `Accept-Language` |
| `POST /external/articles/{id}/view` | **120 requests/minute** |

Exceeding a limit returns **429** with a `Retry-After` header. A server-side proxy funnels all your
traffic through one fingerprint, so size your caching accordingly — the 300/min ceiling is shared
across your whole site once you proxy.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `401 API Key missing` | Header absent or misspelled. | Send `X-Site-Api-Key` (or `X-Site-Key`). |
| `403 Invalid or Suspended API Key` | Key wrong, or `site_status != 'active'`. | Re-check the key; ask an operator to confirm the site is active (it may have been rotated). |
| `403 Unauthorized Origin` | Browser `Origin` doesn't match the registered `site_url`. | Call from your server, or have `site_url` corrected. |
| CORS error in the browser console, request never reaches the API | Your origin isn't in `config/cors.php`. | Proxy server-side (§8.1), or request an allowlist entry + deploy. |
| `404` on every path | Base URL missing the `/api` prefix. | Use `https://api.homes.ph/api`. |
| `200` but `data.data` is `[]` | No articles are distributed to your site. | Ask Homes to target content at your `site_name` (§4). |
| `404` on an article you can see in the list | Slug/UUID mismatch, or it was unpublished/undistributed since the list was cached. | Use the `slug` exactly as returned; refresh the list. |
| `content_blocks` empty | You're reading the **list** endpoint. | Fetch `GET /external/articles/{identifier}` (§5.2). |
| New article missing for a few minutes | List cache TTL. | Wait out the TTL, or fetch by slug. |
| View counts implausibly low | Every visitor sharing one derived `visitor_id`, collapsed by the 12h dedup. | Pass your own `visitor_id` (§5.3). |
| `422 Ambiguous province` | A province slug matches multiple rows. | Use the numeric province id in the path. |
| `keywords.map is not a function` | `keywords` is a **comma-joined string**, not an array. | Split on `", "`. |

---

## 11. Launch checklist

- [ ] `Site` row created, `site_status = 'active'`, `site_url` exactly matching your public origin.
- [ ] Site key stored as a **server-side** secret (not in client bundles, not in git).
- [ ] Integration calls made server-side; CORS allowlist requested only if you truly need direct
      browser calls.
- [ ] Reading articles from `response.data.data`, pagination from `response.data`.
- [ ] Article bodies fetched from the **detail** endpoint; not reading `content_blocks` from lists.
- [ ] `text` blocks sanitized before rendering; unknown block types skipped, not fatal.
- [ ] `keywords` handled as a string; dates parsed as server-local `Y-m-d H:i:s`.
- [ ] View tracking wired with your own stable `visitor_id`.
- [ ] Client-side caching in place (~300s) and comfortably inside 300 req/min.
- [ ] Confirmed with Homes that content is distributed to your `site_name`.

---

## Appendix A — Endpoint summary

All under the base URL, all requiring the site-key header.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/external/articles` | Article list (site-scoped, cached, no body) |
| GET | `/external/articles/{slug\|uuid}` | Article detail (with `content_blocks`) |
| POST | `/external/articles/{slug\|uuid}/view` | Record a view (120/min) |
| GET | `/external/restaurants` | Restaurant listings (site-scoped) |
| GET | `/external/categories` | Active categories |
| GET | `/external/countries` | Active countries |
| GET | `/external/provinces` | Provinces (`?country_id=`) |
| GET | `/external/cities` | Cities (`?country_id=&province_id=`) |
| GET | `/external/countries/{country}/provinces` | Nested provinces |
| GET | `/external/countries/{country}/provinces/{province}/cities` | Nested cities |
| GET | `/external/categories/countries` | Category × country pairs with counts, for your site |
| POST | `/external/subscribe` | Newsletter sign-up attributed to your site |

## Appendix B — What *not* to integrate against

`Service.News` exposes other route groups. They are **not** part of this integration contract:

- **`/api/external/public/*`** — a broad, **unauthenticated** CRUD surface (articles, restaurants,
  events, ads, uploads, AI generation), throttled to 120 req/min. It exists for trusted first-party
  Homes apps that do their own authorization. It takes no site key, is **not site-scoped**, and its
  write endpoints are unattributed (`edited_by` is always null). Do not build a partner integration
  on it — you'd be depending on an internal surface that may be locked down without notice.
- **`/api/v1/*`, `/api/v2/*`** — the public reads and admin console used by `Web.News` (Sanctum
  sessions and role-gated admin routes).
- **`/api/v1/integration/*`** — user-API-key ping/whoami, a different credential type (`X-User-Api-Key`)
  bound to a role, for internal automation.

If you need something the `external/*` surface doesn't cover, ask for it to be added there rather
than reaching into these.
