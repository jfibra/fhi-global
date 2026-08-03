import { SITE_URL, buildUrlsetXml, sitemapResponse } from "@/lib/sitemap-helpers"

/** /sitemap-pages-1.xml — the static top-level pages. */
export const dynamic = "force-dynamic"

const PAGES_LASTMOD = "2026-08-03"

const STATIC_PATHS = [
  "/",
  "/buy",
  "/rent",
  "/projects",
  "/developers",
  "/events",
  "/news",
  "/about",
  "/contact",
]

export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params
  if (page !== "1") return new Response("Not found", { status: 404 })

  const urls = STATIC_PATHS.map((path) => ({
    loc: `${SITE_URL}${path === "/" ? "" : path}` || SITE_URL,
    lastmod: PAGES_LASTMOD,
  }))
  return sitemapResponse(buildUrlsetXml(urls))
}
