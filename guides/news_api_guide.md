# HomesPH News API — moved

This guide is superseded:

- **Upstream API contract** (endpoints, auth, payloads, content_blocks, rate limits):
  [`NewsIntegration.md`](./NewsIntegration.md)
- **FHI implementation** (service, sanitization, pages, sitemaps, env):
  [`news.md`](./news.md)

Key facts that changed since the original version of this guide:

- Base URL is `https://api.homes.ph/api` (the old Cloud Run host is dead). The env var
  holds the BARE base; code appends `/external/...`.
- The article body is delivered as `content_blocks[]` on the DETAIL endpoint only —
  modern articles have no plain `content` HTML field, and list responses always have
  `content_blocks: []`.
- `per_page` is hard-capped at 100 (silently clamped upstream).
- The old `/api/news/articles` + `/api/news/article` proxy routes were removed (they
  had no callers); the only proxies now are `/api/news/view` and `/api/news/subscribe`.
