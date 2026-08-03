import { SITE_URL, buildUrlsetXml, sitemapResponse, sitemapUnavailableResponse } from "@/lib/sitemap-helpers"
import { fetchSectionPage } from "@/lib/sitemap-sections"

/** /sitemap-events-N.xml — published events (detail route accepts slug or id; canonical prefers slug). */
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params
  const pageNum = Number.parseInt(page, 10)
  if (!Number.isInteger(pageNum) || pageNum < 1) return new Response("Not found", { status: 404 })

  const rows = await fetchSectionPage("events", pageNum)
  if (rows === null) return sitemapUnavailableResponse() // transient upstream failure
  if (rows.length === 0) return new Response("Not found", { status: 404 })

  const urls = rows
    .filter((row) => row.slug || row.id != null)
    .map((row) => ({
      loc: `${SITE_URL}/events/${row.slug ?? row.id}`,
      lastmod: row.updated_at?.slice(0, 10) ?? undefined,
    }))
  return sitemapResponse(buildUrlsetXml(urls))
}
