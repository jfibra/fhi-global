import { SITE_URL, buildUrlsetXml, sitemapResponse, sitemapUnavailableResponse } from "@/lib/sitemap-helpers"
import { fetchNewsShard } from "@/lib/sitemap-sections"

/**
 * /sitemap-news-N.xml — every distributed article. Each 1000-URL shard is
 * aggregated from up to 10 upstream API pages (per_page is capped at 100);
 * the inner fetches sit behind the 300s data cache and this response behind
 * the 1h CDN cache, so a shard render costs at most 10 upstream calls an hour.
 */
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params
  const pageNum = Number.parseInt(page, 10)
  if (!Number.isInteger(pageNum) || pageNum < 1) return new Response("Not found", { status: 404 })

  const rows = await fetchNewsShard(pageNum)
  if (rows === null) return sitemapUnavailableResponse() // transient upstream failure
  if (rows.length === 0) return new Response("Not found", { status: 404 })

  const urls = rows.map((row) => ({
    loc: `${SITE_URL}/news/${row.slug}`,
    lastmod: row.lastmod,
  }))
  return sitemapResponse(buildUrlsetXml(urls))
}
