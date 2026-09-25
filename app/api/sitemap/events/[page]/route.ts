import { SITE_URL, buildUrlsetXml, sitemapResponse, sitemapUnavailableResponse } from "@/lib/sitemap-helpers"
import { fetchAgentEventPaths, fetchSectionPage } from "@/lib/sitemap-sections"

/**
 * /sitemap-events-N.xml — published company events (detail route accepts slug
 * or id; canonical prefers slug), plus — on shard 1 — agents' own events at
 * their website URLs (migration 057), which the company section excludes.
 */
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params
  const pageNum = Number.parseInt(page, 10)
  if (!Number.isInteger(pageNum) || pageNum < 1) return new Response("Not found", { status: 404 })

  const [rows, agentEvents] = await Promise.all([
    fetchSectionPage("events", pageNum),
    pageNum === 1 ? fetchAgentEventPaths() : Promise.resolve([]),
  ])
  if (rows === null || agentEvents === null) return sitemapUnavailableResponse() // transient upstream failure
  if (rows.length === 0 && agentEvents.length === 0) return new Response("Not found", { status: 404 })

  const urls = [
    ...rows
      .filter((row) => row.slug || row.id != null)
      .map((row) => ({
        loc: `${SITE_URL}/events/${row.slug ?? row.id}`,
        lastmod: row.updated_at?.slice(0, 10) ?? undefined,
      })),
    ...agentEvents.map((e) => ({ loc: `${SITE_URL}${e.path}`, lastmod: e.updated_at?.slice(0, 10) ?? undefined })),
  ]
  return sitemapResponse(buildUrlsetXml(urls))
}
