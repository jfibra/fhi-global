import "server-only"

import { DEFAULT_PREVIEW_IMAGE_URL, LEGACY_PREVIEW_IMAGE_URL } from "@/lib/seo"

/**
 * news-service.ts — server-only client for the HomesPH News external API
 * (api.homes.ph `/api/external/*`, site-key surface — see guides/NewsIntegration.md).
 *
 * Env (feature-gated: everything silently no-ops when unset):
 *   HOMESPH_NEWS_API_URL — the BARE api base, e.g. https://api.homes.ph/api
 *   HOMESPH_NEWS_API_KEY — the 64-char site key. Never sent to the browser.
 *
 * Upstream quirks this module absorbs:
 *   · list envelope is two-level: { site, data: { data: [...], last_page, ... } }
 *   · detail envelope is { article: {...} } — the ONLY response with content_blocks
 *   · per_page is hard-capped at 100 (silently clamped upstream)
 *   · `keywords` is a comma-joined STRING, not an array
 *   · dates are naive "Y-m-d H:i:s" in the upstream server's locale (Asia/Manila)
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type NewsContentBlock = {
  id?: string | number
  type: string
  content?: unknown
  settings?: Record<string, unknown>
}

export type NewsArticle = {
  /** Upstream UUID, kept verbatim (used for dedup + React keys). */
  id: string
  slug: string
  title: string
  excerpt: string
  date: string
  img: string
  featuredImage?: string
  publishedAt?: string
  updatedAt?: string
  isPublished?: boolean
  tags?: string[]
  language?: string
  badge?: string
  readTime?: string
  hasVideo?: boolean
  author?: string
  /** Legacy plain-HTML body (older articles only — modern body is contentBlocks). */
  content?: string
  contentBlocks: NewsContentBlock[]
  category?: string
  categorySlug?: string
  country?: string
  location?: string
  topics: string[]
  keywords: string[]
  viewsCount?: number
}

export type ArticleListParams = {
  page?: number
  perPage?: number
  categorySlug?: string
  countrySlug?: string
  search?: string
}

export type ArticleListResult = {
  articles: NewsArticle[]
  currentPage: number
  lastPage: number
  total: number
}

export type NewsCategoryCountry = {
  category: string
  categorySlug: string
  country: string
  countryId: string
  articleCount: number
}

const EMPTY_LIST: ArticleListResult = { articles: [], currentPage: 1, lastPage: 0, total: 0 }

/** Upstream hard cap — values above this are silently clamped by the API. */
const PER_PAGE_CAP = 100

// ── Config ─────────────────────────────────────────────────────────────────────

function newsBase(): string {
  const raw = (process.env.HOMESPH_NEWS_API_URL ?? "").trim().replace(/\/+$/, "")
  // Defensive: older deployments stored the FULL articles endpoint in this var.
  // Strip that suffix so both conventions resolve to the bare api base.
  return raw.replace(/\/external\/articles$/, "")
}

function apiKey(): string {
  return process.env.HOMESPH_NEWS_API_KEY ?? ""
}

/** True when both env vars are present — the whole feature gates on this. */
export function newsConfigured(): boolean {
  return Boolean(newsBase() && apiKey())
}

// ── Slugify ────────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return (text ?? "")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "news"
}

// ── Dates ──────────────────────────────────────────────────────────────────────

/**
 * Upstream timestamps are naive "Y-m-d H:i:s" wall-clock in the API server's
 * locale (Philippines). Pin them to +08:00 so schema.org dates and the Google
 * News sitemap carry a real offset instead of being reinterpreted as UTC.
 */
export function toManilaIso(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(raw.trim())
  if (!m) return null
  return `${m[1]}T${m[2]}+08:00`
}

// ── Fetch ──────────────────────────────────────────────────────────────────────

type ApiFetchOptions = {
  revalidate?: number
  noStore?: boolean
  method?: "GET" | "POST"
  body?: unknown
  signal?: AbortSignal
}

/**
 * Like apiFetch, but distinguishes "the resource doesn't exist" (upstream 404
 * → data null, failed false) from "the upstream is broken" (network error or
 * 5xx → failed true). Callers that turn a miss into notFound() MUST use this:
 * a notFound() fired during an outage gets baked into the ISR cache as a hard
 * 404 on live content.
 */
async function apiFetchDetailed(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<{ data: unknown; failed: boolean }> {
  if (!newsConfigured()) return { data: null, failed: false }
  try {
    const res = await fetch(`${newsBase()}${path}`, {
      method: opts.method ?? "GET",
      headers: {
        "X-Site-Api-Key": apiKey(),
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      ...(opts.noStore || opts.method === "POST"
        ? { cache: "no-store" as const }
        : { next: { revalidate: opts.revalidate ?? 300 } }),
      signal: opts.signal,
    })
    if (res.status === 404) return { data: null, failed: false }
    if (!res.ok) return { data: null, failed: true }
    return { data: await res.json(), failed: false }
  } catch {
    return { data: null, failed: true }
  }
}

async function apiFetch(path: string, opts: ApiFetchOptions = {}): Promise<unknown> {
  return (await apiFetchDetailed(path, opts)).data
}

// ── Normalize ──────────────────────────────────────────────────────────────────

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function normalize(raw: Record<string, unknown>): NewsArticle {
  // Site-relative fallback (works in next/image without a remotePattern);
  // JSON-LD/OG emit sites absolutize it. Upstream data still carries the
  // legacy placeholder URL whose host is dead (HTTP 402) — map it to the
  // current default so it never renders or ships in markup.
  const rawImage = str(raw.image)
  const image =
    !rawImage || rawImage === LEGACY_PREVIEW_IMAGE_URL ? DEFAULT_PREVIEW_IMAGE_URL : rawImage
  const publishedAt = str(raw.published_at) ?? str(raw.created_at) ?? str(raw.date) ?? ""
  const updatedAt = str(raw.updated_at) ?? publishedAt

  const topics: string[] = Array.isArray(raw.topics)
    ? raw.topics.map((t) => String(t)).filter(Boolean)
    : []
  const keywords: string[] = typeof raw.keywords === "string"
    ? raw.keywords.split(",").map((k) => k.trim()).filter(Boolean)
    : Array.isArray(raw.keywords)
      ? raw.keywords.map((k) => String(k)).filter(Boolean)
      : []

  const title = str(raw.title) ?? "Untitled"
  const excerpt = str(raw.summary) ?? str(raw.description) ?? ""

  return {
    id: String(raw.id ?? raw.slug ?? slugify(title)),
    slug: str(raw.slug) ?? slugify(title),
    title,
    excerpt,
    date: publishedAt,
    img: image,
    featuredImage: image,
    publishedAt,
    updatedAt,
    isPublished: raw.status ? raw.status === "published" : true,
    tags: topics.length ? topics : keywords,
    language: "en",
    badge: str(raw.category),
    author: str(raw.author),
    content: typeof raw.content === "string" ? raw.content : "",
    contentBlocks: Array.isArray(raw.content_blocks) ? (raw.content_blocks as NewsContentBlock[]) : [],
    category: str(raw.category),
    categorySlug: str(raw.category_slug),
    country: str(raw.country),
    location: str(raw.location),
    topics,
    keywords,
    viewsCount: Number.isFinite(Number(raw.views_count)) ? Number(raw.views_count) : undefined,
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Paginated article list with filters. Failure/unconfigured → empty result. */
export async function fetchArticlesList(
  params: ArticleListParams = {},
  init?: { signal?: AbortSignal; revalidate?: number },
): Promise<ArticleListResult> {
  const qs = new URLSearchParams()
  qs.set("page", String(Math.max(1, params.page ?? 1)))
  qs.set("per_page", String(Math.min(PER_PAGE_CAP, Math.max(1, params.perPage ?? 20))))
  if (params.categorySlug) qs.set("category_slug", params.categorySlug)
  if (params.countrySlug) qs.set("country_slug", params.countrySlug)
  if (params.search) qs.set("search", params.search)

  const result = (await apiFetch(`/external/articles?${qs.toString()}`, {
    revalidate: init?.revalidate,
    signal: init?.signal,
  })) as {
    data?: { data?: unknown; current_page?: unknown; last_page?: unknown; total?: unknown }
  } | null

  const data = result?.data
  if (!data || !Array.isArray(data.data)) return EMPTY_LIST

  return {
    articles: data.data.map((row) => normalize(row as Record<string, unknown>)),
    currentPage: Number(data.current_page) || 1,
    lastPage: Number(data.last_page) || 1,
    total: Number(data.total) || data.data.length,
  }
}

/** Back-compat wrapper (existing callers: buy-sidebar). */
export async function fetchArticles(
  page = 1,
  init?: { signal?: AbortSignal },
): Promise<NewsArticle[]> {
  return (await fetchArticlesList({ page }, init)).articles
}

/** Article detail — the only call that returns populated contentBlocks.
 *  `failed` = the upstream broke (throw, don't notFound); article null with
 *  failed false = the article genuinely doesn't exist. */
export async function fetchArticleBySlugResult(
  slug: string,
): Promise<{ article: NewsArticle | null; failed: boolean }> {
  if (!slug) return { article: null, failed: false }
  const { data, failed } = await apiFetchDetailed(`/external/articles/${encodeURIComponent(slug)}`)
  if (failed) return { article: null, failed: true }
  const article = (data as { article?: unknown } | null)?.article
  if (!article || typeof article !== "object") return { article: null, failed: false }
  return { article: normalize(article as Record<string, unknown>), failed: false }
}

export async function fetchArticleBySlug(slug: string): Promise<NewsArticle | null> {
  return (await fetchArticleBySlugResult(slug)).article
}

/** Category × country pairs (with counts) for content distributed to this site. */
export async function fetchCategoriesCountries(): Promise<NewsCategoryCountry[]> {
  const result = (await apiFetch(`/external/categories/countries`, { revalidate: 3600 })) as
    | { data?: unknown }
    | null
  const rows = result?.data
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        category: String(r.category ?? ""),
        categorySlug: String(r.category_slug ?? ""),
        country: String(r.country ?? ""),
        countryId: String(r.country_id ?? ""),
        articleCount: Number(r.article_count) || 0,
      }
    })
    .filter((r) => r.category && r.categorySlug)
}

/**
 * Forward a visitor's read to the upstream view counter. `visitor_id` must be
 * the visitor's own stable id (not the server's), or the 12h dedup collapses
 * every reader into one.
 */
export async function trackArticleView(
  slug: string,
  payload: { placement?: string; referrer?: string; visitor_id?: string } = {},
): Promise<boolean> {
  if (!slug) return false
  const result = await apiFetch(`/external/articles/${encodeURIComponent(slug)}/view`, {
    method: "POST",
    body: payload,
  })
  return result !== null
}
