import { SITE_URL, buildUrlsetXml, sitemapResponse, sitemapUnavailableResponse } from "@/lib/sitemap-helpers"
import { fetchSectionPage } from "@/lib/sitemap-sections"

/** /sitemap-listings-N.xml — published agent listings (canonical path is slug ?? id). */
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params
  const pageNum = Number.parseInt(page, 10)
  if (!Number.isInteger(pageNum) || pageNum < 1) return new Response("Not found", { status: 404 })

  const rows = await fetchSectionPage("listings", pageNum)
  if (rows === null) return sitemapUnavailableResponse() // transient upstream failure
  // Shard 1 is advertised from the unfiltered count; if the post-filter (test records, retired projects) leaves
  // nothing, answer an empty urlset rather than a 404 on an advertised URL. Later pages past the end are 404.
  if (rows.length === 0 && pageNum > 1) return new Response("Not found", { status: 404 })

  const urls = rows
    .filter((row) => row.slug || row.id != null)
    .map((row) => ({
      loc: `${SITE_URL}/listings/${row.slug ?? row.id}`,
      lastmod: row.updated_at?.slice(0, 10) ?? undefined,
    }))
  return sitemapResponse(buildUrlsetXml(urls))
}
