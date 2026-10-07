import { SITE_URL, buildUrlsetXml, sitemapResponse, sitemapUnavailableResponse } from "@/lib/sitemap-helpers"
import { fetchAgentSiteRows } from "@/lib/sitemap-sections"

/**
 * /sitemap-agent-sites-1.xml — the agents' personal sites that are really theirs
 * (own name, own bio, own portrait: lib/agent-site.ts). The same predicate decides
 * the page's robots tag, so nothing listed here is marked noindex.
 */
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params
  if (page !== "1") return new Response("Not found", { status: 404 })

  const rows = await fetchAgentSiteRows()
  if (rows === null) return sitemapUnavailableResponse() // transient failure
  if (rows.length === 0) return new Response("Not found", { status: 404 })

  return sitemapResponse(
    buildUrlsetXml(
      rows.map((row) => ({ loc: `${SITE_URL}/website/${row.slug}`, lastmod: row.updated_at?.slice(0, 10) ?? undefined })),
    ),
  )
}
