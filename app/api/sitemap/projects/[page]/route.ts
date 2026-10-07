import { SITE_URL, buildUrlsetXml, sitemapResponse, sitemapUnavailableResponse } from "@/lib/sitemap-helpers"
import { fetchSectionPage } from "@/lib/sitemap-sections"

/** /sitemap-projects-N.xml — published, active projects. */
export const dynamic = "force-dynamic"

export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params
  const pageNum = Number.parseInt(page, 10)
  if (!Number.isInteger(pageNum) || pageNum < 1) return new Response("Not found", { status: 404 })

  const rows = await fetchSectionPage("projects", pageNum)
  if (rows === null) return sitemapUnavailableResponse() // transient upstream failure
  if (rows.length === 0) return new Response("Not found", { status: 404 })

  // The canonical URL nests the project under its developer. A project with no developer to nest under has
  // no page of its own — /projects/<slug> only redirects to the index — and a redirecting URL does not
  // belong in a sitemap, so it is left out.
  const urls = rows.flatMap((row) =>
    row.slug && row.developers?.slug
      ? [{ loc: `${SITE_URL}/${row.developers.slug}/${row.slug}`, lastmod: row.updated_at?.slice(0, 10) ?? undefined }]
      : [],
  )
  return sitemapResponse(buildUrlsetXml(urls))
}
