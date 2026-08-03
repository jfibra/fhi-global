import { buildNewsSitemapXml, sitemapResponse, SITE_URL, type NewsSitemapItem } from "@/lib/sitemap-helpers"
import { fetchArticlesList, newsConfigured, toManilaIso } from "@/lib/news-service"
import { submitToIndexNow } from "@/lib/indexnow"

/**
 * /news-sitemap.xml — Google News sitemap. Per the News sitemap spec this
 * carries ONLY articles published in the last 48 hours (older coverage lives
 * in the regular sitemap-news-N.xml shards). Upstream timestamps are naive
 * Manila wall-clock, normalized to +08:00. Fresh articles are also pinged to
 * IndexNow (idempotent; the CDN cache on this route bounds ping frequency).
 */
export const dynamic = "force-dynamic"

const WINDOW_MS = 48 * 60 * 60 * 1000
const MAX_ITEMS = 1000

export async function GET() {
  if (!newsConfigured()) {
    return sitemapResponse(buildNewsSitemapXml([]), { shortCache: true })
  }

  const { articles } = await fetchArticlesList(
    { page: 1, perPage: 100 },
    { revalidate: 900 },
  )

  const now = Date.now()
  const items: NewsSitemapItem[] = []
  for (const article of articles) {
    if (!article.slug || article.isPublished === false) continue
    const iso = toManilaIso(article.publishedAt || article.date)
    if (!iso) continue
    const publishedMs = Date.parse(iso)
    if (!Number.isFinite(publishedMs) || now - publishedMs > WINDOW_MS) continue
    items.push({
      loc: `${SITE_URL}/news/${article.slug}`,
      title: article.title,
      publicationDate: iso,
    })
    if (items.length >= MAX_ITEMS) break
  }

  if (items.length > 0) {
    // Fire-and-forget: tell IndexNow about the fresh articles.
    void submitToIndexNow(items.map((i) => i.loc))
  }

  return sitemapResponse(buildNewsSitemapXml(items), { shortCache: items.length === 0 })
}
