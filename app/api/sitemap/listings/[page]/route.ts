import { SITE_URL, buildUrlsetXml, sitemapResponse } from "@/lib/sitemap-helpers"
import { fetchSectionPage } from "@/lib/sitemap-sections"

/** /sitemap-listings-N.xml — published agent listings (canonical path is slug ?? id). */
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params
  const pageNum = Number.parseInt(page, 10)
  if (!Number.isInteger(pageNum) || pageNum < 1) return new Response("Not found", { status: 404 })

  const rows = await fetchSectionPage("listings", pageNum)
  if (rows.length === 0) return new Response("Not found", { status: 404 })

  const urls = rows
    .filter((row) => row.slug || row.id != null)
    .map((row) => ({
      loc: `${SITE_URL}/listings/${row.slug ?? row.id}`,
      lastmod: row.updated_at?.slice(0, 10) ?? undefined,
    }))
  return sitemapResponse(buildUrlsetXml(urls))
}
