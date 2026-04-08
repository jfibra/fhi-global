/**
 * news-service.ts — server-only module
 * Calls the HomesPH News external API using server-side env vars.
 * The API key is never sent to the browser.
 */

export type NewsArticle = {
  id: number
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
  content?: string
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

// ── Normalize a single raw API object ─────────────────────────────────────────
function normalize(raw: Record<string, any>, idx: number): NewsArticle {
  const image = raw?.featured_image ?? raw?.image ?? raw?.image_url ?? raw?.cover ?? "/img/1.png"
  const publishedAt = raw?.published_at ?? raw?.publish_at ?? raw?.created_at ?? ""
  const updatedAt = raw?.updated_at ?? publishedAt
  const tags = Array.isArray(raw?.tags)
    ? raw.tags.map((t: unknown) => String(t)).filter(Boolean)
    : typeof raw?.tags === "string"
      ? raw.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
      : []

  return {
    id: typeof raw?.id === "number" ? raw.id : idx + 1,
    slug: raw?.slug || slugify(raw?.title ?? `article-${idx + 1}`),
    title: raw?.title ?? "Untitled",
    excerpt: raw?.excerpt ?? raw?.summary ?? raw?.description ?? "",
    date: publishedAt,
    img: image,
    featuredImage: image,
    publishedAt,
    updatedAt,
    isPublished: typeof raw?.is_published === "boolean" ? raw.is_published : true,
    tags,
    language: raw?.language ?? "en",
    badge: raw?.badge ?? undefined,
    readTime: raw?.read_time ?? raw?.readTime ?? undefined,
    hasVideo: !!(raw?.has_video ?? raw?.hasVideo),
    author: raw?.author ?? raw?.author_name ?? undefined,
    content: raw?.content ?? raw?.body ?? undefined,
  }
}

// ── Unwrap flexible API response shapes ───────────────────────────────────────
// List responses: { data: { data: [...] } }  → result.data.data
// Single article: { data: { id, title, … } } → result.data  (object, not array)
// Fallback array or bare object also handled.
function extractArray(result: unknown): Record<string, any>[] {
  if (!result || typeof result !== "object") return []
  const d = result as Record<string, any>

  // Standard list shape from HomesPH API: result.data.data (paginated)
  if (Array.isArray(d?.data?.data)) return d.data.data

  // Flat array in result.data
  if (Array.isArray(d?.data)) return d.data

  // Single article shape: result.data is a plain object with article fields
  if (d?.data && typeof d.data === "object" && !Array.isArray(d.data)) {
    return [d.data as Record<string, any>]
  }

  // Bare array at root
  if (Array.isArray(d)) return d

  // Bare single object at root (last resort)
  return [d]
}

// ── Base URL helper (strips trailing slash) ───────────────────────────────────
function baseUrl(): string {
  return (process.env.HOMESPH_NEWS_API_URL ?? "").replace(/\/$/, "")
}

function apiKey(): string {
  return process.env.HOMESPH_NEWS_API_KEY ?? ""
}

// ── Low-level fetch wrapper ────────────────────────────────────────────────────
async function apiFetch(url: string, init?: { signal?: AbortSignal }): Promise<unknown> {
  const key = apiKey()
  if (!url || !key) return null
  try {
    const res = await fetch(url, {
      headers: {
        "X-Site-Api-Key": key,
        Accept: "application/json",
      },
      next: { revalidate: 300 },
      signal: init?.signal,
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Fetch a paginated list of articles. */
export async function fetchArticles(
  page = 1,
  init?: { signal?: AbortSignal }
): Promise<NewsArticle[]> {
  const base = baseUrl()
  if (!base) return []
  const result = await apiFetch(`${base}?page=${page}`, init)
  return extractArray(result).map(normalize)
}

/**
 * Fetch a single article by slug.
 *
 * Strategy (in order):
 *   1. Path segment:  BASE/{slug}          — standard REST detail endpoint
 *   2. Query param:   BASE?slug={slug}      — alternate API convention
 *   3. List scan:     fetch pages 1–3 and match by slug or slugified title
 *      (guaranteed to work even if the API has no dedicated detail route)
 */
export async function fetchArticleBySlug(slug: string): Promise<NewsArticle | null> {
  const base = baseUrl()
  if (!base || !slug) return null

  // ── Strategy 1: path segment ───────────────────────────────────────────────
  const byPath = await apiFetch(`${base}/${slug}`)
  if (byPath) {
    const arr = extractArray(byPath)
    if (arr.length > 0) {
      const article = normalize(arr[0], 0)
      // Extra guard: make sure the returned item is actually the requested article
      // (some APIs return list results even on path endpoints)
      if (Array.isArray((byPath as any)?.data?.data)) {
        // Got a list back — fall through to scan
      } else {
        return article
      }
    }
  }

  // ── Strategy 2: query param ────────────────────────────────────────────────
  const byQuery = await apiFetch(`${base}?slug=${encodeURIComponent(slug)}`)
  if (byQuery) {
    const arr = extractArray(byQuery)
    // Accept only if it didn't come back as a full list (which would just be page 1)
    if (arr.length > 0 && !Array.isArray((byQuery as any)?.data?.data)) {
      return normalize(arr[0], 0)
    }
  }

  // ── Strategy 3: scan list pages 1–3 and match by slug ─────────────────────
  for (let page = 1; page <= 3; page++) {
    const articles = await fetchArticles(page)
    if (articles.length === 0) break
    const match = articles.find((a) => a.slug === slug)
    if (match) return match
  }

  return null
}
